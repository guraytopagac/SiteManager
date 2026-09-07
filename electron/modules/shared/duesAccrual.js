// Monthly dues accrual. There is no timer, missing months are filled in when a page is opened.
const { getDb } = require("../../../database/db");
const { createdPeriodSql, currentPeriod } = require("./trTime");

// Creates the missing dues rows of a building, one per active apartment per month, from the
// month the apartment was created up to this month. Safe to call again, and it runs before every read.
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

  // The recursive CTE lists the months. The amount is copied from apartments.due_amount, and the
  // join keeps an apartment out of the months before it existed.
  // The seed is cast to INTEGER because better-sqlite3 binds every JS number as REAL, and SQLite's
  // / operator only divides as integers when both sides already are. Without the cast the year came
  // out as 2026.6666666666667, the INTEGER affinity could not convert it, and every later
  // `WHERE year = ?` missed the row.
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
