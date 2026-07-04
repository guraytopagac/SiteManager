-- Add recovery_hash column to users for admin password recovery.
-- Stores the bcrypt hash of a single-use recovery code (rotated on each use).
-- Fresh installs get this column from schema/01_users.sql; this migration
-- covers existing installations. "duplicate column name" is caught by migrate.js.
ALTER TABLE users ADD COLUMN recovery_hash TEXT;
