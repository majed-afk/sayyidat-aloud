-- =============================================
-- 09_auction_features.sql — خصائص المزاد المتقدمة
-- =============================================
-- يجب تنفيذه في Supabase SQL Editor بعد 08_financial_fixes.sql

-- ===== 1. أعمدة جديدة في جدول المنتجات =====

-- التمديد التلقائي (عند مزايدة في آخر 5 دقائق)
ALTER TABLE products ADD COLUMN IF NOT EXISTS auto_extend BOOLEAN DEFAULT FALSE;

-- سبب الإلغاء ومن ألغى
ALTER TABLE products ADD COLUMN IF NOT EXISTS cancel_reason TEXT DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS cancelled_by TEXT DEFAULT '';

-- هوية الفائز بالمزاد
ALTER TABLE products ADD COLUMN IF NOT EXISTS winner_id UUID REFERENCES profiles(id);

-- ===== 2. تحديث CHECK constraint ليشمل 'cancelled' =====
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_auction_status_check;
ALTER TABLE products ADD CONSTRAINT products_auction_status_check
  CHECK (auction_status IN ('draft', 'live', 'ended', 'sold', 'cancelled'));

-- ===== 3. حالة المزايدة (active / retracted) =====
ALTER TABLE bids ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE bids DROP CONSTRAINT IF EXISTS bids_status_check;
ALTER TABLE bids ADD CONSTRAINT bids_status_check
  CHECK (status IN ('active', 'retracted'));

-- فهرس لتسريع استعلامات المزايدات النشطة
CREATE INDEX IF NOT EXISTS idx_bids_active ON bids(product_id, status) WHERE status = 'active';

-- ===== 4. RLS: المزايد يحدّث مزايدته (لسحب المزايدة) =====
DROP POLICY IF EXISTS "bids_update_own" ON bids;
CREATE POLICY "bids_update_own" ON bids
  FOR UPDATE USING (auth.uid() = bidder_id);

-- ===== 5. تحديث trigger التحقق من المزايدات =====
-- يستبعد المزايدات المسحوبة عند حساب أعلى مزايدة
CREATE OR REPLACE FUNCTION validate_bid()
RETURNS TRIGGER AS $$
BEGIN
  -- تحقق من أن المزاد نشط ولم ينتهِ
  IF NOT EXISTS (
    SELECT 1 FROM products
    WHERE id = NEW.product_id
      AND auction_status = 'live'
      AND (auction_end_date IS NULL OR auction_end_date > NOW())
  ) THEN
    RAISE EXCEPTION 'المزاد منتهي أو غير نشط';
  END IF;

  -- تحقق من أن المبلغ أعلى من آخر مزايدة نشطة (يستبعد المسحوبة)
  IF EXISTS (
    SELECT 1 FROM bids
    WHERE product_id = NEW.product_id
      AND status = 'active'
      AND amount >= NEW.amount
  ) THEN
    RAISE EXCEPTION 'المبلغ يجب أن يكون أعلى من أعلى مزايدة حالية';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- إعادة إنشاء الـ trigger
DROP TRIGGER IF EXISTS trg_validate_bid ON bids;
CREATE TRIGGER trg_validate_bid
  BEFORE INSERT ON bids
  FOR EACH ROW EXECUTE FUNCTION validate_bid();

SELECT '09_auction_features applied successfully!' AS status;
