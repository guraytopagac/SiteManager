ALTER TABLE users ADD COLUMN display_name TEXT;

UPDATE users SET display_name = username WHERE role = 'manager' AND display_name IS NULL;
