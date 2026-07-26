DROP TRIGGER IF EXISTS trg_users_updated_at;
DROP TRIGGER IF EXISTS trg_dues_updated_at;
DROP TRIGGER IF EXISTS trg_residents_move_out;
DROP TRIGGER IF EXISTS trg_residents_move_out_insert;
DROP TRIGGER IF EXISTS trg_incomes_prevent_update_after_cancel;
DROP TRIGGER IF EXISTS trg_expenses_prevent_update_after_cancel;
DROP TRIGGER IF EXISTS trg_payment_cancellations_immutable;

UPDATE users SET
  created_at = datetime(created_at, '+3 hours'),
  updated_at = datetime(updated_at, '+3 hours'),
  last_login = datetime(last_login, '+3 hours'),
  password_changed_at = datetime(password_changed_at, '+3 hours');

UPDATE apartments SET
  created_at = datetime(created_at, '+3 hours'),
  updated_at = datetime(updated_at, '+3 hours');

UPDATE residents SET
  created_at = datetime(created_at, '+3 hours'),
  updated_at = datetime(updated_at, '+3 hours');

UPDATE incomes SET
  created_at = datetime(created_at, '+3 hours'),
  updated_at = datetime(updated_at, '+3 hours'),
  cancelled_at = datetime(cancelled_at, '+3 hours');

UPDATE expenses SET
  created_at = datetime(created_at, '+3 hours'),
  updated_at = datetime(updated_at, '+3 hours'),
  cancelled_at = datetime(cancelled_at, '+3 hours');

UPDATE dues SET
  created_at = datetime(created_at, '+3 hours'),
  updated_at = datetime(updated_at, '+3 hours');

UPDATE due_payments SET
  created_at = datetime(created_at, '+3 hours');

UPDATE payment_cancellations SET
  cancelled_at = datetime(cancelled_at, '+3 hours');

CREATE TRIGGER trg_users_updated_at
  AFTER UPDATE ON users FOR EACH ROW
  WHEN OLD.updated_at = NEW.updated_at
BEGIN
  UPDATE users SET updated_at = datetime('now', '+3 hours') WHERE id = NEW.id;
END;

CREATE TRIGGER trg_dues_updated_at
  AFTER UPDATE ON dues FOR EACH ROW
  WHEN OLD.updated_at = NEW.updated_at
BEGIN
  UPDATE dues SET updated_at = datetime('now', '+3 hours') WHERE id = NEW.id;
END;

CREATE TRIGGER trg_residents_move_out
  AFTER UPDATE OF move_out_date ON residents FOR EACH ROW
  WHEN NEW.move_out_date IS NOT NULL AND NEW.is_active = 1
       AND NEW.move_out_date <= date('now', '+3 hours')
BEGIN
  UPDATE residents SET is_active = 0 WHERE id = NEW.id;
END;

CREATE TRIGGER trg_residents_move_out_insert
  AFTER INSERT ON residents FOR EACH ROW
  WHEN NEW.move_out_date IS NOT NULL AND NEW.is_active = 1
       AND NEW.move_out_date <= date('now', '+3 hours')
BEGIN
  UPDATE residents SET is_active = 0 WHERE id = NEW.id;
END;

CREATE TRIGGER trg_incomes_prevent_update_after_cancel
  BEFORE UPDATE ON incomes FOR EACH ROW
  WHEN OLD.is_cancelled = 1
BEGIN
  SELECT RAISE(ABORT, 'Cancelled income records cannot be modified.');
END;

CREATE TRIGGER trg_expenses_prevent_update_after_cancel
  BEFORE UPDATE ON expenses FOR EACH ROW
  WHEN OLD.is_cancelled = 1
BEGIN
  SELECT RAISE(ABORT, 'Cancelled expense records cannot be modified.');
END;

CREATE TRIGGER trg_payment_cancellations_immutable
  BEFORE UPDATE ON payment_cancellations FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'Payment cancellation records are immutable.');
END;
