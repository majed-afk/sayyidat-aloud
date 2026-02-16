-- =============================================
-- 06_free_shipping.sql — إضافة عمود الشحن المجاني
-- =============================================
-- يجب تنفيذه في Supabase SQL Editor

ALTER TABLE products ADD COLUMN IF NOT EXISTS free_shipping BOOLEAN DEFAULT FALSE;
