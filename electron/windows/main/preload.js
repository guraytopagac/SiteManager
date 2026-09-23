// The only bridge between the renderer and Node. A new feature needs a new channel here.
const { contextBridge, ipcRenderer } = require("electron");
const { CHANNELS: CH, EVENT_CHANNELS, INVOKE_CHANNELS } = require("../../ipc/channels");

// Request and answer. Only invoke channels pass, and the payload is sent on unchanged.
function safeInvoke(channel, payload) {
  if (!INVOKE_CHANNELS.has(channel)) throw new Error(`Blocked IPC channel: ${channel}`);
  return ipcRenderer.invoke(channel, payload);
}

// Only event channels pass. Returns an unsubscribe function for useEffect cleanup.
function safeOn(channel, callback) {
  if (!EVENT_CHANNELS.has(channel)) throw new Error(`Blocked IPC channel: ${channel}`);
  if (typeof callback !== "function") throw new TypeError("safeOn: callback must be a function");
  const wrapper = (event, ...args) => callback(...args);
  ipcRenderer.on(channel, wrapper);
  return () => ipcRenderer.removeListener(channel, wrapper);
}

// window.electronAPI. Every method takes no argument or one plain object.
contextBridge.exposeInMainWorld("electronAPI", {
  addApartment: (payload) => safeInvoke(CH.APARTMENT.ADD, payload),
  updateApartment: (payload) => safeInvoke(CH.APARTMENT.UPDATE, payload),
  deleteApartment: (payload) => safeInvoke(CH.APARTMENT.DELETE, payload),
  bulkUpdateDueAmount: (payload) => safeInvoke(CH.APARTMENT.BULK_UPDATE_DUE_AMOUNT, payload),

  login: (payload) => safeInvoke(CH.AUTH.LOGIN, payload),
  changePassword: (payload) => safeInvoke(CH.AUTH.CHANGE_PASSWORD, payload),
  updateEmail: (payload) => safeInvoke(CH.AUTH.UPDATE_EMAIL, payload),
  transferAccount: (payload) => safeInvoke(CH.AUTH.TRANSFER_ACCOUNT, payload),
  resetAccountPassword: (payload) => safeInvoke(CH.AUTH.RESET_ACCOUNT_PASSWORD, payload),
  verifyRecoveryCode: (payload) => safeInvoke(CH.AUTH.VERIFY_RECOVERY_CODE, payload),
  regenerateRecoveryCode: (payload) => safeInvoke(CH.AUTH.REGENERATE_RECOVERY_CODE, payload),
  getSetupState: () => safeInvoke(CH.AUTH.GET_SETUP_STATE),
  completeSetup: (payload) => safeInvoke(CH.AUTH.COMPLETE_SETUP, payload),

  runBackup: () => safeInvoke(CH.BACKUP.RUN),
  restoreOnSetup: () => safeInvoke(CH.BACKUP.RESTORE_ON_SETUP),

  listBuildings: (payload) => safeInvoke(CH.BUILDING.LIST, payload),
  createBuilding: (payload) => safeInvoke(CH.BUILDING.CREATE, payload),
  renameBuilding: (payload) => safeInvoke(CH.BUILDING.RENAME, payload),
  updateBuildingStatus: (payload) => safeInvoke(CH.BUILDING.UPDATE_STATUS, payload),
  removeBuilding: (payload) => safeInvoke(CH.BUILDING.REMOVE, payload),

  addIncome: (payload) => safeInvoke(CH.CASHBOOK.ADD_INCOME, payload),
  addExpense: (payload) => safeInvoke(CH.CASHBOOK.ADD_EXPENSE, payload),
  getTransactions: (payload) => safeInvoke(CH.CASHBOOK.GET_TRANSACTIONS, payload),
  cancelIncome: (payload) => safeInvoke(CH.CASHBOOK.CANCEL_INCOME, payload),
  cancelExpense: (payload) => safeInvoke(CH.CASHBOOK.CANCEL_EXPENSE, payload),
  addCashTransfer: (payload) => safeInvoke(CH.CASHBOOK.ADD_TRANSFER, payload),
  cancelCashTransfer: (payload) => safeInvoke(CH.CASHBOOK.CANCEL_TRANSFER, payload),
  getDocument: (payload) => safeInvoke(CH.CASHBOOK.GET_DOCUMENT, payload),
  saveDocumentInfo: (payload) => safeInvoke(CH.CASHBOOK.SAVE_DOCUMENT_INFO, payload),

  getStats: (payload) => safeInvoke(CH.DASHBOARD.GET_STATS, payload),

  getDuesForMonth: (payload) => safeInvoke(CH.DUES.GET_FOR_MONTH, payload),
  recordPayment: (payload) => safeInvoke(CH.DUES.RECORD_PAYMENT, payload),
  cancelPayment: (payload) => safeInvoke(CH.DUES.CANCEL_PAYMENT, payload),
  getPaymentHistory: (payload) => safeInvoke(CH.DUES.GET_PAYMENT_HISTORY, payload),
  attachReceipt: (payload) => safeInvoke(CH.DUES.ATTACH_RECEIPT, payload),
  openReceipt: (payload) => safeInvoke(CH.DUES.OPEN_RECEIPT, payload),

  onToggleTheme: (callback) => safeOn(CH.EVENTS.TOGGLE_THEME, callback),

  getInvestmentOverview: (payload) => safeInvoke(CH.INVESTMENT.GET_OVERVIEW, payload),
  setupInvestmentFund: (payload) => safeInvoke(CH.INVESTMENT.SETUP_FUND, payload),
  updateInvestmentFund: (payload) => safeInvoke(CH.INVESTMENT.UPDATE_FUND, payload),

  getReportData: (payload) => safeInvoke(CH.REPORT.GET_DATA, payload),
  saveReportFile: (payload) => safeInvoke(CH.REPORT.SAVE_FILE, payload),

  getResidentsOverview: (payload) => safeInvoke(CH.RESIDENT.GET_OVERVIEW, payload),
  getResidentHistory: (payload) => safeInvoke(CH.RESIDENT.GET_HISTORY, payload),
  addResident: (payload) => safeInvoke(CH.RESIDENT.ADD, payload),
  updateResident: (payload) => safeInvoke(CH.RESIDENT.UPDATE, payload),
  moveOutResident: (payload) => safeInvoke(CH.RESIDENT.MOVE_OUT, payload),
  updateScheduledMoveOut: (payload) => safeInvoke(CH.RESIDENT.UPDATE_MOVE_OUT, payload),
  cancelScheduledMoveOut: (payload) => safeInvoke(CH.RESIDENT.CANCEL_MOVE_OUT, payload),

  getStaffOverview: (payload) => safeInvoke(CH.STAFF.GET_OVERVIEW, payload),
  getEmployees: (payload) => safeInvoke(CH.STAFF.GET_EMPLOYEES, payload),
  setupSeveranceFund: (payload) => safeInvoke(CH.STAFF.SETUP_FUND, payload),
  updateSeveranceFund: (payload) => safeInvoke(CH.STAFF.UPDATE_FUND, payload),
  addEmployee: (payload) => safeInvoke(CH.STAFF.ADD_EMPLOYEE, payload),
  updateEmployee: (payload) => safeInvoke(CH.STAFF.UPDATE_EMPLOYEE, payload),
  deleteEmployee: (payload) => safeInvoke(CH.STAFF.DELETE_EMPLOYEE, payload),
  recordSeverancePayout: (payload) => safeInvoke(CH.STAFF.RECORD_PAYOUT, payload),
  cancelSeverancePayout: (payload) => safeInvoke(CH.STAFF.CANCEL_PAYOUT, payload),

  getAppVersion: () => safeInvoke(CH.SYSTEM.GET_APP_VERSION),
});
