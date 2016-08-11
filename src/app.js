var ipc = require("electron").ipcRenderer,
    Snoocore = require("snoocore"),
    persist = require("node-persist"),
    reddit = require("./src/reddit");

persist.initSync({
    dir: process.resourcesPath + "/persist"
});

var authGate = new Vue({
    el: "#auth_gate",
    data: {
        authenticated: false,
        error: "Please sign in."
    },
    methods: {
        authenticateUser: function(force_auth) {
            token.tokenizing = true;
            this.authenticated = true;
            token.pulse();
            if (!force_auth) {
                reddit.authenticate(function(success) {
                    if (success) {
                        reddit.getMessages(0, 10, function(mail) {
                            console.log(mail);
                        });
                        token.signIn();
                    }
                });
            } else {
                token.signIn();
            }
        }
    }
});

var token = new Vue({
    el: "#token_gate",
    data: {
        tokenizing: false,
        load_string: ""
    },
    methods: {
        retryAuth: function() {
            this.tokenizing = false;
            auth.authenticated = false;
        },
        pulse: function() {
            this.loadstring += ".";
            if (this.loadstring.length > 3) {
                this.loadstring = "";
            }
            if (this.tokenizing) {
                setTimeout(this.pulse, 500);
            }
        },
        signIn: function() {
            this.tokenizing = false;
            main.show();
            main.beginLoop();
        }
    }
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
        window_open: true,
        first_check: true
    },
    methods: {
        show: function() {
            if (!(!this.first_check && this.window_open) || force) {
				this.ready = true;
				if (this.first_check) {
					this.first_check = false;
				}
			}
        },
        authenticate: function() {
            reddit.authenticate(function(success) {
                if (success) {
                    reddit.getMessages(0, 10, function(mail) {
                        console.log(mail);
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

ipc.on("hide", function() {
    main.window_open = false;
    if (main.ready) {
        reddit.read_all_messages();
        main.show();
        main.prefpane = false;
    }
})
