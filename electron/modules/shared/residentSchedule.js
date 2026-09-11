// Applies the resident changes whose day has come. Two of them: a move-out dated ahead closes its
// row, and the record queued to replace it takes over. Neither happens on its own, because the
// triggers on the table fire when a date is written, not when it comes around. Called before the
// reads that depend on is_active instead of on a timer, the same way ensureMonthlyDues fills in the
// months nobody asked for yet.
const { getDb } = require("../../../database/db");
const { TR_NOW_SQL } = require("./trTime");

// Not scoped to a building. Both statements touch only the rows that are already due, so scoping
// them would add a join for nothing. The order is not free: the closing pass has to run first, or
// the row taking over would meet the one it replaces in the partial unique index on active rows.
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
