const apartmentService = require("../services/apartment.service");

function registerApartmentHandlers(ipcMain) {
  ipcMain.handle("add-apartment", async (event, data) => {
    try {
      return await apartmentService.addApartment(data);
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle("get-apartments", async (event, userId) => {
    try {
      return await apartmentService.getApartments(userId);
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle("update-apartment", async (event, { id, data }) => {
    try {
      return await apartmentService.updateApartment(id, data);
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle("delete-apartment", async (event, id) => {
    try {
      return await apartmentService.deleteApartment(id);
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle("bulk-update-due-amount", async (event, { managerId, amount }) => {
    try {
      return await apartmentService.bulkUpdateDueAmount(managerId, amount);
    } catch (err) {
      return { success: false, message: err.message };
    }
  });
}

module.exports = registerApartmentHandlers;
