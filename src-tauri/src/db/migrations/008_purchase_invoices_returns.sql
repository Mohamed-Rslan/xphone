-- Add invoice_no and financial_account_id to purchase_orders if needed
ALTER TABLE purchase_orders ADD COLUMN invoice_no TEXT;
ALTER TABLE purchase_orders ADD COLUMN financial_account_id TEXT REFERENCES financial_accounts(id);

CREATE TABLE IF NOT EXISTS purchase_returns (
  id                   TEXT PRIMARY KEY,
  supplier_id          TEXT NOT NULL REFERENCES suppliers(id),
  purchase_order_id    TEXT,
  total_amount         REAL NOT NULL,
  refund_type          TEXT NOT NULL CHECK(refund_type IN ('cash', 'credit_reduction')),
  financial_account_id TEXT REFERENCES financial_accounts(id),
  reason               TEXT,
  created_by           TEXT REFERENCES users(id),
  created_at           TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS purchase_return_items (
  id                 TEXT PRIMARY KEY,
  purchase_return_id TEXT NOT NULL REFERENCES purchase_returns(id) ON DELETE CASCADE,
  product_id         TEXT NOT NULL REFERENCES products(id),
  qty                REAL NOT NULL,
  unit_cost          REAL NOT NULL,
  total_cost         REAL NOT NULL
);
