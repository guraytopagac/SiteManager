// Resident rules. An apartment carries two records: the owner, who stays, and the tenant, who comes
// and goes. Each step is its own action instead of being part of the apartment form: add, update,
// move out. Replacing a tenant means a move out followed by an add.
const { getDb } = require("../../../database/db");
const { createDbErrorResolver } = require("../shared/dbError");
const { applyResidentSchedule } = require("../shared/residentSchedule");
const { OWNER_ID_FOR_PERIOD_SQL, RESIDENT_ID_FOR_PERIOD_SQL, periodCutoff } = require("../shared/residentPeriod");
const { TR_NOW_SQL, createdPeriodSql, toPeriod, trToday } = require("../shared/trTime");

const APARTMENT_NOT_FOUND_MESSAGE = "Daire bulunamadı veya bu işlem için yetkiniz yok.";
const RESIDENT_NOT_FOUND_MESSAGE = "Kayıt bulunamadı veya bu işlem için yetkiniz yok.";

const DUPLICATE_MESSAGES = {
  owner: "Bu dairede kayıtlı bir malik var. Önce Malik Değiştir ile mevcut kaydı kapatın.",
  tenant: "Bu dairede aktif bir kiracı var. Önce çıkış yaptırın.",
};

// A queued record is one that is waiting for its day: not active yet, and not closed either.
const PENDING_MESSAGES = {
  owner: "Bu daire için planlanmış bir malik devri var. Önce planlanan devri iptal edin.",
  tenant: "Bu daire için planlanmış bir kiracı değişimi var. Önce planlanan değişimi iptal edin.",
};

// A record starts on move_in_date when it was queued, and on the day it was entered otherwise, so a
// move-out dated before that would close it before it ever opened.
const EARLY_MOVE_OUT_MESSAGES = {
  owner: "Devir tarihi, malik kaydının başlangıç tarihinden önce olamaz.",
  tenant: "Çıkış tarihi, kiracının giriş tarihinden önce olamaz.",
};

const NO_SCHEDULE_MESSAGES = {
  owner: "Bu kayıt için planlanmış bir devir yok.",
  tenant: "Bu kayıt için planlanmış bir çıkış yok.",
};

const CLOSED_MESSAGES = {
  owner: "Bu malik kaydı kapatılmış, geçmiş kayıt değiştirilemez.",
  tenant: "Bu sakin çıkış yapmış, geçmiş kaydı değiştirilemez.",
};

// resident_type is the only labelled column. It is the one NOT NULL field the user fills in, and
// the UNIQUE index it also sits in is guarded by the duplicate check below with its own sentence.
const resolveDbError = createDbErrorResolver({ resident_type: "Kayıt türü" });

// Does not care whether the apartment is active, so the history of an old apartment stays readable.
function findOwnedApartment(apartmentId, buildingId) {
  return getDb().prepare(`SELECT id FROM apartments WHERE id = ? AND building_id = ?`).get(apartmentId, buildingId);
}

// Writing also needs the apartment to be active.
function findOwnedActiveApartment(apartmentId, buildingId) {
  return getDb()
    .prepare(`SELECT id, apartment_no FROM apartments WHERE id = ? AND building_id = ? AND is_active = 1`)
    .get(apartmentId, buildingId);
}

// Checks the owner through the apartment, and returns is_active for the caller to test.
function findOwnedResident(residentId, buildingId) {
  return getDb()
    .prepare(
      `SELECT r.id, r.apartment_id, r.resident_type, r.is_active, r.move_out_date, a.apartment_no,
              COALESCE(r.move_in_date, date(r.created_at)) AS start_date FROM residents r
       JOIN apartments a ON a.id = r.apartment_id
       WHERE r.id = ? AND a.building_id = ?`,
    )
    .get(residentId, buildingId);
}

// A tenant always lives in the flat, so the flag the caller sent only answers for an owner.
function occupancyFlag(residentType, isOccupantRequested) {
  return residentType === "tenant" || isOccupantRequested ? 1 : 0;
}

// The one place that decides whether a write may take a role, and what the row's occupancy flag
// becomes. excludeId leaves the row being updated out of its own duplicate check. The move-out
// path does not come through here: it closes the only active row of that kind in the same
// transaction, so the duplicate it would look for cannot exist by the time the insert runs.
function resolveRole(apartmentId, residentType, isOccupantRequested, excludeId) {
  const siblings = getDb()
    .prepare(
      `SELECT resident_type, is_active FROM residents
       WHERE apartment_id = ? AND id <> ? AND (is_active = 1 OR move_out_date IS NULL)`,
    )
    .all(apartmentId, excludeId ?? 0);

  const clash = siblings.find((row) => row.resident_type === residentType);
  if (clash) {
    return { message: clash.is_active ? DUPLICATE_MESSAGES[residentType] : PENDING_MESSAGES[residentType] };
  }

  return { isOccupant: occupancyFlag(residentType, isOccupantRequested) };
}

