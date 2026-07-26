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

UPDATE residents SET is_active = 1
  WHERE is_active = 0 AND move_out_date IS NOT NULL AND move_out_date > date('now');
