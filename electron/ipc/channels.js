const CHANNELS = Object.freeze({
  APARTMENT: Object.freeze({
    ADD: "apartment:add",
    UPDATE: "apartment:update",
    DELETE: "apartment:delete",
    BULK_UPDATE_DUE_AMOUNT: "apartment:bulk-update-due-amount",
  }),

  AUTH: Object.freeze({
    LOGIN: "auth:login",
    GET_MANAGERS: "auth:get-managers",
    CREATE_MANAGER: "auth:create-manager",
    UPDATE_MANAGER_STATUS: "auth:update-manager-status",
    CHANGE_PASSWORD: "auth:change-password",
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

  FINANCIAL: Object.freeze({
    ADD_INCOME: "financial:add-income",
    ADD_EXPENSE: "financial:add-expense",
    GET_TRANSACTIONS: "financial:get-transactions",
    CANCEL_INCOME: "financial:cancel-income",
    CANCEL_EXPENSE: "financial:cancel-expense",
  }),

  SYSTEM: Object.freeze({
    GET_APP_VERSION: "system:get-app-version",
  }),

  REPORTS: Object.freeze({
    GET_DATA: "reports:get-data",
    SAVE_FILE: "reports:save-file",
  }),

  EVENTS: Object.freeze({
    TOGGLE_THEME: "events:toggle-theme",
    PREFILL_LOGIN: "events:prefill-login",
  }),
});

// Duplicate channel value detection — catches typos at startup
const allValues = Object.values(CHANNELS).flatMap(Object.values);
const uniqueValues = new Set(allValues);
if (uniqueValues.size !== allValues.length) throw new Error("channels.js: duplicate channel value detected");

module.exports = CHANNELS;
