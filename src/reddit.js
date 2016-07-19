var Snoocore = require("snoocore"),
    events = require("events"),
    persist = require("node-persist");
const {
    shell
} = require("electron");

var exports = new events.EventEmitter();

persist.initSync({
    dir: process.resourcesPath + "/persist"
});

var reddit = new Snoocore({
    userAgent: 'test@documentation',
    oauth: {
        type: 'implicit',
        mobile: true,
        key: 'tj19dKrZ6PG5UA',
        redirectUri: 'http://localhost.com/',
        scope: ["identity", "privatemessages"]
    }
});

exports.authenticate = function(fn) {
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
};