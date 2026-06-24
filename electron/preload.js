const { contextBridge, ipcRenderer } = require("electron");

const CH = {
  APARTMENT: {
    ADD: "add-apartment",
    UPDATE: "update-apartment",
    DELETE: "delete-apartment",
    BULK_UPDATE_DUE_AMOUNT: "bulk-update-due-amount",
  },
  AUTH: {
    LOGIN: "login",
    GET_MANAGERS: "get-managers",
    CREATE_MANAGER: "create-manager",
    UPDATE_MANAGER_STATUS: "update-manager-status",
    CHANGE_PASSWORD: "change-password",
  },
  DASHBOARD: { GET_STATS: "get-stats" },
  DUES: {
    GET_FOR_MONTH: "get-dues-for-month",
    RECORD_PAYMENT: "record-payment",
    CANCEL_PAYMENT: "cancel-payment",
    GET_PAYMENT_HISTORY: "get-payment-history",
  },
  FINANCIAL: {
    ADD_INCOME: "add-income",
    ADD_EXPENSE: "add-expense",
    GET_TRANSACTIONS: "get-transactions",
    CANCEL_INCOME: "cancel-income",
    CANCEL_EXPENSE: "cancel-expense",
  },
  SYSTEM: { GET_APP_VERSION: "get-app-version" },
  REPORTS: { GET_DATA: "get-report-data", SAVE_FILE: "save-report-file" },
  EVENTS: { TOGGLE_THEME: "toggle-theme", PREFILL_LOGIN: "prefill-login" },
};

// Whitelist of all permitted IPC channels
const ALLOWED_CHANNELS = new Set(Object.values(CH).flatMap(Object.values));

function safeInvoke(channel, ...args) {
  if (!ALLOWED_CHANNELS.has(channel)) throw new Error(`Blocked IPC channel: ${channel}`);
  return ipcRenderer.invoke(channel, ...args);
}

function safeOn(channel, callback) {
  if (typeof callback !== "function") throw new TypeError(`safeOn: callback must be a function`);
  if (!ALLOWED_CHANNELS.has(channel)) throw new Error(`Blocked IPC channel: ${channel}`);
  ipcRenderer.on(channel, callback);
  return () => ipcRenderer.removeListener(channel, callback);
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
  changePassword: (userId, oldPassword, newPassword) => {
    if (typeof userId !== "number") throw new TypeError("changePassword: userId must be a number");
    if (typeof oldPassword !== "string" || typeof newPassword !== "string")
      throw new TypeError("changePassword: oldPassword and newPassword must be strings");
    return safeInvoke(CH.AUTH.CHANGE_PASSWORD, { userId, oldPassword, newPassword });
  },

  // Dashboard
  getStats: (managerId) => safeInvoke(CH.DASHBOARD.GET_STATS, managerId),

  // Dues
  getDuesForMonth: (managerId, year, month) => safeInvoke(CH.DUES.GET_FOR_MONTH, { managerId, year, month }),
  recordPayment: (dueId, paymentData) => {
    if (typeof dueId !== "number" || typeof paymentData !== "object" || paymentData === null)
      throw new TypeError("recordPayment: dueId must be a number and paymentData must be an object");
    return safeInvoke(CH.DUES.RECORD_PAYMENT, { dueId, paymentData });
  },
  cancelPayment: (paymentId, managerId, reason, cancelledBy) => {
    if (typeof paymentId !== "number" || typeof managerId !== "number")
      throw new TypeError("cancelPayment: paymentId and managerId must be numbers");
    if (typeof reason !== "string") throw new TypeError("cancelPayment: reason must be a string");
    if (typeof cancelledBy !== "number") throw new TypeError("cancelPayment: cancelledBy must be a number");
    return safeInvoke(CH.DUES.CANCEL_PAYMENT, { paymentId, managerId, reason, cancelledBy });
  },
  getPaymentHistory: (dueId) => safeInvoke(CH.DUES.GET_PAYMENT_HISTORY, { dueId }),

  // Financial
  addIncome: (data) => {
    if (typeof data !== "object" || data === null) throw new TypeError("addIncome: data must be an object");
    return safeInvoke(CH.FINANCIAL.ADD_INCOME, data);
  },
  addExpense: (data) => {
    if (typeof data !== "object" || data === null) throw new TypeError("addExpense: data must be an object");
    return safeInvoke(CH.FINANCIAL.ADD_EXPENSE, data);
  },
  getTransactions: (managerId, startDate, endDate) =>
    safeInvoke(CH.FINANCIAL.GET_TRANSACTIONS, { managerId, startDate, endDate }),
  cancelIncome: ({ id, managerId, reason, cancelledBy }) => {
    if (typeof id !== "number" || typeof reason !== "string")
      throw new TypeError("cancelIncome: id must be a number, reason must be a string");
    return safeInvoke(CH.FINANCIAL.CANCEL_INCOME, { id, managerId, reason, cancelledBy });
  },
  cancelExpense: ({ id, managerId, reason, cancelledBy }) => {
    if (typeof id !== "number" || typeof reason !== "string")
      throw new TypeError("cancelExpense: id must be a number, reason must be a string");
    return safeInvoke(CH.FINANCIAL.CANCEL_EXPENSE, { id, managerId, reason, cancelledBy });
  },

  // System
  getAppVersion: () => safeInvoke(CH.SYSTEM.GET_APP_VERSION),

  // Reports
  getReportData: (managerId, year, month) => safeInvoke(CH.REPORTS.GET_DATA, { managerId, year, month }),
  saveReportFile: (filename, buffer) => safeInvoke(CH.REPORTS.SAVE_FILE, { filename, buffer }),

  // Events
  onToggleTheme: (callback) => safeOn(CH.EVENTS.TOGGLE_THEME, callback),
  onPrefillLogin: (callback) => safeOn(CH.EVENTS.PREFILL_LOGIN, callback),
});
