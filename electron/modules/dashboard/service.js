// The dashboard numbers. Cash covers all time, the collection rate covers this month, and the
// delay covers past months only.
const { getDb } = require("../../../database/db");
const { ensureMonthlyDues } = require("../shared/duesAccrual");
const { trYearMonth } = require("../shared/trTime");

// Counts active apartments only, so the debt of an inactive apartment stays out of the cards.
function fetchStats(buildingId, year, month) {
  const { totalIncome, totalExpense } = getDb()
    .prepare(
      `SELECT
         (SELECT COALESCE(SUM(amount), 0) FROM incomes WHERE building_id = ? AND is_cancelled = 0) AS totalIncome,
         (SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE building_id = ? AND is_cancelled = 0) AS totalExpense`,
    )
    .get(buildingId, buildingId);

  const { totalDue, totalPaid, totalOverdue } = getDb()
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN d.year = ? AND d.month = ? THEN d.due_amount END), 0) AS totalDue,
         COALESCE(SUM(CASE WHEN d.year = ? AND d.month = ? THEN d.paid_amount END), 0) AS totalPaid,
         COALESCE(SUM(CASE WHEN d.year < ? OR (d.year = ? AND d.month < ?)
                           THEN d.due_amount - d.paid_amount END), 0) AS totalOverdue
       FROM dues d
       JOIN apartments a ON d.apartment_id = a.id
       WHERE a.building_id = ? AND a.is_active = 1`,
    )
    .get(year, month, year, month, year, year, month, buildingId);

  return { totalIncome, totalExpense, totalDue, totalPaid, totalOverdue };
}

// Money is not rounded here. Formatting is the renderer's job.
function getStats(payload) {
  const { buildingId } = payload;
  try {
    const { year, month } = trYearMonth();

    // Accrue before reading, or this month would be missing from the numbers.
    ensureMonthlyDues(buildingId);

    const { totalIncome, totalExpense, totalDue, totalPaid, totalOverdue } = fetchStats(buildingId, year, month);

    return {
      success: true,
      data: {
        cash: totalIncome - totalExpense,
        // null instead of 0 when there is nothing to measure, so the UI can show a dash.
        collections: totalDue > 0 ? Math.round((totalPaid / totalDue) * 100) : null,
        delays: totalOverdue,
      },
    };
  } catch (err) {
    console.error("[dashboard.service] getStats:", err);
    return { success: false, message: "Dashboard verileri alınamadı." };
  }
}

module.exports = { getStats };
