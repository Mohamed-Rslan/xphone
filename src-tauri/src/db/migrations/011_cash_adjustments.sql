-- ─────────────────────────────────────────
-- 011_cash_adjustments.sql
-- Financial Accounts Balance Adjustments by sadmin
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cash_adjustments (
  id                    TEXT PRIMARY KEY,
  financial_account_id  TEXT NOT NULL REFERENCES financial_accounts(id),
  old_balance           REAL NOT NULL,
  new_balance           REAL NOT NULL,
  adjustment_amount     REAL NOT NULL,
  reason                TEXT,
  created_by            TEXT REFERENCES users(id),
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);
