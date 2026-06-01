const apartmentService = require('../services/apartment.service');

function registerApartmentHandlers(ipcMain) {
    ipcMain.handle('add-apartment', (event, data) => apartmentService.addApartment(data));
    ipcMain.handle('get-apartments', () => apartmentService.getApartments());
}

module.exports = registerApartmentHandlers;
