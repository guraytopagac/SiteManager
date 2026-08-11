const FINANCIAL_TABLES = new Set(["incomes", "expenses"]);

function assertFinancialTable(table, context) {
  if (!FINANCIAL_TABLES.has(table)) throw new Error(`${context}: table not allowed: ${table}`);
}

module.exports = { assertFinancialTable };
