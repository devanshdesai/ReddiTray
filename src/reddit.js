var Snoocore = require("snoocore"),
    events = require("events"),
    persist = require("node-persist"),
    express = require("express");
const {
    shell
} = require("electron");

module.exports = {
    ready: new events.EventEmitter(),
    authenticate: function(output) {
        var state = Math.random();
        var authUrl = reddit.getAuthUrl(state);
        shell.openExternal(authUrl);
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
    getMe: function(output) {
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
    getMail: function(output) {
        reddit("/message/inbox").get({
            limit: lim,
            count: start
        }).then(function(mail) {
            var filtered = filterMail(mail);
            output(filtered);
        });
    }
};

persist.initSync({
    dir: process.resourcesPath + "/persist"
});

var reddit = new Snoocore({
    userAgent: 'test@documentation',
    oauth: {
        type: 'implicit',
        mobile: true,
        key: 'tj19dKrZ6PG5UA',
        redirectUri: 'http://localhost:8123/auth',
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


/*exports.authenticate = function(fn) {
    var state = Math.random();
    var authUrl = reddit.getAuthUrl(state);
    shell.openExternal(authUrl);
    servWait(function(query) {
        if (query.state == state) {
            reddit.auth(query.code).then(function() {
                var tokens = {
                    token: reddit.getAccessToken(),
                    refresh: reddit.getRefreshToken()
                };
                persist.setItem("tokens", tokens);
                signIn(tokens);
                fn(true);
            });
        } else {
            fn(false);
        }
    });
};*/

var servWait = function(output) {
    var app = express();
    var server = app.listen(8123);
    app.get("/auth", function(req, res) {
        output(req.query);
        res.send("<span style='font-family: Verdana, Sans-Serif;font-size:1.5em;'>Reddit authentication is complete. Please close this window.</span>");
        app = null;
    });
};
/*
function checkAuth() {
    var tokens = persist.getItem("tokens");
    if (tokens !== undefined && tokens.token !== "" && tokens.refresh !== "") {
        signIn(tokens);
        return true;
    } else {
        return false;
    }
};
*/
var signIn = function(tokens) {
    reddit.setAccessToken(tokens.token);
    reddit.setRefreshToken(tokens.refresh);
};
