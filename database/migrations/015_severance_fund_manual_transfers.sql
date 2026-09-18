-- The monthly transfer is no longer written automatically. A transfer is now an expense of the
-- severance_fund category entered by hand on the transactions page, so the fund row keeps only its
-- opening balance. The transfers already written stay in expenses as history.
ALTER TABLE severance_funds DROP COLUMN monthly_amount;
ALTER TABLE severance_funds DROP COLUMN transferred_through;
