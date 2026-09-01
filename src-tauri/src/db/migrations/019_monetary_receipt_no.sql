-- Migration 019: Add receipt_no column to monetary_transactions table
ALTER TABLE monetary_transactions ADD COLUMN receipt_no TEXT;
