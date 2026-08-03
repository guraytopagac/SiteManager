const { contextBridge, ipcRenderer } = require("electron");
const CH = require("./ipc/channels");

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
  deleteApartment: (id, buildingId) => safeInvoke(CH.APARTMENT.DELETE, { id, buildingId }),
  bulkUpdateDueAmount: (buildingId, amount) => safeInvoke(CH.APARTMENT.BULK_UPDATE_DUE_AMOUNT, { buildingId, amount }),

  // Auth
  login: (credentials) => safeInvoke(CH.AUTH.LOGIN, credentials),
  transferAccount: ({ userId, password, newPerson }) =>
    safeInvoke(CH.AUTH.TRANSFER_ACCOUNT, { userId, password, newPerson }),
  changePassword: ({ userId, oldPassword, newPassword }) =>
    safeInvoke(CH.AUTH.CHANGE_PASSWORD, { userId, oldPassword, newPassword }),
  updateEmail: ({ userId, email }) => safeInvoke(CH.AUTH.UPDATE_EMAIL, { userId, email }),
  resetAccountPassword: ({ recoveryCode, newPassword }) =>
    safeInvoke(CH.AUTH.RESET_ACCOUNT_PASSWORD, { recoveryCode, newPassword }),
  verifyRecoveryCode: (recoveryCode) => safeInvoke(CH.AUTH.VERIFY_RECOVERY_CODE, { recoveryCode }),
  regenerateRecoveryCode: (password) => safeInvoke(CH.AUTH.REGENERATE_RECOVERY_CODE, { password }),
  getSetupState: () => safeInvoke(CH.AUTH.GET_SETUP_STATE),
  completeSetup: ({ username, password, managerName }) =>
    safeInvoke(CH.AUTH.COMPLETE_SETUP, { username, password, managerName }),

  // Backup
  runBackup: () => safeInvoke(CH.BACKUP.RUN),
  getBackupStatus: () => safeInvoke(CH.BACKUP.GET_STATUS),

  // Building
  listBuildings: (ownerId) => safeInvoke(CH.BUILDING.LIST, ownerId),
  createBuilding: ({ ownerId, name }) => safeInvoke(CH.BUILDING.CREATE, { ownerId, name }),
  renameBuilding: ({ buildingId, ownerId, name }) => safeInvoke(CH.BUILDING.RENAME, { buildingId, ownerId, name }),
  updateBuildingStatus: ({ buildingId, ownerId, isActive }) =>
    safeInvoke(CH.BUILDING.UPDATE_STATUS, { buildingId, ownerId, isActive }),
  removeBuilding: ({ buildingId, ownerId }) => safeInvoke(CH.BUILDING.REMOVE, { buildingId, ownerId }),

  // Dashboard
  getStats: (buildingId) => safeInvoke(CH.DASHBOARD.GET_STATS, buildingId),

  // Dues
  getDuesForMonth: (buildingId, year, month) => safeInvoke(CH.DUES.GET_FOR_MONTH, { buildingId, year, month }),
  recordPayment: ({ apartmentId, buildingId, year, month, paymentData }) =>
    safeInvoke(CH.DUES.RECORD_PAYMENT, { apartmentId, buildingId, year, month, paymentData }),
  cancelPayment: ({ paymentId, buildingId, userId, reason }) =>
    safeInvoke(CH.DUES.CANCEL_PAYMENT, { paymentId, buildingId, userId, reason }),
  getPaymentHistory: (dueId, buildingId) => safeInvoke(CH.DUES.GET_PAYMENT_HISTORY, { dueId, buildingId }),

  // Financial
  addIncome: (data) => safeInvoke(CH.FINANCIAL.ADD_INCOME, data),
  addExpense: (data) => safeInvoke(CH.FINANCIAL.ADD_EXPENSE, data),
  getTransactions: (buildingId, period) => safeInvoke(CH.FINANCIAL.GET_TRANSACTIONS, buildingId, period),
  cancelIncome: ({ id, buildingId, userId, reason }) =>
    safeInvoke(CH.FINANCIAL.CANCEL_INCOME, { id, buildingId, userId, reason }),
  cancelExpense: ({ id, buildingId, userId, reason }) =>
    safeInvoke(CH.FINANCIAL.CANCEL_EXPENSE, { id, buildingId, userId, reason }),

  // Resident
  getResidentsOverview: (buildingId) => safeInvoke(CH.RESIDENT.GET_OVERVIEW, buildingId),
  getResidentHistory: (apartmentId, buildingId) => safeInvoke(CH.RESIDENT.GET_HISTORY, { apartmentId, buildingId }),
  addResident: (data) => safeInvoke(CH.RESIDENT.ADD, data),
  updateResident: (data) => safeInvoke(CH.RESIDENT.UPDATE, data),
  moveOutResident: ({ residentId, buildingId, moveOutDate }) =>
    safeInvoke(CH.RESIDENT.MOVE_OUT, { residentId, buildingId, moveOutDate }),

  // System
  getAppVersion: () => safeInvoke(CH.SYSTEM.GET_APP_VERSION),

  // Reports
  getReportData: (buildingId, year, month) => safeInvoke(CH.REPORTS.GET_DATA, { buildingId, year, month }),
  saveReportFile: (filename, buffer) => safeInvoke(CH.REPORTS.SAVE_FILE, { filename, buffer }),

  // Events
  onToggleTheme: (callback) => safeOn(CH.EVENTS.TOGGLE_THEME, callback),
});