// Shared by addResident and the replacement half of moveOutResident, so the column list is written
// once. The caller has already decided the role and the occupancy flag.
function insertResident(apartmentId, data, residentType, isOccupant, moveInDate = null) {
  getDb()
    .prepare(
      `INSERT INTO residents (apartment_id, full_name, phone, email, national_id, resident_type, is_occupant, household_size, move_in_date, move_out_date, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${TR_NOW_SQL}, ${TR_NOW_SQL})`,
    )
    .run(
      apartmentId,
      data.full_name,
      data.phone,
      data.email,
      data.national_id,
      residentType,
      isOccupant,
      data.household_size,
      moveInDate,
      data.move_out_date ?? null,
      moveInDate ? 0 : 1,
    );
}

// The queued record of one kind. The overview joins it as a whole row rather than pulling columns
// one at a time, because the panel prefills the edit form from it. The type is a literal
// from this module, never a value from the payload.
const pendingSql = (column, residentType) => `(
           SELECT p.${column} FROM residents p
           WHERE p.apartment_id = a.id AND p.resident_type = '${residentType}'
             AND p.is_active = 0 AND p.move_out_date IS NULL
         )`;

// The record waiting for a dated-ahead transfer, if there is one.
function findPendingSibling(apartmentId, residentType) {
  return getDb()
    .prepare(
      `SELECT id, full_name FROM residents
       WHERE apartment_id = ? AND resident_type = ? AND is_active = 0 AND move_out_date IS NULL`,
    )
    .get(apartmentId, residentType);
}

// LEFT JOIN, so an apartment with no resident still shows up. The occupant is the one who lived
// there in the month being viewed, not the one living there now, so a past month keeps naming
// whoever was in the apartment then. The owner is joined a second time because the panel shows both
// records, and the two joins land on the same row when the owner lives there. The joined tables are
// aliased "res" and "own" because the shared subquery already uses "r" for its own scan. Same
// numeric apartment_no ordering as getDuesForMonth.
//
// Both rows carry is_active, because the month a record covers and whether it is still open are two
// different questions: someone who moved out today still belongs to this month's list, but the
// screen may no longer offer to edit them.
function getResidentsOverview(payload) {
  const { buildingId, year, month } = payload;
  try {
    applyResidentSchedule();

    const period = toPeriod(year, month);
    const cutoff = periodCutoff(year, month);

    const data = getDb()
      .prepare(
        `SELECT a.id AS apartment_id, a.apartment_no, a.floor,
                res.id AS occupant_id, res.full_name AS occupant_full_name, res.phone AS occupant_phone,
                res.email AS occupant_email, res.national_id AS occupant_national_id,
                res.household_size AS occupant_household_size, res.is_occupant AS occupant_is_occupant,
                res.move_out_date AS occupant_move_out_date, res.is_active AS occupant_is_active,
                COALESCE(res.move_in_date, date(res.created_at)) AS occupant_start_date,
                res.resident_type AS occupant_resident_type,
                own.id AS owner_id, own.full_name AS owner_full_name, own.phone AS owner_phone,
                own.email AS owner_email, own.national_id AS owner_national_id,
                own.household_size AS owner_household_size, own.is_occupant AS owner_is_occupant,
                own.move_out_date AS owner_move_out_date, own.is_active AS owner_is_active,
                COALESCE(own.move_in_date, date(own.created_at)) AS owner_start_date,
                pt.id AS pending_tenant_id, pt.full_name AS pending_tenant_full_name,
                pt.phone AS pending_tenant_phone, pt.email AS pending_tenant_email,
                pt.national_id AS pending_tenant_national_id,
                pt.household_size AS pending_tenant_household_size, pt.is_occupant AS pending_tenant_is_occupant,
                pt.move_out_date AS pending_tenant_move_out_date, pt.is_active AS pending_tenant_is_active,
                COALESCE(pt.move_in_date, date(pt.created_at)) AS pending_tenant_start_date,
                po.id AS pending_owner_id, po.full_name AS pending_owner_full_name,
                po.phone AS pending_owner_phone, po.email AS pending_owner_email,
                po.national_id AS pending_owner_national_id,
                po.household_size AS pending_owner_household_size, po.is_occupant AS pending_owner_is_occupant,
                po.move_out_date AS pending_owner_move_out_date, po.is_active AS pending_owner_is_active,
                COALESCE(po.move_in_date, date(po.created_at)) AS pending_owner_start_date
         FROM apartments a
         LEFT JOIN residents res ON res.id = ${RESIDENT_ID_FOR_PERIOD_SQL}
         LEFT JOIN residents own ON own.id = ${OWNER_ID_FOR_PERIOD_SQL}
         LEFT JOIN residents pt ON pt.id = ${pendingSql("id", "tenant")}
         LEFT JOIN residents po ON po.id = ${pendingSql("id", "owner")}
         WHERE a.building_id = ? AND a.is_active = 1 AND ${createdPeriodSql("a.")} <= ?
         ORDER BY (a.apartment_no GLOB '[0-9]*') DESC,
                  CAST(a.apartment_no AS INTEGER) ASC,
                  a.apartment_no COLLATE NOCASE ASC`,
      )
      .all(cutoff, cutoff, cutoff, cutoff, buildingId, period);

    // The building's earliest active apartment. Without it the renderer cannot tell "no apartments
    // at all" from "no apartments yet in the month being viewed", since both come back empty.
    const start = getDb()
      .prepare(
        `SELECT CAST(strftime('%Y', MIN(created_at)) AS INTEGER) AS year,
                CAST(strftime('%m', MIN(created_at)) AS INTEGER) AS month
         FROM apartments WHERE building_id = ? AND is_active = 1`,
      )
      .get(buildingId);

    return { success: true, data, start: start.year === null ? null : start };
  } catch (err) {
    console.error("[resident.service] getResidentsOverview:", err);
    return { success: false, message: "Sakin verileri alınamadı." };
  }
}

