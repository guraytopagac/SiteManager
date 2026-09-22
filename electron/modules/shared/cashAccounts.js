// The two accounts of the main cash, cash on hand and the bank. Income, expense and the transfers between
// the two decide each balance. More than one module reads it: the dashboard, the ledger and the report.
const { getDb } = require("../../../database/db");

// A bank transfer or a card lands in the bank. Cash and other stay in hand, the manager counts an
// unusual payment as money received in person.
const BANK_METHODS = ["bank_transfer", "card"];

// Same list as CASH_ACCOUNTS in shared/validate.js and CASH_ACCOUNT_LABELS in src/utils/constants.js.
// The labels live here rather than with the validators, which give predicates and never messages.
const ACCOUNT_LABELS = {
  cash: "Nakit",
  bank: "Banka",
};

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

// What moved through each account inside one range, kept apart by source so a report can print the flow
// rather than only the closing split. A null start means the whole ledger. Income and expense are summed
// unsigned and the caller gives them their sign. A transfer carries one, because it adds to one account and
// takes from the other, so the two sides always cancel out. Money is not rounded here.
function cashFlow(buildingId, start = null, end = null) {
  const dateFilter = start === null ? "" : "AND date >= ? AND date < ?";
  const scope = start === null ? [buildingId] : [buildingId, start, end];
  const params = [...scope, ...scope, ...scope, ...scope];

  const rows = getDb()
    .prepare(
      `SELECT source, account, SUM(amount) AS total FROM (
         SELECT 'income' AS source, account, amount FROM incomes
         WHERE building_id = ? AND is_cancelled = 0 ${dateFilter}
         UNION ALL
         SELECT 'expense', account, amount FROM expenses
         WHERE building_id = ? AND is_cancelled = 0 ${dateFilter}
         UNION ALL
         SELECT 'transfer', to_account, amount FROM cash_transfers
         WHERE building_id = ? AND is_cancelled = 0 ${dateFilter}
         UNION ALL
         SELECT 'transfer', CASE to_account WHEN 'bank' THEN 'cash' ELSE 'bank' END, -amount FROM cash_transfers
         WHERE building_id = ? AND is_cancelled = 0 ${dateFilter}
       )
       GROUP BY source, account`,
    )
    .all(...params);

  const flow = {
    income: { cash: 0, bank: 0 },
    expense: { cash: 0, bank: 0 },
    transfer: { cash: 0, bank: 0 },
  };
  for (const row of rows) flow[row.source][row.account] = row.total;
  return flow;
}

function roundCents(value) {
  return Math.round(value * 100);
}

// Neither account may go below zero, so money only leaves one that holds it. Whole cents are compared,
// the same way the severance fund and the staff advances do, so a floating point leftover neither blocks
// a payment the account covers nor lets one through it does not.
function accountBlocker(buildingId, account, amount) {
  if (roundCents(cashBalances(buildingId)[account]) < roundCents(amount)) {
    return { success: false, message: `${ACCOUNT_LABELS[account]} hesabında yeterli bakiye yok.` };
  }
  return null;
}

// Cancelling takes back money the account already received, so it answers to the same rule. The sentence
// carries no subject, since an income, a transfer and a dues payment all reach it.
function accountCancelBlocker(buildingId, account, amount) {
  if (accountBlocker(buildingId, account, amount)) {
    return { success: false, message: `Bu iptal ${ACCOUNT_LABELS[account]} hesabının bakiyesini eksiye düşürür.` };
  }
  return null;
}

module.exports = { accountBlocker, accountCancelBlocker, accountForMethod, cashBalances, cashFlow };
