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

var config = jf.readFileSync('src/config.json');

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
        item = item.data;
        var date = new Date (item.created_utc),
            date_string;
        if (item.body.length > 300) {
            item.body = item.body.substring(0, 300) + "...";
        }
        date_string = date.toLocaleDateString() + " " + date.toLocaleTimeString(navigator.language, {hour: '2-digit', minute:'2-digit'});
        var newitem = {
            body: (item.body).replace("\n", "<br>"),
            unread: item.new,
            context: "https://reddit.com" + item.context,
            subreddit: "/r/" + item.subreddit,
            thread: item.link_title,
            author: item.author,
            date: date_string
        };
        if (!item.was_comment) newitem.subreddit = item.subject;
        if (newitem.context === "https://reddit.com") newitem.context = "https://www.reddit.com/message/messages/" + item.id;
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
            fn({
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
    markAllAsRead: function(output) {
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
