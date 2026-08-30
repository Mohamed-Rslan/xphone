-- Migration 015: Unified Liabilities and Accrued Obligations System

CREATE TABLE IF NOT EXISTS liabilities (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    amount REAL NOT NULL,
    paid_amount REAL NOT NULL DEFAULT 0.0,
    creditor_name TEXT NOT NULL,
    debit_counterpart_type TEXT NOT NULL, -- 'accrued_expense' | 'fixed_asset' | 'current_asset' | 'cash_advance'
    debit_account_id TEXT DEFAULT NULL,
    due_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'unpaid', -- 'unpaid' | 'partially_paid' | 'paid'
    notes TEXT,
    created_by TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS liability_payments (
    id TEXT PRIMARY KEY,
    liability_id TEXT NOT NULL REFERENCES liabilities(id) ON DELETE CASCADE,
    amount REAL NOT NULL,
    financial_account_id TEXT NOT NULL REFERENCES financial_accounts(id),
    notes TEXT,
    paid_by TEXT,
    created_at TEXT NOT NULL
);

-- Migrate historical data from accrued_expenses
INSERT OR IGNORE INTO liabilities (id, title, amount, paid_amount, creditor_name, debit_counterpart_type, debit_account_id, due_date, status, notes, created_by, created_at)
SELECT 
    ae.id,
    ae.title,
    ae.amount,
    CASE WHEN ae.status = 'paid' THEN ae.amount ELSE 0.0 END as paid_amount,
    'مستحق للمصروفات' as creditor_name,
    'accrued_expense' as debit_counterpart_type,
    ae.financial_account_id as debit_account_id,
    ae.due_date,
    CASE WHEN ae.status = 'paid' THEN 'paid' ELSE 'unpaid' END as status,
    ae.notes,
    ae.created_by,
    ae.created_at
FROM accrued_expenses ae;

-- Migrate historical data from customer_advances
INSERT OR IGNORE INTO liabilities (id, title, amount, paid_amount, creditor_name, debit_counterpart_type, debit_account_id, due_date, status, notes, created_by, created_at)
SELECT 
    ca.id,
    'دفعة مقدمة - عميل' as title,
    ca.amount,
    ca.used_amount as paid_amount,
    COALESCE(c.name, 'عميل محدد') as creditor_name,
    'cash_advance' as debit_counterpart_type,
    NULL as debit_account_id,
    date(ca.created_at) as due_date,
    CASE WHEN ca.status = 'completed' THEN 'paid' WHEN ca.used_amount > 0 THEN 'partially_paid' ELSE 'unpaid' END as status,
    ca.notes,
    ca.created_by,
    ca.created_at
FROM customer_advances ca
LEFT JOIN customers c ON c.id = ca.customer_id;
