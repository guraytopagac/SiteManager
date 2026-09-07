-- Who physically collected the payment. collected_by stays the account that recorded the row, so
-- this column only carries a name when the money was taken by someone other than the account owner.
ALTER TABLE due_payments ADD COLUMN collector_name TEXT CHECK(
  collector_name IS NULL OR (length(trim(collector_name)) > 0 AND length(collector_name) <= 60)
);
