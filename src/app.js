var ipc = require("electron").ipcRenderer,
    Snoocore = require("snoocore"),
    persist = require("node-persist"),
    reddit = require("./src/reddit");

persist.initSync({
    dir: process.resourcesPath + "/persist"
});

var main = new Vue({
    el: "#main",
    data: {
        ready: false,
        user: {
            name: "null",
            karma: {
                link: "null",
                comment: "null"
            }
        },
        messages: [],
        new_messages: false,
        loading: false,
        interval: 2,
        first_check: true
    },
    methods: {
        authenticate: function() {
            reddit.authenticate(function(success) {
                if (success) {
        			reddit.getMe(function(user) {
        				if (user.mail) {
        					console.log("Mail!");
        				}
        				if (!user.mail) {
        					console.log("No Mail!");
        				}
        			});
                }
            });

            console.log(module.exports);
        },
        minimizeApp: function() {
            ipc.send("minimize");
        },
        quitApp: function() {
            ipc.send("quit");
        }
    }
});
