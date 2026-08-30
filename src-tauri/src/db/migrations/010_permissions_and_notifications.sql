-- Migration 010: Permissions, WhatsApp OTP, and System Notifications

-- 1. Add phone and permissions to users
ALTER TABLE users ADD COLUMN phone TEXT;
ALTER TABLE users ADD COLUMN permissions TEXT DEFAULT '[]';

-- 2. System Notifications for sensitive operations
CREATE TABLE IF NOT EXISTS system_notifications (
  id            TEXT PRIMARY KEY,
  user_id       TEXT,
  user_name     TEXT NOT NULL,
  action_type   TEXT NOT NULL,
  title         TEXT NOT NULL,
  details       TEXT,
  is_read       INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 3. OTP verification codes for Super Admin password reset
CREATE TABLE IF NOT EXISTS otp_codes (
  id            TEXT PRIMARY KEY,
  username      TEXT NOT NULL,
  phone         TEXT NOT NULL,
  code          TEXT NOT NULL,
  expires_at    TEXT NOT NULL,
  is_used       INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
