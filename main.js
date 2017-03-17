const {
	app,
	Menu,
	Tray
} = require("electron");
var menubar = require('menubar'),
	mb = menubar({
		preloadWindow: true,
		width: 300,
		height: 500,
		tooltip: "You have 0 unread messages.",
		icon: "ReddiTray/src/img/default@2x.png"
	}),
	ipc = require("electron").ipcMain;

mb.on('ready', function ready() {
	console.log('app is ready')
	var tray = mb.tray;
	const contextMenu = Menu.buildFromTemplate([{
		label: 'Sync frequency',
		role: 'sync'
	}, {
		label: 'Quit',
		role: 'quit'
	}, ]);
	tray.setContextMenu(contextMenu);
});

ipc.on("white_icon", function() {
	mb.icon = "ReddiTray/src/img/default@2x.png";
});

ipc.on("orange_icon", function() {
	mb.icon = "ReddiTray/src/img/new_notif@2x.png";
});

ipc.on("quit", function() {
	mb.app.quit();
});

ipc.on("minimize", function() {
	mb.hideWindow();
})
