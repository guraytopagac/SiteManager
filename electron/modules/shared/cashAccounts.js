// The two accounts of the main cash, cash on hand and the bank. Income, expense and the transfers between
// the two decide each balance. More than one module reads it: the dashboard, the ledger and the report.
const { getDb } = require("../../../database/db");

// A bank transfer or a card lands in the bank. Cash and other stay in hand, the manager counts an
// unusual payment as money received in person.
const BANK_METHODS = ["bank_transfer", "card"];

function accountForMethod(method) {
  return BANK_METHODS.includes(method) ? "bank" : "cash";
}

// Uncancelled records per account. With a date, only what happened before that day counts. The default date
// is past every valid record, so without one the whole ledger is summed. Money is not rounded here.
function cashBalances(buildingId, before = "9999-12-31") {
  const rows = getDb()
    .prepare(
      `SELECT account, SUM(amount) AS total FROM (
         SELECT account, amount FROM incomes
         WHERE building_id = ? AND is_cancelled = 0 AND date < ?
         UNION ALL
         SELECT account, -amount FROM expenses
         WHERE building_id = ? AND is_cancelled = 0 AND date < ?
         UNION ALL
         SELECT to_account, amount FROM cash_transfers
         WHERE building_id = ? AND is_cancelled = 0 AND date < ?
         UNION ALL
         SELECT CASE to_account WHEN 'bank' THEN 'cash' ELSE 'bank' END, -amount FROM cash_transfers
         WHERE building_id = ? AND is_cancelled = 0 AND date < ?
       )
       GROUP BY account`,
    )
    .all(buildingId, before, buildingId, before, buildingId, before, buildingId, before);

  const balances = { cash: 0, bank: 0 };
  for (const row of rows) balances[row.account] = row.total;
  return balances;
}

module.exports = { accountForMethod, cashBalances };
