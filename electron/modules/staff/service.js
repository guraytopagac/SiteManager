// Severance fund rules. The fund is filled by transfers from the main cash, entered by hand as expenses on
// the cash book page, and pays the staff's severance when they leave. Payouts are never deleted, a payout
// is cancelled instead.
const { getDb } = require("../../../database/db");
const { accountBlocker } = require("../shared/cashAccounts");
const { createDbErrorResolver } = require("../shared/dbError");
const { daysBetween, withSeveranceEstimate, severanceBalance } = require("../shared/severanceFund");
const { advanceBalances, hasAdvanceRecords } = require("../shared/staffAdvances");
const { TR_NOW_SQL, trToday } = require("../shared/trTime");

const COLUMN_LABELS = {
  full_name: "Ad soyad",
  start_date: "İşe giriş tarihi",
  gross_wage: "Brüt ücret",
  amount: "Tutar",
  date: "Tarih",
};

// A top-up is written as an expense, so it cannot pass the expense amount limit.
const MAX_TOP_UP = 1000000;

const resolveDbError = createDbErrorResolver(COLUMN_LABELS);

function roundCents(value) {
  return Math.round(value * 100);
}

// Writes are refused on a removed or archived building, reads are not.
function buildingWriteBlocker(buildingId) {
  const building = getDb().prepare(`SELECT is_active FROM buildings WHERE id = ? AND is_removed = 0`).get(buildingId);
  if (!building) return { success: false, message: "Bina bulunamadı." };
  if (building.is_active === 0) {
    return { success: false, message: "Silinen bir binada tazminat kasası işlemi yapılamaz." };
  }
  return null;
}

function hasFund(buildingId) {
  return Boolean(getDb().prepare(`SELECT 1 FROM severance_funds WHERE building_id = ?`).get(buildingId));
}

function findEmployee(employeeId, buildingId) {
  return getDb()
    .prepare(
      `SELECT e.id, e.full_name, e.start_date, e.end_date,
              (SELECT p.id FROM severance_payouts p WHERE p.employee_id = e.id AND p.is_cancelled = 0) AS payout_id,
              (SELECT COUNT(*) FROM severance_payouts p WHERE p.employee_id = e.id) AS payout_count
       FROM employees e WHERE e.id = ? AND e.building_id = ?`,
    )
    .get(employeeId, buildingId);
}

// Newest first. On the same day and second a payout goes above its own top-up, since it was written last.
function compareMovements(a, b) {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  if (a.created_at !== b.created_at) return a.created_at < b.created_at ? 1 : -1;
  return (b.type === "payout") - (a.type === "payout");
}

// One list for the page. The opening balance is the oldest entry, so it closes the list.
function buildMovements(fund, transfers, payouts) {
  const movements = [
    ...transfers.map((transfer) => ({
      key: `transfer-${transfer.id}`,
      type: transfer.is_top_up ? "top_up" : "transfer",
      date: transfer.date,
      amount: transfer.amount,
      is_cancelled: transfer.is_cancelled,
      created_at: transfer.created_at,
    })),
    ...payouts.map((payout) => ({
      key: `payout-${payout.id}`,
      type: "payout",
      id: payout.id,
      date: payout.date,
      amount: payout.amount,
      is_cancelled: payout.is_cancelled,
      employee_name: payout.employee_name,
      note: payout.note,
      cancelled_at: payout.cancelled_at,
      cancel_reason: payout.cancel_reason,
      top_up_amount: payout.top_up_amount,
      created_at: payout.created_at,
    })),
  ].sort(compareMovements);

  if (fund.opening_balance > 0) {
    movements.push({ key: "opening", type: "opening", date: fund.started_on, amount: fund.opening_balance });
  }
  return movements;
}

