// Libraries
const { contextBridge, ipcRenderer } = require('electron');

// API
contextBridge.exposeInMainWorld('electronAPI', {
    login: (credentials) => ipcRenderer.invoke('login', credentials),
    register: (userData) => ipcRenderer.invoke('register', userData),
    addApartment: (apartmentData) => ipcRenderer.invoke('add-apartment', apartmentData),
    getStats: () => ipcRenderer.invoke('get-stats'),
    getApartments: () => ipcRenderer.invoke('get-apartments'),
    onToggleTheme: (callback) => ipcRenderer.on('toggle-theme', callback)
});