// Rows are a timeline, so start date alone orders them and is_active never lifts a row. A pending
// row carries a future transfer date, which puts it on top without a case of its own.
function getResidentHistory(payload) {
  const { apartmentId, buildingId } = payload;
  try {
    if (!findOwnedApartment(apartmentId, buildingId)) {
      return { success: false, message: APARTMENT_NOT_FOUND_MESSAGE };
    }

    const data = getDb()
      .prepare(
        `SELECT id, full_name, phone, email, national_id, resident_type, is_occupant, household_size,
                COALESCE(move_in_date, date(created_at)) AS start_date,
                move_out_date, is_active
         FROM residents
         WHERE apartment_id = ?
         ORDER BY start_date DESC, id DESC`,
      )
      .all(apartmentId);

    return { success: true, data };
  } catch (err) {
    console.error("[resident.service] getResidentHistory:", err);
    return { success: false, message: "Sakin geçmişi alınamadı." };
  }
}

function addResident(payload) {
  const { apartmentId, buildingId, resident_type: residentType } = payload;
  try {
    applyResidentSchedule();

    const apartment = findOwnedActiveApartment(apartmentId, buildingId);
    if (!apartment) return { success: false, message: APARTMENT_NOT_FOUND_MESSAGE };

    const role = resolveRole(apartmentId, residentType, payload.is_occupant, null);
    if (role.message) return { success: false, message: role.message };

    insertResident(apartmentId, payload, residentType, role.isOccupant);

    return {
      success: true,
      message:
        residentType === "owner"
          ? `Daire ${apartment.apartment_no} için malik kaydedildi.`
          : `Daire ${apartment.apartment_no} için kiracı eklendi.`,
    };
  } catch (err) {
    console.error("[resident.service] addResident:", err);
    return { success: false, message: resolveDbError(err, "Sakin ekleme") };
  }
}

