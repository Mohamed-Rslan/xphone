-- ─────────────────────────────────────────
-- 005_accounting_standards.sql
-- Enhanced Accounting System & Ledgers
-- ─────────────────────────────────────────

-- 1. Fixed Assets & Depreciation
CREATE TABLE IF NOT EXISTS fixed_assets (
  id                      TEXT PRIMARY KEY,
  name                    TEXT NOT NULL,
  purchase_date           TEXT NOT NULL,
  purchase_cost           REAL NOT NULL,
  salvage_value           REAL NOT NULL DEFAULT 0,
  depreciation_rate       REAL NOT NULL,
  depreciation_method     TEXT NOT NULL DEFAULT 'straight_line',
  accumulated_depreciation REAL NOT NULL DEFAULT 0,
  financial_account_id    TEXT REFERENCES financial_accounts(id),
  notes                   TEXT,
  created_at              TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS fixed_asset_depreciations (
  id              TEXT PRIMARY KEY,
  asset_id        TEXT NOT NULL REFERENCES fixed_assets(id) ON DELETE CASCADE,
  amount          REAL NOT NULL,
  period_date     TEXT NOT NULL,
  notes           TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. Damaged / Perished Goods (هالك وتالف المخزون)
CREATE TABLE IF NOT EXISTS damaged_goods (
  id              TEXT PRIMARY KEY,
  product_id      TEXT NOT NULL REFERENCES products(id),
  qty             REAL NOT NULL,
  unit_cost       REAL NOT NULL,
  total_cost      REAL NOT NULL,
  reason          TEXT,
  created_by      TEXT REFERENCES users(id),
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 3. Inventory Batches for FIFO / LIFO Valuation
CREATE TABLE IF NOT EXISTS inventory_batches (
  id                TEXT PRIMARY KEY,
  product_id        TEXT NOT NULL REFERENCES products(id),
  purchase_order_id TEXT,
  qty_in            REAL NOT NULL,
  qty_remaining     REAL NOT NULL,
  unit_cost         REAL NOT NULL,
  received_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 4. Customer Debts, Payments & Advances
ALTER TABLE customers ADD COLUMN balance REAL NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS customer_payments (
  id                    TEXT PRIMARY KEY,
  customer_id           TEXT NOT NULL REFERENCES customers(id),
  amount                REAL NOT NULL,
  financial_account_id  TEXT NOT NULL REFERENCES financial_accounts(id),
  notes                 TEXT,
  created_by            TEXT REFERENCES users(id),
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS customer_advances (
  id                    TEXT PRIMARY KEY,
  customer_id           TEXT NOT NULL REFERENCES customers(id),
  amount                REAL NOT NULL,
  financial_account_id  TEXT NOT NULL REFERENCES financial_accounts(id),
  status                TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','used','refunded')),
  used_amount           REAL NOT NULL DEFAULT 0,
  notes                 TEXT,
  created_by            TEXT REFERENCES users(id),
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 5. Accrued Expenses (مصروفات مستحقة واجبة السداد)
CREATE TABLE IF NOT EXISTS accrued_expenses (
  id                    TEXT PRIMARY KEY,
  category_id           INTEGER REFERENCES expense_categories(id),
  title                 TEXT NOT NULL,
  amount                REAL NOT NULL,
  due_date              TEXT,
  status                TEXT NOT NULL DEFAULT 'unpaid' CHECK(status IN ('unpaid','paid')),
  paid_at               TEXT,
  financial_account_id  TEXT REFERENCES financial_accounts(id),
  notes                 TEXT,
  created_by            TEXT REFERENCES users(id),
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 6. Shareholders & Equity (حقوق الملكية والشركاء)
CREATE TABLE IF NOT EXISTS shareholders (
  id                    TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  phone                 TEXT,
  initial_capital       REAL NOT NULL DEFAULT 0,
  ownership_percentage  REAL NOT NULL DEFAULT 0,
  notes                 TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS equity_transactions (
  id                    TEXT PRIMARY KEY,
  shareholder_id        TEXT NOT NULL REFERENCES shareholders(id) ON DELETE CASCADE,
  tx_type               TEXT NOT NULL CHECK(tx_type IN ('capital_increase','short_term_contribution','withdrawal','profit_distribution')),
  amount                REAL NOT NULL,
  financial_account_id  TEXT REFERENCES financial_accounts(id),
  counterpart_type      TEXT NOT NULL DEFAULT 'cash' CHECK(counterpart_type IN ('cash','inventory','liability_settlement','none')),
  description           TEXT,
  tx_date               TEXT NOT NULL DEFAULT (date('now')),
  created_by            TEXT REFERENCES users(id),
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 7. Account Balance Limits & Alarms
ALTER TABLE financial_accounts ADD COLUMN min_balance_limit REAL DEFAULT NULL;
ALTER TABLE financial_accounts ADD COLUMN max_balance_limit REAL DEFAULT NULL;

-- 8. Physical Inventory Audit / Comparison Sessions (جرد المخزون المقارن)
CREATE TABLE IF NOT EXISTS inventory_audits (
  id                    TEXT PRIMARY KEY,
  title                 TEXT NOT NULL,
  audit_date            TEXT NOT NULL DEFAULT (datetime('now')),
  notes                 TEXT,
  total_system_qty      REAL NOT NULL DEFAULT 0,
  total_actual_qty      REAL NOT NULL DEFAULT 0,
  total_variance_qty    REAL NOT NULL DEFAULT 0,
  total_variance_cost   REAL NOT NULL DEFAULT 0,
  created_by            TEXT REFERENCES users(id),
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS inventory_audit_items (
  id                    TEXT PRIMARY KEY,
  audit_id              TEXT NOT NULL REFERENCES inventory_audits(id) ON DELETE CASCADE,
  product_id            TEXT NOT NULL REFERENCES products(id),
  system_qty            REAL NOT NULL,
  actual_qty            REAL NOT NULL,
  variance_qty          REAL NOT NULL,
  unit_cost             REAL NOT NULL,
  variance_cost         REAL NOT NULL,
  notes                 TEXT
);

-- 9. Purchase Returns
CREATE TABLE IF NOT EXISTS purchase_returns (
  id                    TEXT PRIMARY KEY,
  purchase_order_id     TEXT REFERENCES purchase_orders(id),
  supplier_id           TEXT NOT NULL REFERENCES suppliers(id),
  product_id            TEXT NOT NULL REFERENCES products(id),
  qty                   REAL NOT NULL,
  unit_cost             REAL NOT NULL,
  total_refund          REAL NOT NULL,
  refund_type           TEXT NOT NULL DEFAULT 'balance' CHECK(refund_type IN ('cash','balance')),
  financial_account_id  TEXT REFERENCES financial_accounts(id),
  reason                TEXT,
  created_by            TEXT REFERENCES users(id),
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);
