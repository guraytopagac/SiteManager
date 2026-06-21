// Libraries
const { contextBridge, ipcRenderer } = require("electron");

// API
contextBridge.exposeInMainWorld("electronAPI", {
  // Apartment
  addApartment: (apartmentData) => ipcRenderer.invoke("add-apartment", apartmentData),
  getApartments: (userId) => ipcRenderer.invoke("get-apartments", userId),
  updateApartment: (id, data) => ipcRenderer.invoke("update-apartment", { id, data }),
  deleteApartment: (id) => ipcRenderer.invoke("delete-apartment", id),
  bulkUpdateDueAmount: (managerId, amount) => ipcRenderer.invoke("bulk-update-due-amount", { managerId, amount }),

  // Auth
  login: (credentials) => ipcRenderer.invoke("login", credentials),
  getManagers: () => ipcRenderer.invoke("get-managers"),
  createManager: (data) => ipcRenderer.invoke("create-manager", data),
  updateManagerStatus: (id, isActive) => ipcRenderer.invoke("update-manager-status", { id, isActive }),
  changePassword: (userId, oldPassword, newPassword) =>
    ipcRenderer.invoke("change-password", { userId, oldPassword, newPassword }),

  // Dashboard
  getStats: (managerId) => ipcRenderer.invoke("get-stats", managerId),

  // Dues
  getDuesForMonth: (managerId, year, month) => ipcRenderer.invoke("get-dues-for-month", { managerId, year, month }),
  recordPayment: (dueId, paymentData) => ipcRenderer.invoke("record-payment", { dueId, paymentData }),
  cancelPayment: (paymentId, reason) => ipcRenderer.invoke("cancel-payment", { paymentId, reason }),
  getPaymentHistory: (dueId) => ipcRenderer.invoke("get-payment-history", { dueId }),

  // Financial
  addIncome: (data) => ipcRenderer.invoke("add-income", data),
  addExpense: (data) => ipcRenderer.invoke("add-expense", data),
  getTransactions: (managerId) => ipcRenderer.invoke("get-transactions", managerId),

  // Database
  backupDatabase: () => ipcRenderer.invoke("backup-database"),
  restoreDatabase: () => ipcRenderer.invoke("restore-database"),

  // Reports
  getReportData: (managerId, year, month) => ipcRenderer.invoke("get-report-data", { managerId, year, month }),
  saveReportFile: (filename, buffer) => ipcRenderer.invoke("save-report-file", { filename, buffer }),

  // Events
  onToggleTheme: (callback) => {
    ipcRenderer.removeAllListeners("toggle-theme");
    ipcRenderer.on("toggle-theme", callback);
    return () => {
      ipcRenderer.removeListener("toggle-theme", callback);
    };
  },
});
