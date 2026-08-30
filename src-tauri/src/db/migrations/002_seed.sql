-- BRANDS (Egyptian market focus)
INSERT OR IGNORE INTO brands (name) VALUES
  ('Samsung'),('Apple'),('Xiaomi'),('Realme'),('OPPO'),('Vivo'),
  ('Huawei'),('Honor'),('Tecno'),('Infinix'),('itel'),('Nokia'),
  ('Motorola'),('OnePlus'),('ZTE'),('Lenovo'),('Nothing'),('HMD');

-- CATEGORIES
INSERT OR IGNORE INTO categories (name_ar, name_en, sort_order) VALUES
  ('هواتف جديدة',    'New Phones',      1),
  ('هواتف مستعملة',  'Used Phones',     2),
  ('إكسسوارات',       'Accessories',     3),
  ('شرائح SIM',       'SIM Cards',       4),
  ('قطع غيار',        'Spare Parts',     5),
  ('خدمات صيانة',    'Repair Services', 6);

-- EXPENSE CATEGORIES
INSERT OR IGNORE INTO expense_categories (name_ar, name_en) VALUES
  ('إيجار',           'Rent'),
  ('رواتب',            'Salaries'),
  ('كهرباء',           'Electricity'),
  ('إنترنت',           'Internet'),
  ('مصاريف شراء',    'Procurement'),
  ('تسويق وإعلان',  'Marketing'),
  ('مصاريف أخرى',   'Other');

-- MONETARY SERVICE TYPES
INSERT OR IGNORE INTO monetary_service_types (name_ar, name_en, commission_rate, commission_type) VALUES
  ('فودافون كاش - إرسال',      'Vodafone Cash - Send',      1.5, 'percentage'),
  ('فودافون كاش - استقبال',    'Vodafone Cash - Receive',   1.0, 'percentage'),
  ('فودافون كاش - كاش إن',     'Vodafone Cash - Cash In',   0.5, 'percentage'),
  ('فودافون كاش - كاش أوت',    'Vodafone Cash - Cash Out',  2.0, 'percentage'),
  ('رصيد رقمي ← نقدي',         'Digital Credit to Cash',    5.0, 'percentage'),
  ('نقدي ← رصيد رقمي',         'Cash to Digital Credit',    5.0, 'percentage'),
  ('أورانج موني',               'Orange Money',              1.5, 'percentage'),
  ('اتصالات كاش',               'Etisalat Cash',             1.5, 'percentage'),
  ('WE Pay',                    'WE Pay',                    1.5, 'percentage');

-- DEFAULT SETTINGS
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('store_name',        'XPhone'),
  ('store_address',     ''),
  ('store_phone',       ''),
  ('currency',          'EGP'),
  ('tax_inclusive',     'true'),
  ('fiscal_year_start', '01-01'),
  ('low_stock_default', '5'),
  ('invoice_prefix',    'INV'),
  ('repair_prefix',     'REP'),
  ('next_invoice_no',   '1'),
  ('next_repair_no',    '1');

-- DEFAULT ADMIN USER  (password: admin123 — change after first login)
INSERT OR IGNORE INTO users (id, username, display_name, password_hash, role)
VALUES (
  'admin-default-id',
  'admin',
  'المدير',
  '$2b$12$Y7e1MvW4pHos.wSkttGcsObusUh0AJFBeDK7EiKgoT5IuI6PNeuWC',
  'admin'
);
