-- ===== 07: Fix NOT NULL columns causing INSERT failures =====
-- الأعمدة type, origin, category كانت NOT NULL بدون DEFAULT
-- هذا يسبب فشل INSERT عند عدم تعبئتها من الفورم

-- إضافة قيم افتراضية
ALTER TABLE products ALTER COLUMN type SET DEFAULT '';
ALTER TABLE products ALTER COLUMN origin SET DEFAULT '';
ALTER TABLE products ALTER COLUMN category SET DEFAULT '';

-- إزالة قيد NOT NULL — السماح بقيم فارغة
ALTER TABLE products ALTER COLUMN type DROP NOT NULL;
ALTER TABLE products ALTER COLUMN origin DROP NOT NULL;
ALTER TABLE products ALTER COLUMN category DROP NOT NULL;
