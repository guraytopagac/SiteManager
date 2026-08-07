const { getDb } = require("../../../database/db");
const { ensureMonthlyDues } = require("../shared/duesAccrual");

const ALLOWED_TABLES = new Set(["incomes", "expenses"]);

function fetchByMonth(table, buildingId, startDate, endDate) {
  if (!ALLOWED_TABLES.has(table)) throw new Error(`fetchByMonth: table not allowed: ${table}`);
  return getDb()
    .prepare(
      `SELECT id, amount, date, description
       FROM ${table}
       WHERE building_id = ? AND date BETWEEN ? AND ? AND is_cancelled = 0
       ORDER BY date ASC`,
    )
    .all(buildingId, startDate, endDate);
}

function getReportData(buildingId, year, month) {
  try {
    ensureMonthlyDues(buildingId);

    const yearStr = String(year);
    const monthStr = String(month).padStart(2, "0");
    const startDate = `${yearStr}-${monthStr}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${yearStr}-${monthStr}-${String(lastDay).padStart(2, "0")}`;

    const incomes = fetchByMonth("incomes", buildingId, startDate, endDate);
    const expenses = fetchByMonth("expenses", buildingId, startDate, endDate);

    const dues = getDb()
      .prepare(
        `SELECT a.apartment_no, a.floor, a.type, r.full_name AS resident_name,
                COALESCE(d.due_amount, a.due_amount) AS due_amount,
                COALESCE(d.paid_amount, 0) AS paid_amount,
                COALESCE(d.status, 'unpaid') AS status
         FROM apartments a
         LEFT JOIN dues d ON d.apartment_id = a.id AND d.year = ? AND d.month = ?
         LEFT JOIN residents r ON r.apartment_id = a.id AND r.is_active = 1
         WHERE a.building_id = ? AND a.is_active = 1
         ORDER BY a.apartment_no ASC`,
      )
      .all(year, month, buildingId);

    const totalIncome = incomes.reduce((sum, r) => sum + Number(r.amount), 0);
    const totalExpense = expenses.reduce((sum, r) => sum + Number(r.amount), 0);
    const totalDue = dues.reduce((sum, r) => sum + Number(r.due_amount), 0);
    const totalPaid = dues.reduce((sum, r) => sum + Number(r.paid_amount), 0);

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
