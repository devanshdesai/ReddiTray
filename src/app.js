var ipc = require("electron").ipcRenderer;

$("#quit").click(function() {
  ipc.send("quit");
})

$("#minimize").click(function() {
    ipc.send("minimize");
})