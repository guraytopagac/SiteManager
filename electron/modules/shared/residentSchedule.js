// Applies the resident changes whose day has come: a move-out dated ahead closes its row, and the queued
// successor takes over. The triggers fire when a date is written, not when it comes around.
const { getDb } = require("../../../database/db");
const { TR_NOW_SQL } = require("./trTime");

// Not scoped to a building, both statements touch only the rows already due. The order is not free: the
// closing pass runs first, or the row taking over meets the one it replaces in the active unique index.
function applyResidentSchedule() {
  getDb().transaction(() => {
    getDb()
      .prepare(
        `UPDATE residents SET is_active = 0, updated_at = ${TR_NOW_SQL}
         WHERE is_active = 1 AND move_out_date IS NOT NULL AND move_out_date <= date(${TR_NOW_SQL})`,
      )
      .run();

    getDb()
      .prepare(
        `UPDATE residents SET is_active = 1, updated_at = ${TR_NOW_SQL}
         WHERE is_active = 0 AND move_out_date IS NULL AND move_in_date <= date(${TR_NOW_SQL})`,
      )
      .run();
  })();
}

module.exports = { applyResidentSchedule };
