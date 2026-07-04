-- payment_cancellations is meant to be an immutable audit log, but the existing
-- trigger only blocks UPDATE. Add a matching BEFORE DELETE trigger so rows also
-- cannot be deleted once written.
CREATE TRIGGER IF NOT EXISTS trg_payment_cancellations_no_delete
  BEFORE DELETE ON payment_cancellations FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'Payment cancellation records cannot be deleted.');
END;
