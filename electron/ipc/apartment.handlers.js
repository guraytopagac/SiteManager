const apartmentService = require('../services/apartment.service');

function registerApartmentHandlers(ipcMain) {
    ipcMain.handle('add-apartment', (event, data) => apartmentService.addApartment(data));
    ipcMain.handle('get-apartments', (event, userId) => apartmentService.getApartments(userId));
}

module.exports = registerApartmentHandlers;
