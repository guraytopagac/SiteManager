const { contextBridge, ipcRenderer } = require("electron");
const CH = require("./ipc/channels");

// Whitelist of all permitted IPC channels
const ALLOWED_CHANNELS = new Set(Object.values(CH).flatMap(Object.values));

function safeInvoke(channel, ...args) {
  if (!ALLOWED_CHANNELS.has(channel)) throw new Error(`Blocked IPC channel: ${channel}`);
  return ipcRenderer.invoke(channel, ...args);
}

function safeOn(channel, callback) {
  if (!ALLOWED_CHANNELS.has(channel)) throw new Error(`Blocked IPC channel: ${channel}`);
  if (typeof callback !== "function") throw new TypeError(`safeOn: callback must be a function`);
  const wrapper = (event, ...args) => callback(...args);
  ipcRenderer.on(channel, wrapper);
  return () => ipcRenderer.removeListener(channel, wrapper);
}

contextBridge.exposeInMainWorld("electronAPI", {
  // Apartment
  addApartment: (apartmentData) => safeInvoke(CH.APARTMENT.ADD, apartmentData),
  updateApartment: (id, data) => safeInvoke(CH.APARTMENT.UPDATE, { id, data }),
  deleteApartment: (id, managerId) => safeInvoke(CH.APARTMENT.DELETE, { id, managerId }),
  bulkUpdateDueAmount: (managerId, amount) => safeInvoke(CH.APARTMENT.BULK_UPDATE_DUE_AMOUNT, { managerId, amount }),

  // Auth
  login: (credentials) => safeInvoke(CH.AUTH.LOGIN, credentials),
  getManagers: () => safeInvoke(CH.AUTH.GET_MANAGERS),
  createManager: (data) => safeInvoke(CH.AUTH.CREATE_MANAGER, data),
  updateManagerStatus: (id, isActive) => safeInvoke(CH.AUTH.UPDATE_MANAGER_STATUS, { id, isActive }),
  changePassword: (userId, oldPassword, newPassword) =>
    safeInvoke(CH.AUTH.CHANGE_PASSWORD, { userId, oldPassword, newPassword }),

  // Dashboard
  getStats: (managerId) => safeInvoke(CH.DASHBOARD.GET_STATS, managerId),

  // Dues
  getDuesForMonth: (managerId, year, month) => safeInvoke(CH.DUES.GET_FOR_MONTH, { managerId, year, month }),
  recordPayment: ({ apartmentId, year, month, paymentData }) =>
    safeInvoke(CH.DUES.RECORD_PAYMENT, { apartmentId, year, month, paymentData }),
  cancelPayment: (paymentId, userId, reason) => safeInvoke(CH.DUES.CANCEL_PAYMENT, { paymentId, userId, reason }),
  getPaymentHistory: (dueId) => safeInvoke(CH.DUES.GET_PAYMENT_HISTORY, { dueId }),

  // Financial
  addIncome: (data) => safeInvoke(CH.FINANCIAL.ADD_INCOME, data),
  addExpense: (data) => safeInvoke(CH.FINANCIAL.ADD_EXPENSE, data),
  getTransactions: (managerId) => safeInvoke(CH.FINANCIAL.GET_TRANSACTIONS, { managerId }),
  cancelIncome: ({ id, userId, reason }) => safeInvoke(CH.FINANCIAL.CANCEL_INCOME, { id, userId, reason }),
  cancelExpense: ({ id, userId, reason }) => safeInvoke(CH.FINANCIAL.CANCEL_EXPENSE, { id, userId, reason }),

  // System
  getAppVersion: () => safeInvoke(CH.SYSTEM.GET_APP_VERSION),

  // Reports
  getReportData: (managerId, year, month) => safeInvoke(CH.REPORTS.GET_DATA, { managerId, year, month }),
  saveReportFile: (filename, buffer) => safeInvoke(CH.REPORTS.SAVE_FILE, { filename, buffer }),

  // Events
  onToggleTheme: (callback) => safeOn(CH.EVENTS.TOGGLE_THEME, callback),
  onPrefillLogin: (callback) => safeOn(CH.EVENTS.PREFILL_LOGIN, callback),
});
