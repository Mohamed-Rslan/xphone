-- Add transfer fee and linked expense to financial transfers
ALTER TABLE financial_transfers ADD COLUMN fee REAL NOT NULL DEFAULT 0.0;
ALTER TABLE financial_transfers ADD COLUMN fee_expense_id TEXT REFERENCES expenses(id);

-- Ensure category exists for bank and transfer fees
INSERT OR IGNORE INTO expense_categories (id, name_ar, name_en) VALUES
  (8, 'عمولات ومصروفات تحويل بنكية', 'Bank & Transfer Fees');
