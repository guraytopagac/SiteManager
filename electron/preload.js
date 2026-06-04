// Libraries
const { contextBridge, ipcRenderer } = require('electron');

// API
contextBridge.exposeInMainWorld('electronAPI', {
    onToggleTheme: (callback) => ipcRenderer.on('toggle-theme', callback),
    login: (credentials) => ipcRenderer.invoke('login', credentials),
    register: (userData) => ipcRenderer.invoke('register', userData),
    getStats: (managerId) => ipcRenderer.invoke('get-stats', managerId),
    addApartment: (apartmentData) => ipcRenderer.invoke('add-apartment', apartmentData),
    getApartments: (userId) => ipcRenderer.invoke('get-apartments', userId),
    addIncome: (data) => ipcRenderer.invoke('add-income', data),
});
