CREATE TABLE IF NOT EXISTS financial_transfers (
  id              TEXT PRIMARY KEY,
  from_account_id TEXT NOT NULL REFERENCES financial_accounts(id),
  to_account_id   TEXT NOT NULL REFERENCES financial_accounts(id),
  amount          REAL NOT NULL,
  notes           TEXT,
  created_by      TEXT REFERENCES users(id),
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
