-- Ensure direction column exists in monetary_service_types
ALTER TABLE monetary_service_types ADD COLUMN direction TEXT DEFAULT 'both';

-- Deactivate old generic types to cleanly organize the new list
UPDATE monetary_service_types SET is_active = 0;

-- Insert the precise services for Cash-in (استقبال نقدية بالخزينة وإرسال رصيد)
INSERT INTO monetary_service_types (name_ar, name_en, commission_rate, commission_type, is_active, direction) VALUES
  ('شحن محفظة إلكترونية (فودافون / أورانج / اتصالات / وي)', 'Wallet Cash-In', 1.0, 'percentage', 1, 'cash_in'),
  ('إرسال رصيد إنستا باي / تحويل بنكي', 'InstaPay Transfer Out', 5.0, 'fixed', 1, 'cash_in'),
  ('شحن كروت وفواتير كهرباء', 'Electricity Bill Recharge', 3.0, 'fixed', 1, 'cash_in'),
  ('شحن فواتير غاز ومياه', 'Gas & Water Bill Recharge', 3.0, 'fixed', 1, 'cash_in'),
  ('شحن رصيد وباقات موبايل', 'Mobile Balance & Bundles', 2.0, 'percentage', 1, 'cash_in'),
  ('شحن رصيد وباقات إنترنت منزلي', 'Home Internet Bundles', 5.0, 'fixed', 1, 'cash_in');

-- Insert the precise services for Cash-out (استقبال رصيد بالمحفظة وخروج نقدية من الخزينة)
INSERT INTO monetary_service_types (name_ar, name_en, commission_rate, commission_type, is_active, direction) VALUES
  ('استقبال على المحفظة (سحب كاش)', 'Wallet Cash-Out', 1.0, 'percentage', 1, 'cash_out'),
  ('استقبال إنستا باي / تحويل بنكي', 'InstaPay Cash-Out', 1.0, 'percentage', 1, 'cash_out'),
  ('شحن ماكينة الدفع الإلكتروني POS (فوري / أمان / بساطة)', 'POS Machine Recharge', 1.0, 'percentage', 1, 'cash_out');
