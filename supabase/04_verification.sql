-- ===== نظام التوثيق بمستويين =====
-- شغّل هذا في SQL Editor

-- 1. إضافة أعمدة التوثيق الجديدة
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS merchant_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS seller_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS commercial_register TEXT DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS completed_auctions INTEGER DEFAULT 0;

-- merchant_verified = تاجر موثق (يدوي — الأدمن يوافق بعد رفع السجل التجاري)
-- seller_verified = بائع موثق (تلقائي — بعد إتمام بيع مزادين بنجاح)
-- commercial_register = رقم أو رابط السجل التجاري
-- completed_auctions = عدد المزادات المكتملة بنجاح

SELECT 'Verification columns added!' AS status;
