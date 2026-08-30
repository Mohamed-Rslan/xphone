-- Recreate monetary_transactions without the restrictive CHECK constraint
PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS monetary_transactions_new (
  id                   TEXT PRIMARY KEY,
  service_type_id      INTEGER NOT NULL,
  tx_type              TEXT NOT NULL,
  customer_id          TEXT,
  customer_name        TEXT,
  amount               REAL NOT NULL,
  commission           REAL NOT NULL DEFAULT 0,
  net_profit           REAL NOT NULL DEFAULT 0,
  notes                TEXT,
  created_by           TEXT,
  created_at           TEXT NOT NULL DEFAULT (datetime('now')),
  financial_account_id TEXT DEFAULT 'cash_drawer'
);

INSERT INTO monetary_transactions_new (id, service_type_id, tx_type, customer_id, customer_name, amount, commission, net_profit, notes, created_by, created_at, financial_account_id)
SELECT id, service_type_id, 
  CASE 
    WHEN tx_type IN ('send', 'cash_to_credit', 'cash_in') THEN 'cash_in_transfer_out'
    WHEN tx_type IN ('receive', 'credit_to_cash', 'cash_out') THEN 'transfer_in_cash_out'
    ELSE tx_type 
  END,
  customer_id, customer_name, amount, commission, net_profit, notes, created_by, created_at,
  COALESCE(financial_account_id, 'cash_drawer')
FROM monetary_transactions;

DROP TABLE monetary_transactions;

ALTER TABLE monetary_transactions_new RENAME TO monetary_transactions;

PRAGMA foreign_keys = ON;
