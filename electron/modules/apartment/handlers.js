const CH = require("../../ipc/channels");
const apartmentService = require("./service");

function registerApartmentHandlers(ipcMain) {
  ipcMain.handle(CH.APARTMENT.ADD, (event, data) => {
    if (!data?.apartment_no || !data?.manager_id) {
      return { success: false, message: "Daire numarası ve yönetici ID zorunludur." };
    }
    if (typeof data.manager_id !== "number") {
      return { success: false, message: "Geçersiz yönetici ID." };
    }
    try {
      return apartmentService.addApartment(data);
    } catch (err) {
      console.error("[apartment.handlers] ADD:", err);
      return { success: false, message: "İşlem sırasında bir hata oluştu." };
    }
  });

  ipcMain.handle(CH.APARTMENT.UPDATE, (event, { id, data }) => {
    if (!id || typeof id !== "number") {
      return { success: false, message: "Geçersiz daire ID." };
    }
    try {
      return apartmentService.updateApartment(id, data);
    } catch (err) {
      console.error("[apartment.handlers] UPDATE:", err);
      return { success: false, message: "İşlem sırasında bir hata oluştu." };
    }
  });

  ipcMain.handle(CH.APARTMENT.DELETE, (event, { id, managerId }) => {
    if (!id || typeof id !== "number") {
      return { success: false, message: "Geçersiz daire ID." };
    }
    if (!managerId || typeof managerId !== "number") {
      return { success: false, message: "Geçersiz kullanıcı ID." };
    }
    try {
      return apartmentService.deleteApartment(id, managerId);
    } catch (err) {
      console.error("[apartment.handlers] DELETE:", err);
      return { success: false, message: "İşlem sırasında bir hata oluştu." };
    }
  });

  ipcMain.handle(CH.APARTMENT.BULK_UPDATE_DUE_AMOUNT, (event, { managerId, amount }) => {
    if (!managerId || typeof managerId !== "number") {
      return { success: false, message: "Geçersiz kullanıcı ID." };
    }
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
      return { success: false, message: "Geçersiz aidat tutarı." };
    }
    try {
      return apartmentService.bulkUpdateDueAmount(managerId, amount);
    } catch (err) {
      console.error("[apartment.handlers] BULK_UPDATE_DUE_AMOUNT:", err);
      return { success: false, message: "İşlem sırasında bir hata oluştu." };
    }
  });
}

module.exports = registerApartmentHandlers;
