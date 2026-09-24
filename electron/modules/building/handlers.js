// Building IPC entry points. There is a single account, so no request carries an owner: the service fills
// owner_id itself and every building on the machine belongs to that account.
const { CHANNELS: CH } = require("../../ipc/channels");
const { createHandle } = require("../../ipc/createHandle");
const {
  fail,
  noValidation,
  validateApartmentType,
  validateBuildingScope,
  validateDueAmount,
  validatePayload,
} = require("../shared/validate");
const buildingService = require("./service");

// A floor never goes past the -2..99 CHECK on apartments, because the lowest one here is 0.
const MAX_FLOORS = 30;
const MAX_PER_FLOOR = 20;

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

// The layout is optional. When it is there the building is created together with its apartments,
// so the limits here have to match the ones apartment handlers enforce.
function validateLayout(payload) {
  const { layout } = payload;
  if (layout == null) {
    return null;
  }
  if (typeof layout !== "object" || Array.isArray(layout)) {
    return fail("Geçersiz daire düzeni.");
  }
  if (!Number.isInteger(layout.floors) || layout.floors < 1 || layout.floors > MAX_FLOORS) {
    return fail(`Kat sayısı 1 ile ${MAX_FLOORS} arasında olmalıdır.`);
  }
  if (!Number.isInteger(layout.perFloor) || layout.perFloor < 1 || layout.perFloor > MAX_PER_FLOOR) {
    return fail(`Kat başına daire sayısı 1 ile ${MAX_PER_FLOOR} arasında olmalıdır.`);
  }
  if (typeof layout.groundFloor !== "boolean") {
    return fail("Geçersiz zemin kat bilgisi.");
  }
  return validateApartmentType(layout.type) ?? validateDueAmount(layout.dueAmount);
}

function validateStatus(payload) {
  return typeof payload.isActive === "boolean" ? null : fail("Geçersiz durum değeri.");
}

function registerBuildingHandlers(ipcMain) {
  const handle = createHandle(ipcMain, "building");

  handle(CH.BUILDING.LIST, noValidation, buildingService.listBuildings);
  handle(
    CH.BUILDING.CREATE,
    (payload) => validatePayload(payload) ?? validateBuildingName(payload) ?? validateLayout(payload),
    buildingService.createBuilding,
  );
  handle(
    CH.BUILDING.RENAME,
    (payload) => validateBuildingScope(payload) ?? validateBuildingName(payload),
    buildingService.renameBuilding,
  );
  handle(
    CH.BUILDING.UPDATE_STATUS,
    (payload) => validateBuildingScope(payload) ?? validateStatus(payload),
    buildingService.updateBuildingStatus,
  );
  handle(CH.BUILDING.REMOVE, validateBuildingScope, buildingService.removeBuilding);
}

module.exports = registerBuildingHandlers;
