-- Keep a resident active when move_out_date is in the future; only deactivate
-- once the move-out date has actually arrived (<= today). Previously any
-- move_out_date immediately set is_active = 0, hiding still-current residents.
DROP TRIGGER IF EXISTS trg_residents_move_out;

DROP TRIGGER IF EXISTS trg_residents_move_out_insert;

CREATE TRIGGER trg_residents_move_out
  AFTER UPDATE OF move_out_date ON residents FOR EACH ROW
  WHEN NEW.move_out_date IS NOT NULL AND NEW.is_active = 1
       AND NEW.move_out_date <= date('now')
BEGIN
  UPDATE residents SET is_active = 0 WHERE id = NEW.id;
END;

CREATE TRIGGER trg_residents_move_out_insert
  AFTER INSERT ON residents FOR EACH ROW
  WHEN NEW.move_out_date IS NOT NULL AND NEW.is_active = 1
       AND NEW.move_out_date <= date('now')
BEGIN
  UPDATE residents SET is_active = 0 WHERE id = NEW.id;
END;

-- Reactivate residents that were deactivated by the old trigger but whose
-- move-out date is still in the future.
UPDATE residents SET is_active = 1
  WHERE is_active = 0 AND move_out_date IS NOT NULL AND move_out_date > date('now');
