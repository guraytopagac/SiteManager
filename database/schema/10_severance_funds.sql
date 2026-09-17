-- The severance fund of a building: money set aside for the severance pay of its staff. One row per
-- building, created when the fund is started. The balance is not stored, it is worked out from the
-- opening balance, the severance_fund expenses (the transfers out of the main cash) and the payouts.
CREATE TABLE IF NOT EXISTS severance_funds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  building_id INTEGER NOT NULL UNIQUE,
  -- Money already set aside before the fund was started. It never came out of the main cash.
  opening_balance REAL NOT NULL DEFAULT 0 CHECK(opening_balance >= 0 AND opening_balance <= 100000000),
  -- Moved from the main cash every month. Zero pauses the transfers.
  monthly_amount REAL NOT NULL CHECK(monthly_amount >= 0 AND monthly_amount <= 1000000),
  -- The last period (year * 12 + month) the monthly transfers were written for. Months are never filled in
  -- behind it, so a paused month stays empty when the transfers start again, and a month is never
  -- written twice.
  transferred_through INTEGER NOT NULL CHECK(transferred_through >= 24000 AND transferred_through <= 25212),
  created_at TEXT NOT NULL DEFAULT (datetime('now', '+3 hours')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', '+3 hours')),
  FOREIGN KEY(building_id) REFERENCES buildings(id) ON DELETE RESTRICT
);

CREATE TRIGGER IF NOT EXISTS trg_severance_funds_no_delete
  BEFORE DELETE ON severance_funds FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'Severance funds cannot be deleted.');
END;
