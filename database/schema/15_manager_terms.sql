-- Terms of office of the managers who held the account. A handover rewrites the users row in place, so the
-- name behind collected_by, cancelled_by and recorded_by is always today's manager. This table keeps who
-- held the account and when: a record was made in the term whose window holds its timestamp.
CREATE TABLE IF NOT EXISTS manager_terms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  -- Copies of the users row at the time, since that row is overwritten by the next handover.
  manager_name TEXT NOT NULL CHECK(length(manager_name) BETWEEN 2 AND 60),
  username TEXT NOT NULL CHECK(length(username) BETWEEN 3 AND 30),
  started_at TEXT NOT NULL CHECK(datetime(started_at) IS NOT NULL),
  -- NULL while the term is running. Closed at the same instant the next term starts.
  ended_at TEXT CHECK(ended_at IS NULL OR datetime(ended_at) IS NOT NULL),
  created_at TEXT NOT NULL DEFAULT (datetime('now', '+3 hours')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', '+3 hours')),
  CHECK(ended_at IS NULL OR ended_at >= started_at),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE RESTRICT
);

-- One running term per account.
CREATE UNIQUE INDEX IF NOT EXISTS idx_manager_terms_open ON manager_terms(user_id) WHERE ended_at IS NULL;

-- Closing a running term is the only change allowed, a closed term is history and stays as it is.
CREATE TRIGGER IF NOT EXISTS trg_manager_terms_closed_immutable
  BEFORE UPDATE ON manager_terms FOR EACH ROW
  WHEN OLD.ended_at IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'Closed manager terms are immutable.');
END;

CREATE TRIGGER IF NOT EXISTS trg_manager_terms_no_delete
  BEFORE DELETE ON manager_terms FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'Manager terms cannot be deleted.');
END;