// Overwrites the active row. An empty field means the user cleared it, and a closed record can
// never be edited. move_out_date is left out of the column list on purpose.
function updateResident(payload) {
  const { residentId, buildingId, resident_type: residentType } = payload;
  try {
    const resident = findOwnedResident(residentId, buildingId);
    if (!resident) return { success: false, message: RESIDENT_NOT_FOUND_MESSAGE };
    if (!resident.is_active) return { success: false, message: CLOSED_MESSAGES[resident.resident_type] };

    const role = resolveRole(resident.apartment_id, residentType, payload.is_occupant, residentId);
    if (role.message) return { success: false, message: role.message };

    getDb()
      .prepare(
        `UPDATE residents SET full_name = ?, phone = ?, email = ?, national_id = ?, resident_type = ?,
         is_occupant = ?, household_size = ?, updated_at = ${TR_NOW_SQL} WHERE id = ?`,
      )
      .run(
        payload.full_name,
        payload.phone,
        payload.email,
        payload.national_id,
        residentType,
        role.isOccupant,
        payload.household_size,
        residentId,
      );

    return {
      success: true,
      message:
        residentType === "owner"
          ? `Daire ${resident.apartment_no} malik bilgileri güncellendi.`
          : `Daire ${resident.apartment_no} kiracı bilgileri güncellendi.`,
    };
  } catch (err) {
    console.error("[resident.service] updateResident:", err);
    return { success: false, message: resolveDbError(err, "Sakin güncelleme") };
  }
}

// Sets the move-out date, and the trigger then deactivates the row. A later date keeps it active,
// so the message says which of the two happened. An owner record is closed rather than moved out,
// which is what a change of hands looks like.
//
// payload.next is the record that replaces the one being closed, and it is optional. Both writes
// share one transaction, so the flat is never left without the record for a moment: the update
// fires the move-out trigger, the row goes inactive, and only then does the insert take the role.
// That order is also what keeps the partial unique index happy, since it allows one active row per
// kind.
//
// A dated-ahead exit takes the successor too, and then the new row is queued rather than opened: it
// carries move_in_date and waits with is_active = 0, so it stays out of the active index and out of
// every screen until applyResidentSchedule promotes it on the day. One queue per kind, which is why
// a second dated-ahead transfer is refused until the standing one is cancelled.
function moveOutResident(payload) {
  const { residentId, buildingId, moveOutDate, next } = payload;
  try {
    const resident = findOwnedResident(residentId, buildingId);
    if (!resident) return { success: false, message: RESIDENT_NOT_FOUND_MESSAGE };
    if (!resident.is_active) return { success: false, message: CLOSED_MESSAGES[resident.resident_type] };

    const residentType = resident.resident_type;
    const isOwner = residentType === "owner";
    const isFuture = moveOutDate > trToday();

    if (moveOutDate < resident.start_date) {
      return { success: false, message: EARLY_MOVE_OUT_MESSAGES[residentType] };
    }

    if (findPendingSibling(resident.apartment_id, residentType)) {
      return { success: false, message: PENDING_MESSAGES[residentType] };
    }

    if (next && next.resident_type !== residentType) {
      return { success: false, message: "Yeni kayıt, kapatılan kaydın türüyle aynı olmalıdır." };
    }

    getDb().transaction(() => {
      getDb()
        .prepare(`UPDATE residents SET move_out_date = ?, updated_at = ${TR_NOW_SQL} WHERE id = ?`)
        .run(moveOutDate, residentId);

      if (next) {
        const isOccupant = occupancyFlag(residentType, next.is_occupant);
        insertResident(resident.apartment_id, next, residentType, isOccupant, isFuture ? moveOutDate : null);
      }
    })();

    if (isFuture) {
      if (next) {
        return {
          success: true,
          message: isOwner
            ? "Devir tarihi kaydedildi. Yeni malik o gün devreye girecek."
            : "Çıkış tarihi kaydedildi. Yeni kiracı o gün devreye girecek.",
        };
      }

      return {
        success: true,
        message: isOwner
          ? "Devir tarihi kaydedildi. Malik kaydı o tarihe kadar geçerli kalacak."
          : "Çıkış tarihi kaydedildi. Kiracı o tarihe kadar aktif kalacak.",
      };
    }

    if (next) {
      return {
        success: true,
        message: isOwner
          ? `Daire ${resident.apartment_no} maliki değiştirildi.`
          : `Daire ${resident.apartment_no} kiracısı değiştirildi.`,
      };
    }

    return {
      success: true,
      message: isOwner
        ? `Daire ${resident.apartment_no} malik kaydı kapatıldı.`
        : `Daire ${resident.apartment_no} kiracısı çıkış yaptı.`,
    };
  } catch (err) {
    console.error("[resident.service] moveOutResident:", err);
    return { success: false, message: resolveDbError(err, "Sakin çıkışı") };
  }
}

