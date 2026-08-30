-- ─────────────────────────────────────────
-- 009_cash_audits.sql
-- Cash & Financial Liquidity Audits (جرد ومطابقة النقدية والسيولة)
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cash_audits (
  id                    TEXT PRIMARY KEY,
  title                 TEXT NOT NULL,
  audit_date            TEXT NOT NULL DEFAULT (datetime('now')),
  notes                 TEXT,
  total_system_balance  REAL NOT NULL DEFAULT 0,
  total_actual_balance  REAL NOT NULL DEFAULT 0,
  total_variance        REAL NOT NULL DEFAULT 0,
  created_by            TEXT REFERENCES users(id),
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cash_audit_items (
  id                    TEXT PRIMARY KEY,
  audit_id              TEXT NOT NULL REFERENCES cash_audits(id) ON DELETE CASCADE,
  financial_account_id  TEXT NOT NULL REFERENCES financial_accounts(id),
  account_name          TEXT NOT NULL,
  system_balance        REAL NOT NULL,
  actual_balance        REAL NOT NULL,
  variance              REAL NOT NULL,
  notes                 TEXT
);
