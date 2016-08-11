var ipc = require("electron").ipcRenderer,
    Snoocore = require("snoocore"),
    persist = require("node-persist"),
    reddit = require("./src/reddit");

persist.initSync({
    dir: process.resourcesPath + "/persist"
});

$(document).ready(function() {

});


$("#quit").click(function() {
    ipc.send("quit");
});

$("#minimize").click(function() {
    ipc.send("minimize");
});

$("#authenticate").click(function() {
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

    console.log(exports);
});
