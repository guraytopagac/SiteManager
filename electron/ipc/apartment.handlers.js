const apartmentService = require("../services/apartment.service");
const CH = require("./channels");

function registerApartmentHandlers(ipcMain) {
  ipcMain.handle(CH.APARTMENT.ADD, async (event, data) => {
    if (!data?.apartment_no || !data?.manager_id) {
      return { success: false, message: "Daire numarası ve yönetici ID zorunludur." };
    }
    try {
      return await apartmentService.addApartment(data);
    } catch (err) {
      return { success: false, message: "İşlem sırasında bir hata oluştu." };
    }
  });

  ipcMain.handle(CH.APARTMENT.UPDATE, async (event, { id, data }) => {
    if (!id || typeof id !== "number") {
      return { success: false, message: "Geçersiz daire ID." };
    }
    try {
      return await apartmentService.updateApartment(id, data);
    } catch (err) {
      return { success: false, message: "İşlem sırasında bir hata oluştu." };
    }
  });

  ipcMain.handle(CH.APARTMENT.DELETE, async (event, { id, managerId }) => {
    if (!id || typeof id !== "number") {
      return { success: false, message: "Geçersiz daire ID." };
    }
    if (!managerId || typeof managerId !== "number") {
      return { success: false, message: "Geçersiz kullanıcı ID." };
    }
    try {
      return await apartmentService.deleteApartment(id, managerId);
    } catch (err) {
      return { success: false, message: "İşlem sırasında bir hata oluştu." };
    }
  });

  ipcMain.handle(CH.APARTMENT.BULK_UPDATE_DUE_AMOUNT, async (event, { managerId, amount }) => {
    if (!managerId || typeof managerId !== "number") {
      return { success: false, message: "Geçersiz kullanıcı ID." };
    }
    if (!amount || typeof amount !== "number" || amount <= 0) {
      return { success: false, message: "Geçersiz aidat tutarı." };
    }
    try {
      return await apartmentService.bulkUpdateDueAmount(managerId, amount);
    } catch (err) {
      return { success: false, message: "İşlem sırasında bir hata oluştu." };
    }
  });

}

module.exports = registerApartmentHandlers;
