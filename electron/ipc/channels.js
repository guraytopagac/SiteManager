// The only place channel names are written. Handlers and preload both import from here.
// Groups are in alphabetical order, and a group name matches its prefix and module folder.
const CHANNELS = {
  APARTMENT: {
    ADD: "apartment:add",
    UPDATE: "apartment:update",
    DELETE: "apartment:delete",
    BULK_UPDATE_DUE_AMOUNT: "apartment:bulk-update-due-amount",
  },

  AUTH: {
    LOGIN: "auth:login",
    CHANGE_PASSWORD: "auth:change-password",
    UPDATE_EMAIL: "auth:update-email",
    TRANSFER_ACCOUNT: "auth:transfer-account",
    RESET_ACCOUNT_PASSWORD: "auth:reset-account-password",
    VERIFY_RECOVERY_CODE: "auth:verify-recovery-code",
    REGENERATE_RECOVERY_CODE: "auth:regenerate-recovery-code",
    GET_SETUP_STATE: "auth:get-setup-state",
    COMPLETE_SETUP: "auth:complete-setup",
  },

  BACKUP: {
    RUN: "backup:run",
    RESTORE_ON_SETUP: "backup:restore-on-setup",
  },

  BUILDING: {
    LIST: "building:list",
    CREATE: "building:create",
    RENAME: "building:rename",
    UPDATE_STATUS: "building:update-status",
    REMOVE: "building:remove",
  },

  CASHBOOK: {
    ADD_INCOME: "cashbook:add-income",
    ADD_EXPENSE: "cashbook:add-expense",
    GET_TRANSACTIONS: "cashbook:get-transactions",
    CANCEL_INCOME: "cashbook:cancel-income",
    CANCEL_EXPENSE: "cashbook:cancel-expense",
    ADD_TRANSFER: "cashbook:add-transfer",
    CANCEL_TRANSFER: "cashbook:cancel-transfer",
    GET_DOCUMENT: "cashbook:get-document",
    SAVE_DOCUMENT_INFO: "cashbook:save-document-info",
  },

  DASHBOARD: {
    GET_STATS: "dashboard:get-stats",
  },

  DUES: {
    GET_FOR_MONTH: "dues:get-for-month",
    RECORD_PAYMENT: "dues:record-payment",
    CANCEL_PAYMENT: "dues:cancel-payment",
    GET_PAYMENT_HISTORY: "dues:get-payment-history",
    ATTACH_RECEIPT: "dues:attach-receipt",
    OPEN_RECEIPT: "dues:open-receipt",
  },

  EVENTS: {
    TOGGLE_THEME: "events:toggle-theme",
  },

  INVESTMENT: {
    GET_OVERVIEW: "investment:get-overview",
    SETUP_FUND: "investment:setup-fund",
    UPDATE_FUND: "investment:update-fund",
  },

  REPORT: {
    GET_DATA: "report:get-data",
    SAVE_FILE: "report:save-file",
  },

  RESIDENT: {
    GET_OVERVIEW: "resident:get-overview",
    GET_HISTORY: "resident:get-history",
    ADD: "resident:add",
    UPDATE: "resident:update",
    MOVE_OUT: "resident:move-out",
    UPDATE_MOVE_OUT: "resident:update-move-out",
    CANCEL_MOVE_OUT: "resident:cancel-move-out",
  },

  STAFF: {
    GET_OVERVIEW: "staff:get-overview",
    GET_EMPLOYEES: "staff:get-employees",
    SETUP_FUND: "staff:setup-fund",
    UPDATE_FUND: "staff:update-fund",
    ADD_EMPLOYEE: "staff:add-employee",
    UPDATE_EMPLOYEE: "staff:update-employee",
    DELETE_EMPLOYEE: "staff:delete-employee",
    RECORD_PAYOUT: "staff:record-payout",
    CANCEL_PAYOUT: "staff:cancel-payout",
  },

  SYSTEM: {
    GET_APP_VERSION: "system:get-app-version",
  },
};

// A repeated value would quietly overwrite a handler, so it fails at startup instead.
const allChannelValues = Object.values(CHANNELS).flatMap(Object.values);
if (new Set(allChannelValues).size !== allChannelValues.length)
  throw new Error("channels.js: duplicate channel value detected");

// Used only by preload, so an event channel cannot be invoked and an invoke channel cannot be listened to.
const EVENT_CHANNELS = new Set(Object.values(CHANNELS.EVENTS));
const INVOKE_CHANNELS = new Set(allChannelValues.filter((channel) => !EVENT_CHANNELS.has(channel)));

for (const group of Object.values(CHANNELS)) Object.freeze(group);
Object.freeze(CHANNELS);

module.exports = { CHANNELS, EVENT_CHANNELS, INVOKE_CHANNELS };
