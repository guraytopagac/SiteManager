-- The severance fund of a building: money set aside for the severance pay of its staff. One row per
-- building, created when the fund is started. The balance is not stored, it is worked out from the
-- opening balance, the severance_fund expenses (the transfers out of the main cash, entered by hand on the
-- transactions page or written as the top-up of a payout) and the payouts.
CREATE TABLE IF NOT EXISTS severance_funds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  building_id INTEGER NOT NULL UNIQUE,
  -- Money already set aside before the fund was started. It never came out of the main cash.
  opening_balance REAL NOT NULL DEFAULT 0 CHECK(opening_balance >= 0 AND opening_balance <= 100000000),
  created_at TEXT NOT NULL DEFAULT (datetime('now', '+3 hours')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', '+3 hours')),
  FOREIGN KEY(building_id) REFERENCES buildings(id) ON DELETE RESTRICT
);

CREATE TRIGGER IF NOT EXISTS trg_severance_funds_no_delete
  BEFORE DELETE ON severance_funds FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'Severance funds cannot be deleted.');
END;
