CREATE TRIGGER IF NOT EXISTS trg_payment_cancellations_no_delete
  BEFORE DELETE ON payment_cancellations FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'Payment cancellation records cannot be deleted.');
END;
