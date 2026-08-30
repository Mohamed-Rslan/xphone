-- Migration 012: Allow short_term_withdrawal in equity_transactions tx_type
PRAGMA foreign_keys=OFF;

CREATE TABLE IF NOT EXISTS equity_transactions_new (
  id                    TEXT PRIMARY KEY,
  shareholder_id        TEXT NOT NULL REFERENCES shareholders(id) ON DELETE CASCADE,
  tx_type               TEXT NOT NULL CHECK(tx_type IN ('capital_increase','short_term_contribution','withdrawal','profit_distribution','short_term_withdrawal')),
  amount                REAL NOT NULL,
  financial_account_id  TEXT REFERENCES financial_accounts(id),
  counterpart_type      TEXT NOT NULL DEFAULT 'cash' CHECK(counterpart_type IN ('cash','inventory','liability_settlement','none')),
  description           TEXT,
  tx_date               TEXT NOT NULL DEFAULT (date('now')),
  created_by            TEXT REFERENCES users(id),
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO equity_transactions_new SELECT * FROM equity_transactions;
DROP TABLE equity_transactions;
ALTER TABLE equity_transactions_new RENAME TO equity_transactions;

PRAGMA foreign_keys=ON;
