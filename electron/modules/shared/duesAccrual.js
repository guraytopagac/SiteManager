const { getDb } = require("../../../database/db");
const { trYearMonth } = require("./trTime");

function currentPeriod() {
  const { year, month } = trYearMonth();
  return year * 12 + month;
}

function ensureMonthlyDues(buildingId) {
  const { startPeriod } = getDb()
    .prepare(
      `SELECT MIN(CAST(strftime('%Y', created_at) AS INTEGER) * 12 + CAST(strftime('%m', created_at) AS INTEGER))
              AS startPeriod
       FROM apartments WHERE building_id = ? AND is_active = 1`,
    )
    .get(buildingId);

  if (startPeriod === null) return;

  const endPeriod = currentPeriod();
  if (startPeriod > endPeriod) return;

  getDb()
    .prepare(
      `INSERT OR IGNORE INTO dues (apartment_id, year, month, due_amount)
     WITH RECURSIVE periods(period) AS (
       SELECT ?
       UNION ALL
       SELECT period + 1 FROM periods WHERE period + 1 <= ?
     )
     SELECT a.id, (p.period - 1) / 12, (p.period - 1) % 12 + 1, a.due_amount
     FROM apartments a
     JOIN periods p
       ON p.period >= CAST(strftime('%Y', a.created_at) AS INTEGER) * 12
                    + CAST(strftime('%m', a.created_at) AS INTEGER)
     WHERE a.building_id = ? AND a.is_active = 1`,
    )
    .run(startPeriod, endPeriod, buildingId);
}

module.exports = { ensureMonthlyDues, currentPeriod };
