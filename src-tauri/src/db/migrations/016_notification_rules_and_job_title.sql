-- Migration 016: Notification rules configuration & User job title

-- Add job_title column to users table if not exists
ALTER TABLE users ADD COLUMN job_title TEXT DEFAULT NULL;

-- Create notification_rules table
CREATE TABLE IF NOT EXISTS notification_rules (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    rule_key TEXT UNIQUE NOT NULL,
    name_ar TEXT NOT NULL,
    description TEXT,
    is_enabled INTEGER NOT NULL DEFAULT 1,
    severity TEXT NOT NULL DEFAULT 'medium', -- 'low' | 'medium' | 'high'
    amount_threshold REAL DEFAULT NULL,
    threshold_type TEXT DEFAULT 'total', -- 'total' | 'single'
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed default notification rules
INSERT OR IGNORE INTO notification_rules (id, rule_key, name_ar, description, is_enabled, severity, amount_threshold, threshold_type) VALUES
('rule_withdrawal_limits', 'withdrawal_limits', 'حدود السحب بالمسحوبات المالية', 'تنبيه عند اقتراب أو تجاور المسحوبات النقدية من الحد الأقصى المسموح به بالحساب المالي', 1, 'high', NULL, 'total'),
('rule_operating_losses', 'operating_losses', 'وجود خسائر تشغيل بقائمة الدخل', 'تنبيه فور تسجيل صافي دخل سلبي أو خسائر تشغيل خلال الشهر الحالي', 1, 'high', NULL, 'total'),
('rule_low_stock', 'low_stock', 'مخزون أقل من الحدود الدنيا', 'تنبيه فور انخفاض كمية أي صنف بالمخزن عن حد إعادة الطلب الأدنى', 1, 'medium', NULL, 'total'),
('rule_due_liabilities_month', 'due_liabilities_month', 'وجود التزام مستحق خلال شهر', 'تنبيه عند وجود التزامات واستحقاقات مالية قادمة يجب سدادها خلال الـ 30 يوماً القادمة', 1, 'medium', 10000.0, 'total'),
('rule_due_liabilities_week', 'due_liabilities_week', 'وجود التزام مستحق خلال أسبوع', 'تنبيه مشدد عند وجود التزامات مالية واجبة السداد خلال الـ 7 أيام القادمة', 1, 'high', 5000.0, 'total');
