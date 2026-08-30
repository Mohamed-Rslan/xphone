-- Migration 013: Dual Account Limit Methods (Min/Max vs Debit Limit in Period)

ALTER TABLE financial_accounts ADD COLUMN limit_type TEXT DEFAULT 'min_max';
ALTER TABLE financial_accounts ADD COLUMN debit_limit_amount REAL DEFAULT NULL;
ALTER TABLE financial_accounts ADD COLUMN debit_limit_days INTEGER DEFAULT 30;
ALTER TABLE financial_accounts ADD COLUMN warning_threshold_pct REAL DEFAULT 75.0;
