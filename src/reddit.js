var Snoocore = require("snoocore"),
    events = require("events"),
    persist = require("node-persist");
const {
    shell
} = require("electron");

exports.ready = new events.EventEmitter();

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

exports.helloworld = function() {
    console.log("helloworld");
};