// The staff page. The employees are listed whether or not the fund is started. Until it is, fund and totals are
// null and there are no movements, so the page shows the start form in their place.
function getOverview(payload) {
  const { buildingId } = payload;
  try {
    const fund = getDb()
      .prepare(`SELECT opening_balance, date(created_at) AS started_on FROM severance_funds WHERE building_id = ?`)
      .get(buildingId);

    const asOf = trToday();
    const advances = advanceBalances(buildingId);
    const employees = getDb()
      .prepare(
        `SELECT e.id, e.full_name, e.role, e.start_date, e.gross_wage, e.end_date,
                p.id AS payout_id, p.amount AS payout_amount, p.date AS payout_date
         FROM employees e
         LEFT JOIN severance_payouts p ON p.employee_id = e.id AND p.is_cancelled = 0
         WHERE e.building_id = ?
         ORDER BY (e.end_date IS NULL) DESC, e.start_date ASC, e.id ASC`,
      )
      .all(buildingId)
      // A leaver's worked days end on the leaving date and carry no estimate, the payout replaces it.
      .map((employee) =>
        employee.end_date
          ? { ...employee, worked_days: daysBetween(employee.start_date, employee.end_date) }
          : withSeveranceEstimate(employee, asOf),
      )
      .map((employee) => ({ ...employee, advance_balance: advances.get(employee.id) ?? 0 }));

    if (!fund) {
      return { success: true, data: { fund: null, totals: null, employees, movements: [] } };
    }

    // A transfer a payout points at is that payout's top-up, every other one was entered by hand.
    const transfers = getDb()
      .prepare(
        `SELECT e.id, e.amount, e.date, e.is_cancelled, e.created_at, p.id IS NOT NULL AS is_top_up
         FROM expenses e
         LEFT JOIN severance_payouts p ON p.top_up_expense_id = e.id
         WHERE e.building_id = ? AND e.category = 'severance_fund'`,
      )
      .all(buildingId);

    const payouts = getDb()
      .prepare(
        `SELECT p.id, p.amount, p.date, p.note, p.is_cancelled, p.cancelled_at, p.cancel_reason, p.created_at,
                emp.full_name AS employee_name, top_up.amount AS top_up_amount
         FROM severance_payouts p
         JOIN employees emp ON emp.id = p.employee_id
         LEFT JOIN expenses top_up ON top_up.id = p.top_up_expense_id
         WHERE p.building_id = ?`,
      )
      .all(buildingId);

    const activeEmployees = employees.filter((employee) => !employee.end_date);
    const balance = severanceBalance(buildingId);
    const liability = activeEmployees.reduce((sum, employee) => sum + employee.liability, 0);

    return {
      success: true,
      data: {
        fund: {
          openingBalance: fund.opening_balance,
          startedOn: fund.started_on,
        },
        totals: {
          balance,
          liability,
          // Positive when the fund is short, negative when it holds more than the estimate.
          shortfall: liability - balance,
        },
        employees,
        movements: buildMovements(fund, transfers, payouts),
      },
    };
  } catch (err) {
    console.error("[staff.service] getOverview:", err);
    return { success: false, message: "Personel bilgileri alınamadı." };
  }
}

// The staff with their open advance, for the employee picker of the ledger. Working employees come first. It
// does not need a started fund.
function getEmployees(payload) {
  const { buildingId } = payload;
  try {
    const advances = advanceBalances(buildingId);
    const employees = getDb()
      .prepare(
        `SELECT id, full_name, role, end_date FROM employees WHERE building_id = ?
         ORDER BY (end_date IS NULL) DESC, full_name COLLATE NOCASE ASC, id ASC`,
      )
      .all(buildingId)
      .map((employee) => ({ ...employee, advance_balance: advances.get(employee.id) ?? 0 }));
    return { success: true, data: employees };
  } catch (err) {
    console.error("[staff.service] getEmployees:", err);
    return { success: false, message: "Çalışan listesi alınamadı." };
  }
}

// The fund starts with its opening balance only. Money reaches it through the transfers entered by hand.
function setupFund(payload) {
  const { buildingId, openingBalance } = payload;
  try {
    const blocker = buildingWriteBlocker(buildingId);
    if (blocker) return blocker;
    if (hasFund(buildingId)) return { success: false, message: "Bu binanın tazminat kasası zaten başlatılmış." };

    getDb()
      .prepare(
        `INSERT INTO severance_funds (building_id, opening_balance, created_at, updated_at)
         VALUES (?, ?, ${TR_NOW_SQL}, ${TR_NOW_SQL})`,
      )
      .run(buildingId, openingBalance);

    return { success: true, message: "Tazminat kasası başlatıldı." };
  } catch (err) {
    console.error("[staff.service] setupFund:", err);
    return { success: false, message: resolveDbError(err, "Tazminat kasası başlatma") };
  }
}

