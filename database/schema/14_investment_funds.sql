-- The investment fund of a building: money collected from the owners on top of the monthly dues and set
-- aside for the works that keep or raise the value of the building, such as a new roof or a lift. One row
-- per building, created when the fund is started. The balance is not stored, it is worked out from the
-- opening balance, the investment dues collected and the expenses marked as paid out of the fund.
CREATE TABLE IF NOT EXISTS investment_funds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  building_id INTEGER NOT NULL UNIQUE,
  -- Charged to every active apartment each month, the same figure for all of them. It is frozen into the
  -- dues row at accrual time, so changing it here never reaches a month already accrued.
  monthly_amount REAL NOT NULL CHECK(monthly_amount > 0 AND monthly_amount <= 50000),
  -- Money already set aside before the fund was started. It was never charged as an investment due.
  opening_balance REAL NOT NULL DEFAULT 0 CHECK(opening_balance >= 0 AND opening_balance <= 100000000),
  -- The month the current collection period accrues from, pinned to the 1st because accrual is monthly.
  -- It is not the day the fund was opened, created_at carries that: stopping and starting collection again
  -- moves this forward to the new month, so the months that were skipped never accrue.
  accrual_from TEXT NOT NULL CHECK(
    date(accrual_from) IS NOT NULL AND
    strftime('%d', accrual_from) = '01' AND
    accrual_from >= '2000-01-01' AND
    accrual_from <= '2100-12-31'
  ),
  -- Collection can be stopped without closing the fund: no further month accrues, the rows already
  -- accrued stay payable and the balance stays readable.
  is_collecting INTEGER NOT NULL DEFAULT 1 CHECK(is_collecting IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now', '+3 hours')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', '+3 hours')),
  FOREIGN KEY(building_id) REFERENCES buildings(id) ON DELETE RESTRICT
);

CREATE TRIGGER IF NOT EXISTS trg_investment_funds_no_delete
  BEFORE DELETE ON investment_funds FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'Investment funds cannot be deleted.');
END;
