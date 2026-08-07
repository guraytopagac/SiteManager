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
  },

  BUILDING: {
    LIST: "building:list",
    CREATE: "building:create",
    RENAME: "building:rename",
    UPDATE_STATUS: "building:update-status",
    REMOVE: "building:remove",
  },

  DASHBOARD: {
    GET_STATS: "dashboard:get-stats",
  },

  DUES: {
    GET_FOR_MONTH: "dues:get-for-month",
    RECORD_PAYMENT: "dues:record-payment",
    CANCEL_PAYMENT: "dues:cancel-payment",
    GET_PAYMENT_HISTORY: "dues:get-payment-history",
  },

  EVENTS: {
    TOGGLE_THEME: "events:toggle-theme",
  },

  FINANCIAL: {
    ADD_INCOME: "financial:add-income",
    ADD_EXPENSE: "financial:add-expense",
    GET_TRANSACTIONS: "financial:get-transactions",
    CANCEL_INCOME: "financial:cancel-income",
    CANCEL_EXPENSE: "financial:cancel-expense",
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
  },

  SYSTEM: {
    GET_APP_VERSION: "system:get-app-version",
  },
};

const allChannelValues = Object.values(CHANNELS).flatMap(Object.values);
if (new Set(allChannelValues).size !== allChannelValues.length)
  throw new Error("channels.js: duplicate channel value detected");

const EVENT_CHANNELS = new Set(Object.values(CHANNELS.EVENTS));
const INVOKE_CHANNELS = new Set(allChannelValues.filter((channel) => !EVENT_CHANNELS.has(channel)));

for (const group of Object.values(CHANNELS)) Object.freeze(group);
Object.freeze(CHANNELS);

module.exports = { CHANNELS, EVENT_CHANNELS, INVOKE_CHANNELS };
