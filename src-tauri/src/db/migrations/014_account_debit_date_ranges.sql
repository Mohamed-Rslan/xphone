-- Migration 014: Custom Start and End dates for Account Debit Limits

ALTER TABLE financial_accounts ADD COLUMN debit_limit_start_date TEXT DEFAULT NULL;
ALTER TABLE financial_accounts ADD COLUMN debit_limit_end_date TEXT DEFAULT NULL;
