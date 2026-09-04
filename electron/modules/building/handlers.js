// Building IPC entry points. Data here is kept apart by ownerId, not by buildingId.
const { CHANNELS: CH } = require("../../ipc/channels");
const { createHandle } = require("../../ipc/createHandle");
const { fail, validateBuildingScope, validateId, validatePayload } = require("../shared/validate");
const buildingService = require("./service");

function validateOwnerScope(payload) {
  return validatePayload(payload) ?? validateId(payload.ownerId, "hesap ID");
}

function validateOwnedBuildingScope(payload) {
  return validateBuildingScope(payload) ?? validateId(payload.ownerId, "hesap ID");
}

// Trims first and writes the value back only when it is valid. The service checks whether the
// name is already taken, because that needs a query.
function validateBuildingName(payload) {
  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  if (!name) {
    return fail("Bina adı zorunludur.");
  }
  if (name.length < 2 || name.length > 60) {
    return fail("Bina adı 2 ile 60 karakter arasında olmalıdır.");
  }
  payload.name = name;
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
    (payload) => validateOwnerScope(payload) ?? validateBuildingName(payload),
    buildingService.createBuilding,
  );
  handle(
    CH.BUILDING.RENAME,
    (payload) => validateOwnedBuildingScope(payload) ?? validateBuildingName(payload),
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
