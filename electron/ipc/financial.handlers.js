const financialService = require("../services/financial.service");

function registerFinancialHandlers(ipcMain) {
  ipcMain.handle("add-income", (event, data) => financialService.addIncome(data));
  ipcMain.handle("add-expense", (event, data) => financialService.addExpense(data));
  ipcMain.handle("get-transactions", (event, managerId) => financialService.getTransactions(managerId));
}

module.exports = registerFinancialHandlers;
