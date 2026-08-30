CREATE TABLE IF NOT EXISTS financial_accounts (
  id          TEXT PRIMARY KEY,
  name_ar     TEXT NOT NULL UNIQUE,
  name_en     TEXT,
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed default financial accounts if they don't exist
INSERT OR IGNORE INTO financial_accounts (id, name_ar, name_en, is_active) VALUES
  ('cash_drawer', 'الخزينة الرئيسية', 'Cash Drawer', 1),
  ('bank_cib', 'حساب البنك CIB', 'CIB Bank Account', 1),
  ('vodafone_cash', 'محفظة فودافون كاش', 'Vodafone Cash Wallet', 1),
  ('instapay', 'إنستا باي (InstaPay)', 'InstaPay', 1);

-- Add financial_account_id column to sales
ALTER TABLE sales ADD COLUMN financial_account_id TEXT REFERENCES financial_accounts(id);
UPDATE sales SET financial_account_id = 'cash_drawer' WHERE financial_account_id IS NULL;

-- Add financial_account_id column to expenses
ALTER TABLE expenses ADD COLUMN financial_account_id TEXT REFERENCES financial_accounts(id);
UPDATE expenses SET financial_account_id = 'cash_drawer' WHERE financial_account_id IS NULL;

-- Add financial_account_id column to repair_jobs
ALTER TABLE repair_jobs ADD COLUMN financial_account_id TEXT REFERENCES financial_accounts(id);
UPDATE repair_jobs SET financial_account_id = 'cash_drawer' WHERE financial_account_id IS NULL;

-- Add financial_account_id column to monetary_transactions
ALTER TABLE monetary_transactions ADD COLUMN financial_account_id TEXT REFERENCES financial_accounts(id);
UPDATE monetary_transactions SET financial_account_id = 'cash_drawer' WHERE financial_account_id IS NULL;

-- Add financial_account_id column to supplier_payments
ALTER TABLE supplier_payments ADD COLUMN financial_account_id TEXT REFERENCES financial_accounts(id);
UPDATE supplier_payments SET financial_account_id = 'cash_drawer' WHERE financial_account_id IS NULL;
