-- Adds the fields a collection receipt and an expense voucher print but the ledger never kept.
-- Every column is nullable, so ADD COLUMN takes its CHECK in place and no table is rebuilt.
ALTER TABLE incomes ADD COLUMN payer_name TEXT
  CHECK(payer_name IS NULL OR (length(trim(payer_name)) > 0 AND length(payer_name) <= 60));

ALTER TABLE incomes ADD COLUMN payment_method TEXT
  CHECK(payment_method IS NULL OR payment_method IN ('cash', 'bank_transfer', 'card', 'other'));

ALTER TABLE expenses ADD COLUMN vendor_name TEXT
  CHECK(vendor_name IS NULL OR (length(trim(vendor_name)) > 0 AND length(vendor_name) <= 100));

ALTER TABLE expenses ADD COLUMN vendor_address TEXT
  CHECK(vendor_address IS NULL OR (length(trim(vendor_address)) > 0 AND length(vendor_address) <= 300));
