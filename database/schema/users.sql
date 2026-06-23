-- Users table: stores admin and manager accounts.
-- Passwords are never stored in plain text (bcrypt hash only).
-- Account lockout: failed_login_attempts + locked_until enforce brute-force protection.
-- Remember-me: remember_token (64 chars) + remember_token_expires for persistent sessions.
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL COLLATE NOCASE CHECK(
    length(username) >= 3 AND
    username GLOB '[A-Za-z_][A-Za-z0-9_]*'
  ),
  email TEXT UNIQUE NOT NULL CHECK(email LIKE '%@%.%' AND length(email) BETWEEN 5 AND 254),
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'manager' CHECK(role IN ('admin', 'manager')),
  is_active INTEGER DEFAULT 1 CHECK(is_active IN (0, 1)),
  failed_login_attempts INTEGER DEFAULT 0 CHECK(failed_login_attempts >= 0),
  locked_until TEXT CHECK(locked_until IS NULL OR datetime(locked_until) IS NOT NULL),
  last_login TEXT CHECK(last_login IS NULL OR datetime(last_login) IS NOT NULL),
  remember_token TEXT CHECK(remember_token IS NULL OR length(remember_token) = 64),
  remember_token_expires TEXT CHECK(
    remember_token_expires IS NULL OR
    datetime(remember_token_expires) IS NOT NULL
  ),
  password_changed_at TEXT CHECK(
    password_changed_at IS NULL OR
    datetime(password_changed_at) IS NOT NULL
  ),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_role_active ON users(role, is_active);
CREATE INDEX IF NOT EXISTS idx_users_remember_token ON users(remember_token);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username COLLATE NOCASE);

-- Auto-update updated_at on any row change
CREATE TRIGGER IF NOT EXISTS trg_users_updated_at
  AFTER UPDATE ON users FOR EACH ROW
  WHEN OLD.updated_at = NEW.updated_at
BEGIN
  UPDATE users SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- Clear lockout data when account is re-activated
CREATE TRIGGER IF NOT EXISTS trg_users_clear_lock_on_activate
  AFTER UPDATE OF is_active ON users FOR EACH ROW
  WHEN NEW.is_active = 1
BEGIN
  UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = NEW.id;
END;

-- Clear remember_token when account is deactivated
CREATE TRIGGER IF NOT EXISTS trg_users_clear_token_on_deactivate
  AFTER UPDATE OF is_active ON users FOR EACH ROW
  WHEN NEW.is_active = 0
BEGIN
  UPDATE users SET remember_token = NULL, remember_token_expires = NULL WHERE id = NEW.id;
END;
