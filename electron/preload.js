// Libraries
const { contextBridge, ipcRenderer } = require("electron");

// API
contextBridge.exposeInMainWorld("electronAPI", {
  addApartment: (apartmentData) => ipcRenderer.invoke("add-apartment", apartmentData),
  getApartments: (userId) => ipcRenderer.invoke("get-apartments", userId),
  updateApartment: (id, data) => ipcRenderer.invoke("update-apartment", { id, data }),
  deleteApartment: (id) => ipcRenderer.invoke("delete-apartment", id),
  bulkUpdateDueAmount: (managerId, amount) => ipcRenderer.invoke("bulk-update-due-amount", { managerId, amount }),

  login: (credentials) => ipcRenderer.invoke("login", credentials),
  getManagers: () => ipcRenderer.invoke("get-managers"),
  createManager: (data) => ipcRenderer.invoke("create-manager", data),
  updateManagerStatus: (id, isActive) => ipcRenderer.invoke("update-manager-status", { id, isActive }),
  changePassword: (userId, oldPassword, newPassword) =>
    ipcRenderer.invoke("change-password", { userId, oldPassword, newPassword }),

  getStats: (managerId) => ipcRenderer.invoke("get-stats", managerId),

  getDuesForMonth: (managerId, year, month) => ipcRenderer.invoke("get-dues-for-month", { managerId, year, month }),
  recordPayment: (dueId, paymentData) => ipcRenderer.invoke("record-payment", { dueId, paymentData }),
  cancelPayment: (paymentId, reason) => ipcRenderer.invoke("cancel-payment", { paymentId, reason }),
  getPaymentHistory: (dueId) => ipcRenderer.invoke("get-payment-history", { dueId }),

  addIncome: (data) => ipcRenderer.invoke("add-income", data),
  addExpense: (data) => ipcRenderer.invoke("add-expense", data),
  getTransactions: (managerId) => ipcRenderer.invoke("get-transactions", managerId),

  backupDatabase: () => ipcRenderer.invoke("backup-database"),
  restoreDatabase: () => ipcRenderer.invoke("restore-database"),

  onToggleTheme: (callback) => {
    ipcRenderer.on("toggle-theme", callback);
    return () => {
      ipcRenderer.removeListener("toggle-theme", callback);
    };
  },
});
