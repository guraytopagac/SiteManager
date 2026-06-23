const apartmentService = require("../services/apartment.service");

function registerApartmentHandlers(ipcMain) {
  ipcMain.handle("add-apartment", async (event, data) => {
    try {
      return await apartmentService.addApartment(data);
    } catch (err) {
      return { success: false, message: "İşlem sırasında bir hata oluştu." };
    }
  });

  ipcMain.handle("get-apartments", async (event, userId) => {
    try {
      return await apartmentService.getApartments(userId);
    } catch (err) {
      return { success: false, message: "İşlem sırasında bir hata oluştu." };
    }
  });

  ipcMain.handle("update-apartment", async (event, { id, data }) => {
    if (!id || typeof id !== "number") {
      return { success: false, message: "Geçersiz daire ID." };
    }
    try {
      return await apartmentService.updateApartment(id, data);
    } catch (err) {
      return { success: false, message: "İşlem sırasında bir hata oluştu." };
    }
  });

  ipcMain.handle("delete-apartment", async (event, { id, managerId }) => {
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

  ipcMain.handle("bulk-update-due-amount", async (event, { managerId, amount }) => {
    if (!amount || typeof amount !== "number" || amount <= 0) {
      return { success: false, message: "Geçersiz aidat tutarı." };
    }
    try {
      return await apartmentService.bulkUpdateDueAmount(managerId, amount);
    } catch (err) {
      return { success: false, message: "İşlem sırasında bir hata oluştu." };
    }
  });

  ipcMain.handle("get-resident-history", async (event, apartmentId) => {
    if (!apartmentId || typeof apartmentId !== "number") {
      return { success: false, message: "Geçersiz daire ID." };
    }
    try {
      return await apartmentService.getResidentHistory(apartmentId);
    } catch (err) {
      return { success: false, message: "İşlem sırasında bir hata oluştu." };
    }
  });
}

module.exports = registerApartmentHandlers;
