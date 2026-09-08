// Monthly report data. It only reads, and it never rounds money. That is the renderer's job.
const { getDb } = require("../../../database/db");
const { ensureMonthlyDues } = require("../shared/duesAccrual");
const { RESIDENT_NAME_FOR_PERIOD_SQL } = require("../shared/residentPeriod");
const { createdPeriodSql, monthBounds, toPeriod } = require("../shared/trTime");

// The records of one month that are not cancelled. The table name comes from a fixed string only.
function fetchByMonth(table, buildingId, start, end) {
  return getDb()
    .prepare(
      `SELECT id, amount, date, description
       FROM ${table}
       WHERE building_id = ? AND date >= ? AND date < ? AND is_cancelled = 0
       ORDER BY date ASC, id ASC`,
    )
    .all(buildingId, start, end);
}

// The dues rows carry apartment_id, which the renderer needs.
function getReportData(payload) {
  const { buildingId, year, month } = payload;
  try {
    // Accrue before reading, like the dues list does.
    ensureMonthlyDues(buildingId);

    const { start, end } = monthBounds(year, month);

    const incomes = fetchByMonth("incomes", buildingId, start, end);
    const expenses = fetchByMonth("expenses", buildingId, start, end);

    const period = toPeriod(year, month);

    // Same resident subquery, same month filter, same ordering and same binding order as
    // getDuesForMonth. A report of a past month names the residents of that month.
    const dues = getDb()
      .prepare(
        `SELECT a.id AS apartment_id, a.apartment_no, a.floor, a.type,
                ${RESIDENT_NAME_FOR_PERIOD_SQL} AS resident_name,
                COALESCE(d.due_amount, a.due_amount) AS due_amount,
                COALESCE(d.paid_amount, 0) AS paid_amount,
                COALESCE(d.status, 'unpaid') AS status
         FROM apartments a
         LEFT JOIN dues d ON d.apartment_id = a.id AND d.year = ? AND d.month = ?
         WHERE a.building_id = ? AND a.is_active = 1 AND ${createdPeriodSql("a.")} <= ?
         ORDER BY (a.apartment_no GLOB '[0-9]*') DESC,
                  CAST(a.apartment_no AS INTEGER) ASC,
                  a.apartment_no COLLATE NOCASE ASC`,
      )
      .all(period, period, year, month, buildingId, period);

    const totalIncome = incomes.reduce((sum, r) => sum + r.amount, 0);
    const totalExpense = expenses.reduce((sum, r) => sum + r.amount, 0);
    const totalDue = dues.reduce((sum, r) => sum + r.due_amount, 0);
    const totalPaid = dues.reduce((sum, r) => sum + r.paid_amount, 0);

    return {
      success: true,
      data: { incomes, expenses, dues, totalIncome, totalExpense, totalDue, totalPaid },
    };
  } catch (err) {
    console.error("[report.service] getReportData:", err);
    return { success: false, message: "Rapor verileri alınamadı." };
  }
}

module.exports = { getReportData };
