const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
	onFileSelected: (callback) => {
		ipcRenderer.on('file-selected', (event, filePath) => {
			callback(filePath);
		});
	},
	getAppVersion: () => ipcRenderer.invoke('get-app-version'),
	getAppMeta: () => ipcRenderer.invoke('get-app-meta')
});
