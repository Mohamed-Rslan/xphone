PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- ─────────────────────────────────────────
-- AUTH
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  username      TEXT NOT NULL UNIQUE,
  display_name  TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK(role IN ('admin','staff')),
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id     TEXT NOT NULL REFERENCES users(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at  TEXT NOT NULL
);

-- ─────────────────────────────────────────
-- CATALOG
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS brands (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  name      TEXT NOT NULL UNIQUE,
  logo_path TEXT,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS categories (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  name_ar   TEXT NOT NULL,
  name_en   TEXT NOT NULL,
  parent_id INTEGER REFERENCES categories(id),
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
  id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  sku              TEXT UNIQUE,
  name_ar          TEXT NOT NULL,
  name_en          TEXT,
  brand_id         INTEGER REFERENCES brands(id),
  category_id      INTEGER NOT NULL REFERENCES categories(id),
  variant_color    TEXT,
  variant_storage  TEXT,
  variant_ram      TEXT,
  cost_price       REAL NOT NULL DEFAULT 0,
  sell_price       REAL NOT NULL DEFAULT 0,
  stock_qty        INTEGER NOT NULL DEFAULT 0,
  reorder_level    INTEGER NOT NULL DEFAULT 5,
  supplier_id      TEXT REFERENCES suppliers(id),
  is_active        INTEGER NOT NULL DEFAULT 1,
  notes            TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  product_id  TEXT NOT NULL REFERENCES products(id),
  type        TEXT NOT NULL CHECK(type IN ('sale','purchase','return','adjustment','repair_use')),
  qty_change  INTEGER NOT NULL,
  qty_before  INTEGER NOT NULL,
  qty_after   INTEGER NOT NULL,
  ref_id      TEXT,
  reason      TEXT,
  user_id     TEXT REFERENCES users(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─────────────────────────────────────────
-- CUSTOMERS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name       TEXT NOT NULL,
  phone      TEXT,
  phone2     TEXT,
  address    TEXT,
  notes      TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─────────────────────────────────────────
-- SUPPLIERS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suppliers (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name       TEXT NOT NULL,
  phone      TEXT,
  address    TEXT,
  notes      TEXT,
  balance    REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  supplier_id     TEXT NOT NULL REFERENCES suppliers(id),
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK(status IN ('draft','ordered','partial','received','cancelled')),
  total_cost      REAL NOT NULL DEFAULT 0,
  amount_paid     REAL NOT NULL DEFAULT 0,
  notes           TEXT,
  ordered_at      TEXT,
  received_at     TEXT,
  created_by      TEXT REFERENCES users(id),
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  purchase_order_id TEXT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id        TEXT NOT NULL REFERENCES products(id),
  qty_ordered       INTEGER NOT NULL,
  qty_received      INTEGER NOT NULL DEFAULT 0,
  unit_cost         REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS supplier_payments (
  id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  supplier_id       TEXT NOT NULL REFERENCES suppliers(id),
  purchase_order_id TEXT REFERENCES purchase_orders(id),
  amount            REAL NOT NULL,
  method            TEXT NOT NULL CHECK(method IN ('cash','card','transfer')),
  notes             TEXT,
  paid_at           TEXT NOT NULL DEFAULT (datetime('now')),
  created_by        TEXT REFERENCES users(id)
);

-- ─────────────────────────────────────────
-- SALES & POS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  invoice_no    TEXT NOT NULL UNIQUE,
  customer_id   TEXT REFERENCES customers(id),
  status        TEXT NOT NULL DEFAULT 'completed'
                CHECK(status IN ('completed','returned','partial_return')),
  subtotal      REAL NOT NULL,
  discount      REAL NOT NULL DEFAULT 0,
  total         REAL NOT NULL,
  cash_amount   REAL NOT NULL DEFAULT 0,
  card_amount   REAL NOT NULL DEFAULT 0,
  change_amount REAL NOT NULL DEFAULT 0,
  notes         TEXT,
  created_by    TEXT REFERENCES users(id),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sale_items (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  sale_id     TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id  TEXT NOT NULL REFERENCES products(id),
  qty         INTEGER NOT NULL,
  unit_price  REAL NOT NULL,
  unit_cost   REAL NOT NULL,
  discount    REAL NOT NULL DEFAULT 0,
  line_total  REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS returns (
  id             TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  sale_id        TEXT NOT NULL REFERENCES sales(id),
  reason         TEXT NOT NULL,
  refund_method  TEXT NOT NULL CHECK(refund_method IN ('cash','card','credit')),
  total_refund   REAL NOT NULL,
  created_by     TEXT REFERENCES users(id),
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS return_items (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  return_id     TEXT NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
  sale_item_id  TEXT NOT NULL REFERENCES sale_items(id),
  qty           INTEGER NOT NULL,
  refund_amount REAL NOT NULL
);

-- ─────────────────────────────────────────
-- REPAIRS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS repair_jobs (
  id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  job_no            TEXT NOT NULL UNIQUE,
  customer_id       TEXT NOT NULL REFERENCES customers(id),
  device_brand_id   INTEGER REFERENCES brands(id),
  device_model      TEXT NOT NULL,
  device_color      TEXT,
  device_condition  TEXT,
  fault_desc        TEXT NOT NULL,
  technician_notes  TEXT,
  status            TEXT NOT NULL DEFAULT 'received'
                    CHECK(status IN ('received','in_progress','ready','delivered','cancelled')),
  labor_cost        REAL NOT NULL DEFAULT 0,
  parts_cost        REAL NOT NULL DEFAULT 0,
  total_cost        REAL NOT NULL DEFAULT 0,
  amount_paid       REAL NOT NULL DEFAULT 0,
  received_at       TEXT NOT NULL DEFAULT (datetime('now')),
  delivered_at      TEXT,
  created_by        TEXT REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS repair_parts (
  id             TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  repair_job_id  TEXT NOT NULL REFERENCES repair_jobs(id) ON DELETE CASCADE,
  product_id     TEXT NOT NULL REFERENCES products(id),
  qty            INTEGER NOT NULL,
  unit_cost      REAL NOT NULL
);

-- ─────────────────────────────────────────
-- MONETARY SERVICES
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS monetary_service_types (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name_ar         TEXT NOT NULL,
  name_en         TEXT NOT NULL,
  commission_rate REAL NOT NULL DEFAULT 0,
  commission_type TEXT NOT NULL DEFAULT 'percentage'
                  CHECK(commission_type IN ('percentage','fixed')),
  is_active       INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS monetary_transactions (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  service_type_id INTEGER NOT NULL REFERENCES monetary_service_types(id),
  tx_type         TEXT NOT NULL CHECK(tx_type IN ('send','receive','cash_in','cash_out','credit_to_cash','cash_to_credit')),
  customer_id     TEXT REFERENCES customers(id),
  customer_name   TEXT,
  amount          REAL NOT NULL,
  commission      REAL NOT NULL DEFAULT 0,
  net_profit      REAL NOT NULL DEFAULT 0,
  notes           TEXT,
  created_by      TEXT REFERENCES users(id),
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─────────────────────────────────────────
-- ACCOUNTING
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expense_categories (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  name_ar   TEXT NOT NULL,
  name_en   TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS expenses (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  category_id     INTEGER NOT NULL REFERENCES expense_categories(id),
  amount          REAL NOT NULL,
  description     TEXT,
  is_recurring    INTEGER NOT NULL DEFAULT 0,
  recurrence      TEXT CHECK(recurrence IN ('monthly','weekly','yearly')),
  expense_date    TEXT NOT NULL DEFAULT (date('now')),
  attachment_path TEXT,
  created_by      TEXT REFERENCES users(id),
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─────────────────────────────────────────
-- SETTINGS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─────────────────────────────────────────
-- REPORTING VIEWS
-- ─────────────────────────────────────────
CREATE VIEW IF NOT EXISTS v_daily_revenue AS
SELECT
  date(s.created_at)            AS day,
  SUM(s.total)                  AS sales_revenue,
  SUM(si.qty * si.unit_cost)    AS cogs,
  SUM(s.total) - SUM(si.qty * si.unit_cost) AS gross_profit
FROM sales s
JOIN sale_items si ON si.sale_id = s.id
WHERE s.status != 'returned'
GROUP BY date(s.created_at);

CREATE VIEW IF NOT EXISTS v_product_margin AS
SELECT
  p.id,
  p.name_ar,
  p.sku,
  p.sell_price - p.cost_price AS margin_egp,
  ROUND((p.sell_price - p.cost_price) / NULLIF(p.sell_price, 0) * 100, 2) AS margin_pct
FROM products p;