function updateFund(payload) {
  const { buildingId, openingBalance } = payload;
  try {
    const blocker = buildingWriteBlocker(buildingId);
    if (blocker) return blocker;
    if (!hasFund(buildingId)) return { success: false, message: "Tazminat kasası henüz başlatılmamış." };

    getDb()
      .prepare(`UPDATE severance_funds SET opening_balance = ?, updated_at = ${TR_NOW_SQL} WHERE building_id = ?`)
      .run(openingBalance, buildingId);

    return { success: true, message: "Tazminat kasası ayarları güncellendi." };
  } catch (err) {
    console.error("[staff.service] updateFund:", err);
    return { success: false, message: resolveDbError(err, "Tazminat kasası güncelleme") };
  }
}

function addEmployee(payload) {
  const { buildingId, full_name: fullName, role, start_date: startDate, gross_wage: grossWage } = payload;
  try {
    const blocker = buildingWriteBlocker(buildingId);
    if (blocker) return blocker;

    const result = getDb()
      .prepare(
        `INSERT INTO employees (building_id, full_name, role, start_date, gross_wage, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ${TR_NOW_SQL}, ${TR_NOW_SQL})`,
      )
      .run(buildingId, fullName, role, startDate, grossWage);

    return { success: true, id: result.lastInsertRowid, message: `${fullName} eklendi.` };
  } catch (err) {
    console.error("[staff.service] addEmployee:", err);
    return { success: false, message: resolveDbError(err, "Çalışan ekleme") };
  }
}

// The leaving date of a paid employee belongs to the payout, so it only changes through a cancel.
function updateEmployee(payload) {
  const { buildingId, employeeId, full_name: fullName, role, start_date: startDate } = payload;
  const { gross_wage: grossWage, end_date: endDate } = payload;
  try {
    const blocker = buildingWriteBlocker(buildingId);
    if (blocker) return blocker;

    const employee = findEmployee(employeeId, buildingId);
    if (!employee) return { success: false, message: "Çalışan bulunamadı." };
    if (employee.payout_id && endDate !== employee.end_date) {
      return {
        success: false,
        message: "Tazminatı ödenmiş bir çalışanın ayrılış tarihi, ödeme iptal edilmeden değiştirilemez.",
      };
    }
    if (endDate && endDate < startDate) {
      return { success: false, message: "Ayrılış tarihi işe giriş tarihinden önce olamaz." };
    }

    getDb()
      .prepare(
        `UPDATE employees SET full_name = ?, role = ?, start_date = ?, gross_wage = ?, end_date = ?,
         updated_at = ${TR_NOW_SQL} WHERE id = ? AND building_id = ?`,
      )
      .run(fullName, role, startDate, grossWage, endDate, employeeId, buildingId);

    return { success: true, message: `${fullName} güncellendi.` };
  } catch (err) {
    console.error("[staff.service] updateEmployee:", err);
    return { success: false, message: resolveDbError(err, "Çalışan güncelleme") };
  }
}

// Only a mistaken entry is deleted. Once a payout exists, even a cancelled one, the row is history.
function deleteEmployee(payload) {
  const { buildingId, employeeId } = payload;
  try {
    const blocker = buildingWriteBlocker(buildingId);
    if (blocker) return blocker;

    const employee = findEmployee(employeeId, buildingId);
    if (!employee) return { success: false, message: "Çalışan bulunamadı." };
    if (employee.payout_count > 0) {
      return { success: false, message: "Ödeme kaydı olan bir çalışan silinemez." };
    }
    if (hasAdvanceRecords(employeeId)) {
      return { success: false, message: "Avans kaydı olan bir çalışan silinemez." };
    }

    getDb().prepare(`DELETE FROM employees WHERE id = ? AND building_id = ?`).run(employeeId, buildingId);
    return { success: true, message: `${employee.full_name} silindi.` };
  } catch (err) {
    console.error("[staff.service] deleteEmployee:", err);
    return { success: false, message: resolveDbError(err, "Çalışan silme") };
  }
}

