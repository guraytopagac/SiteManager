const db = require("../../database/db");

const ALLOWED_TABLES = new Set(["incomes", "expenses"]);

function fetchByMonth(table, managerId, startDate, endDate) {
  if (!ALLOWED_TABLES.has(table)) throw new Error(`İzinsiz tablo: ${table}`);
  return db
    .prepare(
      `SELECT id, amount, date, description
       FROM ${table}
       WHERE manager_id = ? AND date BETWEEN ? AND ?
       ORDER BY date ASC`,
    )
    .all(managerId, startDate, endDate);
}

function getReportData(managerId, year, month) {
  try {
    if (!managerId) return { success: false, message: "Yetkisiz işlem." };
    if (!year || !month || isNaN(year) || isNaN(month)) {
      return { success: false, message: "Geçersiz yıl veya ay." };
    }
    if (year < 2000 || year > 2100) {
      return { success: false, message: "Geçersiz yıl." };
    }
    if (month < 1 || month > 12) {
      return { success: false, message: "Geçersiz ay." };
    }

    const yearStr = String(year);
    const monthStr = String(month).padStart(2, "0");
    const startDate = `${yearStr}-${monthStr}-01`;
    const endDate = new Date(year, month, 0).toISOString().split("T")[0];

    const incomes = fetchByMonth("incomes", managerId, startDate, endDate);
    const expenses = fetchByMonth("expenses", managerId, startDate, endDate);

    const dues = db
      .prepare(
        `SELECT a.apartment_no, a.floor, a.type, r.full_name AS resident_name,
                d.due_amount, d.paid_amount, d.status
         FROM dues d
         JOIN apartments a ON d.apartment_id = a.id
         LEFT JOIN residents r ON r.apartment_id = a.id AND r.is_active = 1
         WHERE a.manager_id = ? AND d.year = ? AND d.month = ?
         ORDER BY a.apartment_no ASC`,
      )
      .all(managerId, year, month);

    const totalIncome = incomes.reduce((sum, r) => sum + Number(r.amount), 0);
    const totalExpense = expenses.reduce((sum, r) => sum + Number(r.amount), 0);
    const totalDue = dues.reduce((sum, r) => sum + Number(r.due_amount), 0);
    const totalPaid = dues.reduce((sum, r) => sum + Number(r.paid_amount), 0);

    return {
      success: true,
      data: { incomes, expenses, dues, totalIncome, totalExpense, totalDue, totalPaid },
    };
  } catch (err) {
    console.error("[report] getReportData:", err);
    return { success: false, message: "Rapor verileri alınamadı." };
  }
}

module.exports = { getReportData };
