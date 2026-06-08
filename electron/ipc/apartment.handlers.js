const apartmentService = require("../services/apartment.service");

function registerApartmentHandlers(ipcMain) {
  ipcMain.handle("add-apartment", (event, data) => apartmentService.addApartment(data));
  ipcMain.handle("get-apartments", (event, userId) => apartmentService.getApartments(userId));
  ipcMain.handle("update-apartment", (event, { id, data }) => apartmentService.updateApartment(id, data));
  ipcMain.handle("delete-apartment", (event, id) => apartmentService.deleteApartment(id));
}

module.exports = registerApartmentHandlers;
