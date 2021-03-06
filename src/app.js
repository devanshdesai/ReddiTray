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
        error: "Please sign in.",
        auth: false
    },
    methods: {
        authenticateUser: function(force_auth) {
            token.tokenizing = true;
            main.authenticated = true;
            this.auth = true;
            token.pulse();
            if (!force_auth) {
                reddit.authenticate(function(success) {
                    if (success) {
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
            main.authenticated = false;
            authGate.auth = false;
        },
        pulse: function() {
            this.load_string += ".";
            if (this.load_string.length > 3) {
                this.load_string = "";
            }
            if (this.tokenizing) {
                setTimeout(this.pulse, 500);
            }
        },
        signIn: function() {
            this.tokenizing = false;
            main.show();
            //main.beginLoop();
        }
    }
});

var main = new Vue({
    el: "#main",
    data: {
        ready: false,
        authenticated: false,
        user: {
            name: "",
            karma: {
                link: "",
                comment: ""
            }
        },
        mail: [{}],
        new_mail: false,
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
                this.getUsername();
                this.getMail();
            }
        },
        minimizeApp: function() {
            ipc.send("minimize");
        },
        quitApp: function() {
            ipc.send("quit");
        },
        openUserProfile: function() {
            shell.openExternal("https://reddit.com/u/" + this.user.name);
        },
        getContext: function(index) {
            var m = this;
            m.mail[index].unread = false;
            shell.openExternal(m.mail[index].context);
        },
        getUsername: function() {
            var m = this;
            reddit.getUserInfo(function(user) {
                m.err = false;
                m.user = user;
                if (user.mail) {
                    ipc.send("unread");
                    m.new_mail = true;
                    ipc.send("orange_icon");
                }
                if (!user.mail) {
                    ipc.send("inbox");
                    m.new_mail = false;
                    ipc.send("white_icon");
                }
            });
        },
        getMail: function() {
            var m = this;
            m.loading = true;
            reddit.getMail(0, 20, function(mail) {
                m.mail = mail;
                m.loading = false;
            });
        },
        getMoreMail: function() {
            var m = this;
            m.loading = true;
            reddit.getMail(0, m.mail.length + 20, function(mail) {
                m.mail = mail;
                m.loading = false;
            });
        },
        openSubreddit: function(index) {
            shell.openExternal("https://www.reddit.com" + this.mail[index].subreddit);
        },
        openRedditInbox: function() {
            shell.openExternal("https://www.reddit.com/message/inbox/");
        },
        openUserProfile: function() {
            shell.openExternal("https://www.reddit.com/u/" + this.user.name);
        },
        refreshMail: function() {
            var m = this;
            m.loading = true;
            reddit.getMail(0, m.mail.length, function(mail) {
                m.mail = mail;
                m.loading = false;
            });
        },
        markAsRead: function(index, message_id) {
            var m = this;
            if (index == null) {
                reddit.markAllMessagesAsRead();
                for (var i = 0; i < m.mail.length; i++) {
                    m.mail[i].unread = false;
                }
                m.new_mail = false;
            } else {
                reddit.markMessageAsRead(m.mail[index].kind + "_" + message_id);
                m.mail[index].unread = false;
                var unread_left = false;
                for (var i = 0; i < m.mail.length; i++) {
                    if (m.mail[i].unread === true) {
                        unread_left = true;
                    }
                }
                if (unread_left === false) {
                    m.new_mail === true;
                }

            }
            if (m.new_mail === false) {
                ipc.send("white_icon");
            }
        },
        markAsUnread: function(index, message_id) {
            var m = this;
            reddit.markMessageAsUnread(m.mail[index].kind + "_" + message_id);
            m.mail[index].unread = true;
            ipc.send("orange_icon");
        },
        openAbout: function() {
            shell.openExternal("http://devanshdesai.com/");
        }
    }
});

ipc.on("hide", function() {
    main.window_open = false;
    if (main.ready) {
        //reddit.read_all_mail();
        main.show();
    }
})
