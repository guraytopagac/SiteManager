-- Add soft-delete/cancellation columns to incomes and expenses tables.
-- These columns were introduced after v1.0.0; ALTER TABLE ADD COLUMN is safe here
-- because migrate.js treats "duplicate column name" errors as no-ops.
ALTER TABLE incomes ADD COLUMN is_cancelled INTEGER DEFAULT 0;
ALTER TABLE incomes ADD COLUMN cancelled_at TEXT;
ALTER TABLE incomes ADD COLUMN cancel_reason TEXT;
ALTER TABLE incomes ADD COLUMN cancelled_by INTEGER;
ALTER TABLE incomes ADD COLUMN due_payment_id INTEGER;

ALTER TABLE expenses ADD COLUMN is_cancelled INTEGER DEFAULT 0;
ALTER TABLE expenses ADD COLUMN cancelled_at TEXT;
ALTER TABLE expenses ADD COLUMN cancel_reason TEXT;
ALTER TABLE expenses ADD COLUMN cancelled_by INTEGER;
