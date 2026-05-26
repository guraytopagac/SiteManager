// Libraries
const { contextBridge, ipcRenderer } = require('electron');

// Part 1: Expose secure APIs to the renderer process for login, registration, and theme changes
contextBridge.exposeInMainWorld('electronAPI', {
    login: (credentials) => ipcRenderer.send('login', credentials),
    register: (userData) => ipcRenderer.send('register', userData),

    onLoginResponse: (callback) => {
        const subscription = (event, response) => callback(response);
        ipcRenderer.on('login-response', subscription);
        return () => ipcRenderer.removeListener('login-response', subscription);
    },
    onRegisterResponse: (callback) => {
        const subscription = (event, response) => callback(response);
        ipcRenderer.on('register-response', subscription);
        return () => ipcRenderer.removeListener('register-response', subscription);
    },
    onThemeChange: (callback) => {
        const subscription = (event, theme) => callback(theme);
        ipcRenderer.on('change-theme', subscription);
        return () => ipcRenderer.removeListener('change-theme', subscription);
    }
});