// Monthly dues accrual. There is no timer, missing months are filled in when a page is opened.
const { getDb } = require("../../../database/db");
const { createdPeriodSql, currentPeriod } = require("./trTime");

// Fills the missing dues rows of a building: one per active apartment per month, from the month the
// apartment was created up to this month. Idempotent, and called before every read.
function ensureMonthlyDues(buildingId) {
  const { startPeriod } = getDb()
    .prepare(
      `SELECT MIN(${createdPeriodSql()}) AS startPeriod
       FROM apartments WHERE building_id = ? AND is_active = 1`,
    )
    .get(buildingId);

  if (startPeriod === null) return;

  const endPeriod = currentPeriod();
  if (startPeriod > endPeriod) return;

  // The recursive CTE lists the months, the join keeps an apartment out of the months before it existed.
  // CAST is required: better-sqlite3 binds numbers as REAL and / only divides as integers when both sides are.
  getDb()
    .prepare(
      `INSERT OR IGNORE INTO dues (apartment_id, year, month, due_amount)
     WITH RECURSIVE periods(period) AS (
       SELECT CAST(? AS INTEGER)
       UNION ALL
       SELECT period + 1 FROM periods WHERE period + 1 <= ?
     )
     SELECT a.id, (p.period - 1) / 12, (p.period - 1) % 12 + 1, a.due_amount
     FROM apartments a
     JOIN periods p ON p.period >= ${createdPeriodSql("a.")}
     WHERE a.building_id = ? AND a.is_active = 1`,
    )
    .run(startPeriod, endPeriod, buildingId);
}

module.exports = { ensureMonthlyDues };
