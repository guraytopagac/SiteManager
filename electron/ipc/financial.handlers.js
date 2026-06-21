const financialService = require("../services/financial.service");

function registerFinancialHandlers(ipcMain) {
  ipcMain.handle("add-income", async (event, data) => {
    try {
      return await financialService.addIncome(data);
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle("add-expense", async (event, data) => {
    try {
      return await financialService.addExpense(data);
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle("get-transactions", async (event, managerId) => {
    try {
      return await financialService.getTransactions(managerId);
    } catch (err) {
      return { success: false, message: err.message };
    }
  });
}

module.exports = registerFinancialHandlers;
