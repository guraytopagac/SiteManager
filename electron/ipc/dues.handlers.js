const duesService = require("../services/dues.service");

function registerDuesHandlers(ipcMain) {
  ipcMain.handle("get-dues-for-month", (event, { managerId, year, month }) =>
    duesService.getDuesForMonth(managerId, year, month),
  );
  ipcMain.handle("record-payment", (event, { dueId, paymentData }) => duesService.recordPayment(dueId, paymentData));
  ipcMain.handle("cancel-payment", (event, { paymentId, reason }) => duesService.cancelPayment(paymentId, reason));
  ipcMain.handle("get-payment-history", (event, { dueId }) => duesService.getPaymentHistory(dueId));
}

module.exports = registerDuesHandlers;
