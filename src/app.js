var ipc = require("electron").ipcRenderer,
    Snoocore = require("snoocore");

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
  
$(document).ready(function () {
  

});


$("#quit").click(function() {
  ipc.send("quit");
})

$("#minimize").click(function() {
    ipc.send("minimize");
})