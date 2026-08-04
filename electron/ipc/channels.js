const CHANNELS = {
  APARTMENT: Object.freeze({
    ADD: "apartment:add",
    UPDATE: "apartment:update",
    DELETE: "apartment:delete",
    BULK_UPDATE_DUE_AMOUNT: "apartment:bulk-update-due-amount",
  }),

  AUTH: Object.freeze({
    LOGIN: "auth:login",
    CHANGE_PASSWORD: "auth:change-password",
    UPDATE_EMAIL: "auth:update-email",
    TRANSFER_ACCOUNT: "auth:transfer-account",
    RESET_ACCOUNT_PASSWORD: "auth:reset-account-password",
    VERIFY_RECOVERY_CODE: "auth:verify-recovery-code",
    REGENERATE_RECOVERY_CODE: "auth:regenerate-recovery-code",
    GET_SETUP_STATE: "auth:get-setup-state",
    COMPLETE_SETUP: "auth:complete-setup",
  }),

  BACKUP: Object.freeze({
    RUN: "backup:run",
    GET_STATUS: "backup:get-status",
  }),

  BUILDING: Object.freeze({
    LIST: "building:list",
    CREATE: "building:create",
    RENAME: "building:rename",
    UPDATE_STATUS: "building:update-status",
    REMOVE: "building:remove",
  }),

  DASHBOARD: Object.freeze({
    GET_STATS: "dashboard:get-stats",
  }),

  DUES: Object.freeze({
    GET_FOR_MONTH: "dues:get-for-month",
    RECORD_PAYMENT: "dues:record-payment",
    CANCEL_PAYMENT: "dues:cancel-payment",
    GET_PAYMENT_HISTORY: "dues:get-payment-history",
  }),

  EVENTS: Object.freeze({
    TOGGLE_THEME: "events:toggle-theme",
  }),

  FINANCIAL: Object.freeze({
    ADD_INCOME: "financial:add-income",
    ADD_EXPENSE: "financial:add-expense",
    GET_TRANSACTIONS: "financial:get-transactions",
    CANCEL_INCOME: "financial:cancel-income",
    CANCEL_EXPENSE: "financial:cancel-expense",
  }),

  REPORTS: Object.freeze({
    GET_DATA: "reports:get-data",
    SAVE_FILE: "reports:save-file",
  }),

  RESIDENT: Object.freeze({
    GET_OVERVIEW: "resident:get-overview",
    GET_HISTORY: "resident:get-history",
    ADD: "resident:add",
    UPDATE: "resident:update",
    MOVE_OUT: "resident:move-out",
  }),

  SYSTEM: Object.freeze({
    GET_APP_VERSION: "system:get-app-version",
  }),
};

const allChannelValues = Object.values(CHANNELS).flatMap(Object.values);
const uniqueChannelValues = new Set(allChannelValues);
if (uniqueChannelValues.size !== allChannelValues.length)
  throw new Error("channels.js: duplicate channel value detected");

const EVENT_CHANNELS = new Set(Object.values(CHANNELS.EVENTS));
const INVOKE_CHANNELS = new Set(allChannelValues.filter((channel) => !EVENT_CHANNELS.has(channel)));

Object.freeze(CHANNELS);

module.exports = { CHANNELS, EVENT_CHANNELS, INVOKE_CHANNELS };
