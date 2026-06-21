const duesService = require("../services/dues.service");

function registerDuesHandlers(ipcMain) {
  ipcMain.handle("get-dues-for-month", async (event, { managerId, year, month }) => {
    try {
      return await duesService.getDuesForMonth(managerId, year, month);
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle("record-payment", async (event, { dueId, paymentData }) => {
    try {
      return await duesService.recordPayment(dueId, paymentData);
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle("cancel-payment", async (event, { paymentId, reason }) => {
    try {
      return await duesService.cancelPayment(paymentId, reason);
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle("get-payment-history", async (event, { dueId }) => {
    try {
      return await duesService.getPaymentHistory(dueId);
    } catch (err) {
      return { success: false, message: err.message };
    }
  });
}

module.exports = registerDuesHandlers;
