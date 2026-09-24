const { CHANNELS: CH } = require("../../ipc/channels");
const { createHandle } = require("../../ipc/createHandle");
const {
  fail,
  validateBuildingScope,
  validateCurrentMonthScope,
  validateOpeningBalance,
  validatePeriod,
} = require("../shared/validate");
const investmentService = require("./service");

const FUTURE_PERIOD_MESSAGE = "Gelecek bir dönemin yatırım aidatı görüntülenemez.";

// The limit matches the investment_funds CHECK and the dues due_amount CHECK the accrual writes into.
function validateMonthlyAmount(payload) {
  if (!Number.isFinite(payload.monthlyAmount) || payload.monthlyAmount <= 0 || payload.monthlyAmount > 50000) {
    return fail("Yatırım aidatı 0'dan büyük olmalı ve 50.000₺'yi geçmemelidir.");
  }
  return null;
}

// Collection can be stopped and started again, so an update has to say which of the two it means.
function validateCollecting(value) {
  return typeof value === "boolean" ? null : fail("Toplama durumu belirtilmelidir.");
}

function registerInvestmentHandlers(ipcMain) {
  const handle = createHandle(ipcMain, "investment");

  handle(
    CH.INVESTMENT.GET_OVERVIEW,
    (payload) => validateBuildingScope(payload) ?? validatePeriod(payload, FUTURE_PERIOD_MESSAGE),
    investmentService.getOverview,
  );
  handle(
    CH.INVESTMENT.SETUP_FUND,
    (payload) =>
      validateBuildingScope(payload) ??
      validateMonthlyAmount(payload) ??
      validateOpeningBalance(payload.openingBalance),
    investmentService.setupFund,
  );
  // The opening balance is entered once, when the fund starts, so an update does not carry it.
  handle(
    CH.INVESTMENT.UPDATE_FUND,
    (payload) =>
      validateBuildingScope(payload) ??
      validateMonthlyAmount(payload) ??
      validateCurrentMonthScope(payload) ??
      validateCollecting(payload.isCollecting),
    investmentService.updateFund,
  );
}

module.exports = registerInvestmentHandlers;
