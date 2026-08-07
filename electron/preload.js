const { contextBridge, ipcRenderer } = require("electron");
const { CHANNELS: CH, EVENT_CHANNELS, INVOKE_CHANNELS } = require("./ipc/channels");

function safeInvoke(channel, payload) {
  if (!INVOKE_CHANNELS.has(channel)) throw new Error(`Blocked IPC channel: ${channel}`);
  return ipcRenderer.invoke(channel, payload);
}

function safeOn(channel, callback) {
  if (!EVENT_CHANNELS.has(channel)) throw new Error(`Blocked IPC channel: ${channel}`);
  if (typeof callback !== "function") throw new TypeError("safeOn: callback must be a function");
  const wrapper = (event, ...args) => callback(...args);
  ipcRenderer.on(channel, wrapper);
  return () => ipcRenderer.removeListener(channel, wrapper);
}

contextBridge.exposeInMainWorld("electronAPI", {
  // Apartment
  addApartment: (payload) => safeInvoke(CH.APARTMENT.ADD, payload),
  updateApartment: (payload) => safeInvoke(CH.APARTMENT.UPDATE, payload),
  deleteApartment: (payload) => safeInvoke(CH.APARTMENT.DELETE, payload),
  bulkUpdateDueAmount: (payload) => safeInvoke(CH.APARTMENT.BULK_UPDATE_DUE_AMOUNT, payload),

  // Auth
  login: (payload) => safeInvoke(CH.AUTH.LOGIN, payload),
  changePassword: (payload) => safeInvoke(CH.AUTH.CHANGE_PASSWORD, payload),
  updateEmail: (payload) => safeInvoke(CH.AUTH.UPDATE_EMAIL, payload),
  transferAccount: (payload) => safeInvoke(CH.AUTH.TRANSFER_ACCOUNT, payload),
  resetAccountPassword: (payload) => safeInvoke(CH.AUTH.RESET_ACCOUNT_PASSWORD, payload),
  verifyRecoveryCode: (payload) => safeInvoke(CH.AUTH.VERIFY_RECOVERY_CODE, payload),
  regenerateRecoveryCode: (payload) => safeInvoke(CH.AUTH.REGENERATE_RECOVERY_CODE, payload),
  getSetupState: () => safeInvoke(CH.AUTH.GET_SETUP_STATE),
  completeSetup: (payload) => safeInvoke(CH.AUTH.COMPLETE_SETUP, payload),

  // Backup
  runBackup: () => safeInvoke(CH.BACKUP.RUN),

  // Building
  listBuildings: (payload) => safeInvoke(CH.BUILDING.LIST, payload),
  createBuilding: (payload) => safeInvoke(CH.BUILDING.CREATE, payload),
  renameBuilding: (payload) => safeInvoke(CH.BUILDING.RENAME, payload),
  updateBuildingStatus: (payload) => safeInvoke(CH.BUILDING.UPDATE_STATUS, payload),
  removeBuilding: (payload) => safeInvoke(CH.BUILDING.REMOVE, payload),

  // Dashboard
  getStats: (payload) => safeInvoke(CH.DASHBOARD.GET_STATS, payload),

  // Dues
  getDuesForMonth: (payload) => safeInvoke(CH.DUES.GET_FOR_MONTH, payload),
  recordPayment: (payload) => safeInvoke(CH.DUES.RECORD_PAYMENT, payload),
  cancelPayment: (payload) => safeInvoke(CH.DUES.CANCEL_PAYMENT, payload),
  getPaymentHistory: (payload) => safeInvoke(CH.DUES.GET_PAYMENT_HISTORY, payload),

  // Events
  onToggleTheme: (callback) => safeOn(CH.EVENTS.TOGGLE_THEME, callback),

  // Financial
  addIncome: (payload) => safeInvoke(CH.FINANCIAL.ADD_INCOME, payload),
  addExpense: (payload) => safeInvoke(CH.FINANCIAL.ADD_EXPENSE, payload),
  getTransactions: (payload) => safeInvoke(CH.FINANCIAL.GET_TRANSACTIONS, payload),
  cancelIncome: (payload) => safeInvoke(CH.FINANCIAL.CANCEL_INCOME, payload),
  cancelExpense: (payload) => safeInvoke(CH.FINANCIAL.CANCEL_EXPENSE, payload),

  // Report
  getReportData: (payload) => safeInvoke(CH.REPORT.GET_DATA, payload),
  saveReportFile: (payload) => safeInvoke(CH.REPORT.SAVE_FILE, payload),

  // Resident
  getResidentsOverview: (payload) => safeInvoke(CH.RESIDENT.GET_OVERVIEW, payload),
  getResidentHistory: (payload) => safeInvoke(CH.RESIDENT.GET_HISTORY, payload),
  addResident: (payload) => safeInvoke(CH.RESIDENT.ADD, payload),
  updateResident: (payload) => safeInvoke(CH.RESIDENT.UPDATE, payload),
  moveOutResident: (payload) => safeInvoke(CH.RESIDENT.MOVE_OUT, payload),

  // System
  getAppVersion: () => safeInvoke(CH.SYSTEM.GET_APP_VERSION),
});
