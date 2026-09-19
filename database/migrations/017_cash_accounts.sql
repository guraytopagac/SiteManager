-- Splits the main cash into two accounts, cash on hand and the bank. Every income and expense says which
-- one it moved. An income follows its payment method: a bank transfer or a card lands in the bank, cash and
-- other stay in hand. Expenses carried no source before, so they all count as cash, and a transfer between
-- the accounts corrects the split when the real figures differ. The cancel triggers would refuse the update
-- of a cancelled income, so they are dropped for the backfill and created again.

ALTER TABLE incomes ADD COLUMN account TEXT NOT NULL DEFAULT 'cash' CHECK(account IN ('cash', 'bank'));
ALTER TABLE expenses ADD COLUMN account TEXT NOT NULL DEFAULT 'cash' CHECK(account IN ('cash', 'bank'));

DROP TRIGGER IF EXISTS trg_incomes_prevent_update_after_cancel;

UPDATE incomes SET account = 'bank'
WHERE payment_method IN ('bank_transfer', 'card')
   OR due_payment_id IN (SELECT id FROM due_payments WHERE payment_method IN ('bank_transfer', 'card'));

CREATE TRIGGER IF NOT EXISTS trg_incomes_prevent_update_after_cancel
  BEFORE UPDATE ON incomes FOR EACH ROW
  WHEN OLD.is_cancelled = 1
BEGIN
  SELECT RAISE(ABORT, 'Cancelled income records cannot be modified.');
END;
