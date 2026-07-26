const CH = require("../../ipc/channels");
const { createSafeHandler } = require("../shared/safeHandler");
const buildingService = require("./service");

const safeHandler = createSafeHandler("building");

const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 60;

function validateOwnerId(ownerId) {
  if (!Number.isInteger(ownerId) || ownerId <= 0) {
    return { success: false, message: "Geçersiz hesap ID." };
  }
  return null;
}

function validateName(name) {
  if (typeof name !== "string" || !name) {
    return { success: false, message: "Bina adı zorunludur." };
  }
  if (name.length < MIN_NAME_LENGTH || name.length > MAX_NAME_LENGTH) {
    return { success: false, message: "Bina adı 2 ile 60 karakter arasında olmalıdır." };
  }
  return null;
}

function validateBuildingId(buildingId) {
  if (!Number.isInteger(buildingId) || buildingId <= 0) {
    return { success: false, message: "Geçersiz bina ID." };
  }
  return null;
}

function validateCreateData(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { success: false, message: "Geçersiz istek." };
  }
  if (typeof payload.name === "string") {
    payload.name = payload.name.trim();
  }
  const ownerError = validateOwnerId(payload.ownerId);
  if (ownerError) return ownerError;
  return validateName(payload.name);
}

function validateRenameData(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { success: false, message: "Geçersiz istek." };
  }
  if (typeof payload.name === "string") {
    payload.name = payload.name.trim();
  }
  const idError = validateBuildingId(payload.buildingId);
  if (idError) return idError;
  const ownerError = validateOwnerId(payload.ownerId);
  if (ownerError) return ownerError;
  return validateName(payload.name);
}

function validateUpdateStatusData(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { success: false, message: "Geçersiz istek." };
  }
  const idError = validateBuildingId(payload.buildingId);
  if (idError) return idError;
  const ownerError = validateOwnerId(payload.ownerId);
  if (ownerError) return ownerError;
  if (typeof payload.isActive !== "boolean") {
    return { success: false, message: "Geçersiz durum değeri." };
  }
  return null;
}

function registerBuildingHandlers(ipcMain) {
  ipcMain.handle(
    CH.BUILDING.LIST,
    safeHandler(CH.BUILDING.LIST, (ownerId) => {
      const error = validateOwnerId(ownerId);
      if (error) {
        return error;
      }
      return buildingService.listBuildings(ownerId);
    }),
  );

  ipcMain.handle(
    CH.BUILDING.CREATE,
    safeHandler(CH.BUILDING.CREATE, (payload) => {
      const error = validateCreateData(payload);
      if (error) {
        return error;
      }
      return buildingService.createBuilding(payload.ownerId, payload.name);
    }),
  );

  ipcMain.handle(
    CH.BUILDING.RENAME,
    safeHandler(CH.BUILDING.RENAME, (payload) => {
      const error = validateRenameData(payload);
      if (error) {
        return error;
      }
      return buildingService.renameBuilding(payload.buildingId, payload.ownerId, payload.name);
    }),
  );

  ipcMain.handle(
    CH.BUILDING.UPDATE_STATUS,
    safeHandler(CH.BUILDING.UPDATE_STATUS, (payload) => {
      const error = validateUpdateStatusData(payload);
      if (error) {
        return error;
      }
      return buildingService.updateBuildingStatus(payload.buildingId, payload.ownerId, payload.isActive);
    }),
  );
}

module.exports = registerBuildingHandlers;
