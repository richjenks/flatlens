const { app, BrowserWindow, Menu, ipcMain, globalShortcut } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development';
const fs = require('fs');

let mainWindow;

// Create the browser window
function createWindow() {
	mainWindow = new BrowserWindow({
		width: 1200,
		height: 800,
		minWidth: 800,
		minHeight: 600,
		webPreferences: {
			nodeIntegration: false,
			contextIsolation: true,
			enableRemoteModule: false,
			webSecurity: true,
			preload: path.join(__dirname, 'preload.js')
		},
		icon: path.join(__dirname, '../assets/icon.png'),
		titleBarStyle: 'default',
		show: false // Don't show until ready
	});

	// Load the app
	if (isDev) {
		// In development, load from Vite dev server
		mainWindow.loadURL('http://localhost:5173');
		mainWindow.webContents.openDevTools();
	} else {
		// In production, load the built files
		mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
	}

	// Show window when ready to prevent visual flash
	mainWindow.once('ready-to-show', () => {
		mainWindow.show();
	});

	// Handle window closed
	mainWindow.on('closed', () => {
		mainWindow = null;
	});

	// Handle file opening (drag & drop, double-click)
	mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
		// Prevent navigation to external URLs
		event.preventDefault();
	});
}

// Create menu
function createMenu() {
	const template = [{
		label: app.name,
		submenu: [
			{ role: 'quit' }
		]
	}];
	const menu = Menu.buildFromTemplate(template);
	Menu.setApplicationMenu(menu);
}

// App event handlers
app.whenReady().then(() => {
	createWindow();
	createMenu();
	
	// Register F12 to toggle dev tools
	globalShortcut.register('F12', () => {
		const focusedWindow = BrowserWindow.getFocusedWindow();
		if (focusedWindow) {
			focusedWindow.webContents.toggleDevTools();
		}
	});

	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length === 0) {
			createWindow();
		}
	});
});

// Unregister shortcuts when the app is about to quit
app.on('will-quit', () => {
	globalShortcut.unregisterAll();
});
app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit();
	}
});

// Handle file opening from command line or drag & drop
app.on('open-file', (event, filePath) => {
	event.preventDefault();
	if (mainWindow) {
		mainWindow.webContents.send('file-selected', filePath);
	}
});

// IPC handlers for communication with renderer process
ipcMain.handle('get-app-version', () => {
	return app.getVersion();
});
ipcMain.handle('get-app-meta', () => {
	try {
		const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8'));
		return { name: pkg.name, description: pkg.description };
	} catch (e) {
		return { name: 'App', description: '' };
	}
});
