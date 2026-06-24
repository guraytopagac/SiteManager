const CHANNELS = Object.freeze({
  APARTMENT: Object.freeze({
    ADD: "add-apartment",
    UPDATE: "update-apartment",
    DELETE: "delete-apartment",
    BULK_UPDATE_DUE_AMOUNT: "bulk-update-due-amount",
  }),

  AUTH: Object.freeze({
    LOGIN: "login",
    GET_MANAGERS: "get-managers",
    CREATE_MANAGER: "create-manager",
    UPDATE_MANAGER_STATUS: "update-manager-status",
    CHANGE_PASSWORD: "change-password",
  }),

  DASHBOARD: Object.freeze({
    GET_STATS: "get-stats",
  }),

  DUES: Object.freeze({
    GET_FOR_MONTH: "get-dues-for-month",
    RECORD_PAYMENT: "record-payment",
    CANCEL_PAYMENT: "cancel-payment",
    GET_PAYMENT_HISTORY: "get-payment-history",
  }),

  FINANCIAL: Object.freeze({
    ADD_INCOME: "add-income",
    ADD_EXPENSE: "add-expense",
    GET_TRANSACTIONS: "get-transactions",
    CANCEL_INCOME: "cancel-income",
    CANCEL_EXPENSE: "cancel-expense",
  }),

  SYSTEM: Object.freeze({
    GET_APP_VERSION: "get-app-version",
  }),

  REPORTS: Object.freeze({
    GET_DATA: "get-report-data",
    SAVE_FILE: "save-report-file",
  }),

  EVENTS: Object.freeze({
    TOGGLE_THEME: "toggle-theme",
  }),
});

// Duplicate channel value detection — catches typos at startup
const allValues = Object.values(CHANNELS).flatMap(Object.values);
const uniqueValues = new Set(allValues);
if (uniqueValues.size !== allValues.length) throw new Error("channels.js: duplicate channel value detected");

module.exports = CHANNELS;
