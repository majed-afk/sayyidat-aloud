-- =============================================
-- 05_approval.sql — نظام اعتماد المنتجات
-- =============================================
-- يجب تنفيذه في Supabase SQL Editor
-- التاجر الموثق أو البائع الموثق → اعتماد تلقائي
-- غير الموثق → بانتظار موافقة الأدمن

-- إضافة عمود حالة الموافقة
ALTER TABLE products ADD COLUMN IF NOT EXISTS approval_status TEXT
  DEFAULT 'pending'
  CHECK (approval_status IN ('pending', 'approved', 'rejected'));

-- إضافة عمود سبب الرفض (اختياري)
ALTER TABLE products ADD COLUMN IF NOT EXISTS rejection_reason TEXT DEFAULT '';

-- المنتجات الموجودة المفعّلة → معتمدة تلقائياً
UPDATE products SET approval_status = 'approved' WHERE active = TRUE;

-- المنتجات غير المفعّلة → بانتظار الموافقة
UPDATE products SET approval_status = 'pending' WHERE active = FALSE AND approval_status IS NULL;

-- فهرس لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_products_approval ON products(approval_status);
