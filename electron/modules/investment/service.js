// Investment fund rules. The fund charges every active apartment a fixed amount each month on top of the
// monthly dues, and the money pays for the works that keep or raise the value of the building. A charge is a
// dues row of the investment type, so it is collected, cancelled and receipted through the ordinary payment
// path. The owner owes it, not whoever lives there.
const { getDb } = require("../../../database/db");
const { createDbErrorResolver } = require("../shared/dbError");
const { ensureInvestmentDues, investmentTotals } = require("../shared/investmentFund");
const { OWNER_NAME_FOR_PERIOD_SQL, periodCutoff } = require("../shared/residentPeriod");
const { TR_NOW_SQL, monthBounds, trYearMonth } = require("../shared/trTime");

// No column of investment_funds can reach a UNIQUE or NOT NULL error: the handler fills them all and the
// service checks for an existing fund first. Only the CHECK branch can fire, and it reads no label.
const resolveDbError = createDbErrorResolver();

// Writes are refused on a removed or archived building, reads are not.
function buildingWriteBlocker(buildingId) {
  const building = getDb().prepare(`SELECT is_active FROM buildings WHERE id = ? AND is_removed = 0`).get(buildingId);
  if (!building) return { success: false, message: "Bina bulunamadı." };
  if (building.is_active === 0) {
    return { success: false, message: "Silinen bir binada yatırım aidatı işlemi yapılamaz." };
  }
  return null;
}

function findFund(buildingId) {
  return getDb()
    .prepare(
      `SELECT monthly_amount, opening_balance, accrual_from, is_collecting, date(created_at) AS started_on
       FROM investment_funds WHERE building_id = ?`,
    )
    .get(buildingId);
}

// Collection always resumes with the month in progress, never with a month already behind us.
function currentMonthStart() {
  const { year, month } = trYearMonth();
  return monthBounds(year, month).start;
}

// Says what actually changed, so stopping or resuming does not read as a plain settings update.
function updateMessage(wasCollecting, isCollecting) {
  if (!wasCollecting && isCollecting) return "Yatırım aidatı toplanmaya yeniden başlandı.";
  if (wasCollecting && !isCollecting) return "Yatırım aidatı toplanması durduruldu.";
  return "Yatırım aidatı ayarları güncellendi.";
}

// The investment page. Without a fund the page shows the start form, so fund, totals and start come back
// empty rather than as an error.
function getOverview(payload) {
  const { buildingId, year, month } = payload;
  try {
    ensureInvestmentDues(buildingId);

    const fund = findFund(buildingId);
    if (!fund) return { success: true, fund: null, data: [], start: null, totals: null };

    // An inner join, unlike the monthly dues list: a missing row means the fund was not collecting that
    // month, which is a real answer, not a row waiting to be accrued.
    // The owner subquery sits in the SELECT list, so its two bindings come before every other one.
    // apartment_no is TEXT, so the three-part sort keeps 1, 3A, 10, A1 in that order.
    const cutoff = periodCutoff(year, month);
    const data = getDb()
      .prepare(
        `SELECT a.id AS apartment_id, a.apartment_no, a.floor,
                d.id, d.year, d.month, d.due_amount, d.paid_amount, d.status,
                ${OWNER_NAME_FOR_PERIOD_SQL} AS owner_name
         FROM apartments a
         JOIN dues d ON d.apartment_id = a.id AND d.year = ? AND d.month = ? AND d.due_type = 'investment'
         WHERE a.building_id = ? AND a.is_active = 1
         ORDER BY (a.apartment_no GLOB '[0-9]*') DESC,
                  CAST(a.apartment_no AS INTEGER) ASC,
                  a.apartment_no COLLATE NOCASE ASC`,
      )
      .all(cutoff, cutoff, year, month, buildingId);

    // The earliest month the fund ever charged. Without it the renderer cannot tell "nothing was collected
    // in the month being viewed" from "nothing has ever been collected", both arrive as an empty list.
    const start = getDb()
      .prepare(
        `SELECT d.year, d.month FROM dues d JOIN apartments a ON a.id = d.apartment_id
         WHERE a.building_id = ? AND d.due_type = 'investment'
         ORDER BY d.year ASC, d.month ASC LIMIT 1`,
      )
      .get(buildingId);

    return { success: true, fund, data, start: start ?? null, totals: investmentTotals(buildingId) };
  } catch (err) {
    console.error("[investment.service] getOverview:", err);
    return { success: false, message: "Yatırım aidatı bilgileri alınamadı." };
  }
}

function setupFund(payload) {
  const { buildingId, monthlyAmount, openingBalance } = payload;
  try {
    const blocker = buildingWriteBlocker(buildingId);
    if (blocker) return blocker;
    if (findFund(buildingId)) return { success: false, message: "Bu binanın yatırım aidatı zaten başlatılmış." };

    getDb().transaction(() => {
      getDb()
        .prepare(
          `INSERT INTO investment_funds
             (building_id, monthly_amount, opening_balance, accrual_from, created_at, updated_at)
           VALUES (?, ?, ?, ?, ${TR_NOW_SQL}, ${TR_NOW_SQL})`,
        )
        .run(buildingId, monthlyAmount, openingBalance, currentMonthStart());

      ensureInvestmentDues(buildingId);
    })();

    return { success: true, message: "Yatırım aidatı başlatıldı." };
  } catch (err) {
    console.error("[investment.service] setupFund:", err);
    return { success: false, message: resolveDbError(err, "Yatırım aidatı başlatma") };
  }
}

function updateFund(payload) {
  const { buildingId, monthlyAmount, openingBalance, isCollecting } = payload;
  try {
    const blocker = buildingWriteBlocker(buildingId);
    if (blocker) return blocker;

    const fund = findFund(buildingId);
    if (!fund) return { success: false, message: "Yatırım aidatı henüz başlatılmamış." };

    // A new amount is frozen into the months accrued from now on, the ones already accrued keep theirs.
    // Resuming moves the accrual month forward, so the months collection was stopped never appear.
    const wasCollecting = fund.is_collecting === 1;
    const resumes = isCollecting && !wasCollecting;

    getDb().transaction(() => {
      getDb()
        .prepare(
          `UPDATE investment_funds
           SET monthly_amount = ?, opening_balance = ?, is_collecting = ?, accrual_from = ?,
               updated_at = ${TR_NOW_SQL}
           WHERE building_id = ?`,
        )
        .run(
          monthlyAmount,
          openingBalance,
          isCollecting ? 1 : 0,
          resumes ? currentMonthStart() : fund.accrual_from,
          buildingId,
        );

      if (isCollecting) ensureInvestmentDues(buildingId);
    })();

    return { success: true, message: updateMessage(wasCollecting, isCollecting) };
  } catch (err) {
    console.error("[investment.service] updateFund:", err);
    return { success: false, message: resolveDbError(err, "Yatırım aidatı güncelleme") };
  }
}

module.exports = { getOverview, setupFund, updateFund };
