var ipc = require("electron").ipcRenderer,
    Snoocore = require("snoocore"),
    reddit = require("./reddit"),
    persist = require("node-persist");
const {shell} = require("electron");

persist.initSync({
	dir: process.resourcesPath + "/persist"
});

$(document).ready(function () {

});


$("#quit").click(function() {
  ipc.send("quit");
});

$("#minimize").click(function() {
    ipc.send("minimize");
});

$("#authenticate").click(function() {
  reddit.helloworld();
});