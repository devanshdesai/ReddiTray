var ipc = require("electron").ipcRenderer,
  Snoocore = require("snoocore"),
  persist = require("node-persist");

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
						console.log("hello");
					}
				});
});