// Libraries
const { contextBridge, ipcRenderer } = require("electron");

// API
contextBridge.exposeInMainWorld("electronAPI", {
  onToggleTheme: (callback) => {
    ipcRenderer.on("toggle-theme", callback);
    return () => {
      ipcRenderer.removeListener("toggle-theme", callback);
    };
  },
  login: (credentials) => ipcRenderer.invoke("login", credentials),
  getStats: (managerId) => ipcRenderer.invoke("get-stats", managerId),
  addApartment: (apartmentData) => ipcRenderer.invoke("add-apartment", apartmentData),
  getApartments: (userId) => ipcRenderer.invoke("get-apartments", userId),
  addIncome: (data) => ipcRenderer.invoke("add-income", data),
  addExpense: (data) => ipcRenderer.invoke("add-expense", data),
  getManagers: () => ipcRenderer.invoke("get-managers"),
  createManager: (data) => ipcRenderer.invoke("create-manager", data),
  updateManagerStatus: (id, isActive) => ipcRenderer.invoke("update-manager-status", { id, isActive }),
});
