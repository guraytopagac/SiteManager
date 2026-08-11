const { CHANNELS: CH } = require("../../ipc/channels");
const { createHandle } = require("../shared/safeHandler");
const { fail, validateBuildingScope, validateId, validatePayload } = require("../shared/validate");
const buildingService = require("./service");

function validateOwnerScope(payload) {
  return validatePayload(payload) ?? validateId(payload.ownerId, "hesap ID");
}

function validateOwnedBuildingScope(payload) {
  return validateBuildingScope(payload) ?? validateId(payload.ownerId, "hesap ID");
}

function validateName(payload) {
  if (typeof payload.name === "string") {
    payload.name = payload.name.trim();
  }
  if (typeof payload.name !== "string" || !payload.name) {
    return fail("Bina adı zorunludur.");
  }
  if (payload.name.length < 2 || payload.name.length > 60) {
    return fail("Bina adı 2 ile 60 karakter arasında olmalıdır.");
  }
  return null;
}

function validateStatus(payload) {
  return typeof payload.isActive === "boolean" ? null : fail("Geçersiz durum değeri.");
}

function registerBuildingHandlers(ipcMain) {
  const handle = createHandle(ipcMain, "building");

  handle(CH.BUILDING.LIST, validateOwnerScope, buildingService.listBuildings);
  handle(
    CH.BUILDING.CREATE,
    (payload) => validateOwnerScope(payload) ?? validateName(payload),
    buildingService.createBuilding,
  );
  handle(
    CH.BUILDING.RENAME,
    (payload) => validateOwnedBuildingScope(payload) ?? validateName(payload),
    buildingService.renameBuilding,
  );
  handle(
    CH.BUILDING.UPDATE_STATUS,
    (payload) => validateOwnedBuildingScope(payload) ?? validateStatus(payload),
    buildingService.updateBuildingStatus,
  );
  handle(CH.BUILDING.REMOVE, validateOwnedBuildingScope, buildingService.removeBuilding);
}

module.exports = registerBuildingHandlers;
