-- Add technician_name and delivery_cost to repair_jobs table for accounting & reporting compliance
ALTER TABLE repair_jobs ADD COLUMN technician_name TEXT;
ALTER TABLE repair_jobs ADD COLUMN delivery_cost REAL NOT NULL DEFAULT 0;