// When the fund is short, the difference is moved from the main cash in the same transaction, so the
// fund never goes below zero. The account paying that difference must hold it, so a payout the main cash
// cannot cover is refused whole. The amounts are compared in whole cents.
function recordPayout(payload) {
  const {
    buildingId,
    employeeId,
    userId,
    amount,
    date,
    end_date: endDate,
    note,
    top_up_account: topUpAccount,
  } = payload;
  try {
    const blocker = buildingWriteBlocker(buildingId);
    if (blocker) return blocker;
    if (!hasFund(buildingId)) return { success: false, message: "Tazminat kasası henüz başlatılmamış." };

    const employee = findEmployee(employeeId, buildingId);
    if (!employee) return { success: false, message: "Çalışan bulunamadı." };
    if (employee.payout_id) return { success: false, message: "Bu çalışanın tazminatı zaten ödenmiş." };
    if (endDate < employee.start_date) {
      return { success: false, message: "Ayrılış tarihi işe giriş tarihinden önce olamaz." };
    }

    const shortfallCents = roundCents(amount) - Math.max(roundCents(severanceBalance(buildingId)), 0);
    const topUpAmount = shortfallCents > 0 ? shortfallCents / 100 : 0;
    if (topUpAmount > MAX_TOP_UP) {
      return {
        success: false,
        message:
          "Kasada eksik kalan tutar 1.000.000₺'yi aşıyor. Önce Kasa Defteri sayfasından tazminat kasasına aktarım yapın.",
      };
    }
    if (topUpAmount > 0) {
      const blocker = accountBlocker(buildingId, topUpAccount, topUpAmount);
      if (blocker) return blocker;
    }

    const db = getDb();
    db.transaction(() => {
      let topUpExpenseId = null;
      if (topUpAmount > 0) {
        topUpExpenseId = db
          .prepare(
            `INSERT INTO expenses (building_id, amount, date, description, category, account, created_at, updated_at)
             VALUES (?, ?, ?, NULL, 'severance_fund', ?, ${TR_NOW_SQL}, ${TR_NOW_SQL})`,
          )
          .run(buildingId, topUpAmount, date, topUpAccount).lastInsertRowid;
      }

      db.prepare(
        `INSERT INTO severance_payouts
           (building_id, employee_id, amount, date, note, top_up_expense_id, recorded_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ${TR_NOW_SQL}, ${TR_NOW_SQL})`,
      ).run(buildingId, employeeId, amount, date, note, topUpExpenseId, userId);

      db.prepare(`UPDATE employees SET end_date = ?, updated_at = ${TR_NOW_SQL} WHERE id = ?`).run(endDate, employeeId);
    })();

    return { success: true, topUpAmount, message: `${employee.full_name} için tazminat ödemesi kaydedildi.` };
  } catch (err) {
    console.error("[staff.service] recordPayout:", err);
    return { success: false, message: resolveDbError(err, "Tazminat ödemesi") };
  }
}

// The top-up expense is cancelled with the payout, and the employee counts as working again.
function cancelPayout(payload) {
  const { buildingId, payoutId, userId, reason } = payload;
  try {
    const blocker = buildingWriteBlocker(buildingId);
    if (blocker) return blocker;

    const payout = getDb()
      .prepare(
        `SELECT employee_id, is_cancelled, top_up_expense_id
         FROM severance_payouts WHERE id = ? AND building_id = ?`,
      )
      .get(payoutId, buildingId);
    if (!payout) return { success: false, message: "Ödeme bulunamadı." };
    if (payout.is_cancelled) return { success: false, message: "Bu ödeme zaten iptal edilmiş." };

    const db = getDb();
    db.transaction(() => {
      db.prepare(
        `UPDATE severance_payouts SET is_cancelled = 1, cancelled_at = ${TR_NOW_SQL}, cancel_reason = ?,
         cancelled_by = ?, updated_at = ${TR_NOW_SQL} WHERE id = ?`,
      ).run(reason, userId, payoutId);

      if (payout.top_up_expense_id) {
        db.prepare(
          `UPDATE expenses SET is_cancelled = 1, cancelled_at = ${TR_NOW_SQL}, cancel_reason = ?, cancelled_by = ?,
           updated_at = ${TR_NOW_SQL} WHERE id = ?`,
        ).run(reason, userId, payout.top_up_expense_id);
      }

      db.prepare(`UPDATE employees SET end_date = NULL, updated_at = ${TR_NOW_SQL} WHERE id = ?`).run(
        payout.employee_id,
      );
    })();

    return { success: true, message: "Tazminat ödemesi iptal edildi." };
  } catch (err) {
    console.error("[staff.service] cancelPayout:", err);
    return { success: false, message: resolveDbError(err, "Ödeme iptali") };
  }
}

module.exports = {
  getOverview,
  getEmployees,
  setupFund,
  updateFund,
  addEmployee,
  updateEmployee,
  deleteEmployee,
  recordPayout,
  cancelPayout,
};