// Rewrites a transfer that has not happened yet: the date moves, and the record queued behind it
// is updated, created or dropped to match what the caller sent. Pulling the date back to today or
// earlier applies the transfer on the spot, which is the same two steps applyResidentSchedule runs:
// the standing row closes through its trigger and the queued row takes over, in that order.
function updateScheduledMoveOut(payload) {
  const { residentId, buildingId, moveOutDate, next } = payload;
  try {
    const resident = findOwnedResident(residentId, buildingId);
    if (!resident) return { success: false, message: RESIDENT_NOT_FOUND_MESSAGE };

    const residentType = resident.resident_type;
    const isOwner = residentType === "owner";
    if (!resident.is_active || !resident.move_out_date || resident.move_out_date <= trToday()) {
      return { success: false, message: NO_SCHEDULE_MESSAGES[residentType] };
    }

    if (moveOutDate < resident.start_date) {
      return { success: false, message: EARLY_MOVE_OUT_MESSAGES[residentType] };
    }

    if (next && next.resident_type !== residentType) {
      return { success: false, message: "Yeni kayıt, kapatılan kaydın türüyle aynı olmalıdır." };
    }

    const pending = findPendingSibling(resident.apartment_id, residentType);
    const isFuture = moveOutDate > trToday();

    getDb().transaction(() => {
      getDb()
        .prepare(`UPDATE residents SET move_out_date = ?, updated_at = ${TR_NOW_SQL} WHERE id = ?`)
        .run(moveOutDate, residentId);

      if (!next) {
        if (pending) getDb().prepare(`DELETE FROM residents WHERE id = ?`).run(pending.id);
        return;
      }

      const isOccupant = occupancyFlag(residentType, next.is_occupant);
      if (!pending) {
        insertResident(resident.apartment_id, next, residentType, isOccupant, isFuture ? moveOutDate : null);
        return;
      }

      getDb()
        .prepare(
          `UPDATE residents SET full_name = ?, phone = ?, email = ?, national_id = ?, is_occupant = ?,
           household_size = ?, move_in_date = ?, is_active = ?, updated_at = ${TR_NOW_SQL} WHERE id = ?`,
        )
        .run(
          next.full_name,
          next.phone,
          next.email,
          next.national_id,
          isOccupant,
          next.household_size,
          isFuture ? moveOutDate : null,
          isFuture ? 0 : 1,
          pending.id,
        );
    })();

    if (isFuture) {
      return {
        success: true,
        message: isOwner ? "Planlanan devir güncellendi." : "Planlanan çıkış güncellendi.",
      };
    }

    return {
      success: true,
      message: isOwner
        ? `Daire ${resident.apartment_no} maliki değiştirildi.`
        : `Daire ${resident.apartment_no} kiracısı çıkış yaptı.`,
    };
  } catch (err) {
    console.error("[resident.service] updateScheduledMoveOut:", err);
    return { success: false, message: resolveDbError(err, "Planlanan işlemi güncelleme") };
  }
}

// Undoes a transfer that has not happened yet: the date on the standing record is cleared and the
// record queued behind it is removed. The queued row is deleted rather than closed, because it
// never took effect and a zero-day record would only clutter the apartment's history. Nothing else
// in the app deletes a resident row.
function cancelScheduledMoveOut(payload) {
  const { residentId, buildingId } = payload;
  try {
    const resident = findOwnedResident(residentId, buildingId);
    if (!resident) return { success: false, message: RESIDENT_NOT_FOUND_MESSAGE };

    const isOwner = resident.resident_type === "owner";
    if (!resident.is_active || !resident.move_out_date || resident.move_out_date <= trToday()) {
      return { success: false, message: NO_SCHEDULE_MESSAGES[resident.resident_type] };
    }

    getDb().transaction(() => {
      getDb()
        .prepare(`UPDATE residents SET move_out_date = NULL, updated_at = ${TR_NOW_SQL} WHERE id = ?`)
        .run(residentId);

      getDb()
        .prepare(
          `DELETE FROM residents
           WHERE apartment_id = ? AND resident_type = ? AND is_active = 0 AND move_out_date IS NULL`,
        )
        .run(resident.apartment_id, resident.resident_type);
    })();

    return {
      success: true,
      message: isOwner
        ? `Daire ${resident.apartment_no} için planlanan devir iptal edildi.`
        : `Daire ${resident.apartment_no} için planlanan çıkış iptal edildi.`,
    };
  } catch (err) {
    console.error("[resident.service] cancelScheduledMoveOut:", err);
    return { success: false, message: resolveDbError(err, "Planlanan işlemi iptal etme") };
  }
}

module.exports = {
  getResidentsOverview,
  getResidentHistory,
  addResident,
  updateResident,
  moveOutResident,
  updateScheduledMoveOut,
  cancelScheduledMoveOut,
};
