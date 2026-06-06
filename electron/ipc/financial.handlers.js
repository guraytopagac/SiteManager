const financialService = require("../services/financial.service");

function registerFinancialHandlers(ipcMain) {
  ipcMain.handle("add-income", (event, data) => financialService.addIncome(data));
}

module.exports = registerFinancialHandlers;
