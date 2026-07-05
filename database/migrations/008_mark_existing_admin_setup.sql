UPDATE users SET password_changed_at = COALESCE(password_changed_at, datetime('now'))
WHERE role = 'admin';
