var Snoocore = require("snoocore"),
    events = require("events"),
    persist = require("node-persist"),
    express = require("express"),
    jf = require("jsonfile");

const {
    shell
} = require("electron");

persist.initSync({
    dir: process.resourcesPath + "/persist"
});

var config = jf.readFileSync('ReddiTray/src/config.json');

var reddit = new Snoocore({
    userAgent: "ReddiTray",
    oauth: {
        type: "explicit",
        mobile: true,
        key: config.key,
        secret: config.secret,
        duration: "permanent",
        redirectUri: config.redirectUri,
        scope: ["identity", "privatemessages"]
    }
});

reddit.on("access_token_expired", function(responseError) {
    var tokens = persist.getItem("tokens");
    if (tokens.refresh !== "") {
        reddit.refresh(tokens.refresh).then(function(refresh) {
            var tokens = {
                token: reddit.getAccessToken(),
                refresh: reddit.getRefreshToken()
            };
            persist.setItem("tokens", tokens);
        });
    }
});

var servWait = function(output) {
    var app = express();
    var server = app.listen(1212);
    app.get("/auth", function(req, res) {
        output(req.query);
        res.send("<span style='font-family: Arial; font-size:1.5em;'>Reddit authentication is complete. Please close this window.</span>");
        app = null;
    });
};

var signIn = function(tokens) {
    reddit.setAccessToken(tokens.token);
    reddit.setRefreshToken(tokens.refresh);
};

var filterMail = function(mail) {
    return mail.data.children.map(function(item) {
        var date = new Date (0),
            date_string;
        date.setUTCSeconds(item.data.created_utc);
        date_string = moment(date).fromNow();
        if (item.data.body.length > 300) {
            item.data.body = item.data.body.substring(0, 300) + "...";
        }
        var newitem = {
            kind: item.kind,
            body: marked(item.data.body),
            unread: item.data.new,
            context: "https://reddit.com" + item.data.context,
            subreddit: "/r/" + item.data.subreddit,
            thread: item.data.link_title,
            author: item.data.author,
            id: item.data.id,
            date: date_string
        };
        if (!item.data.was_comment) {
            newitem.subreddit = item.data.subject;
        }
        if (newitem.context === "https://reddit.com") {
            newitem.context = "https://www.reddit.com/message/messages/" + item.data.id;
        }
        return newitem;
    });
};

module.exports = {
    ready: new events.EventEmitter(),
    authenticate: function(output) {
        var state = Math.random();
        var auth_url = reddit.getAuthUrl(state);
        shell.openExternal(auth_url);
        servWait(function(query) {
            if (query.state == state) {
                reddit.auth(query.code).then(function() {
                    var tokens = {
                        token: reddit.getAccessToken(),
                        refresh: reddit.getRefreshToken()
                    };
                    persist.setItem("tokens", tokens);
                    signIn(tokens);
                    output(true);
                });
            } else {
                output(false);
            }
        });
    },
    checkAuth: function(output) {
        var tokens = persist.getItem("tokens");
        if (tokens !== undefined && tokens.token !== "" && tokens.refresh !== "") {
            signIn(tokens);
            output(true);
        } else {
            output(false);
        }
    },
    getUserInfo: function(output) {
        reddit("/api/v1/me").get().then(function(val) {
            output({
                name: val.name,
                karma: {
                    link: val.link_karma,
                    comment: val.comment_karma
                },
                mail: val.has_mail
            });
        });
    },
    getMail: function(start, limit, output) {
        reddit("/message/inbox").get({
            limit: limit,
            count: start
        }).then(function(mail) {
            var filtered_mail = filterMail(mail);
            output(filtered_mail);
        });
    },
    markMessageAsRead: function(message_id, output) {
        reddit("/api/read_message").post({
            id: message_id
        }).then(output);
    },
    markMessageAsUnread: function(message_id, output) {
        reddit("/api/unread_message").post({
            id: message_id
        }).then(output);
    },
    markAllMessagesAsRead: function(output) {
        reddit("/api/read_all_messages").post().then(output);
    },
    signOut: function() {
        reddit.deauth();
        persist.setItem("tokens", {
            token: "",
            refresh: ""
        });
    }
};

setTimeout(function() {
    module.exports.ready.emit("ready");
}, 500);
