-- =============================================
-- 08_financial_fixes.sql — إصلاحات مالية وأمنية حرجة
-- =============================================
-- يجب تنفيذه في Supabase SQL Editor

-- ===== 1. إضافة أعمدة ناقصة في جدول الطلبات =====
ALTER TABLE orders ADD COLUMN IF NOT EXISTS buyer_id UUID REFERENCES profiles(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS vat NUMERIC(12,2) DEFAULT 0;

-- جعل price اختياري (Flutter لا يرسله دائماً كـ price)
ALTER TABLE orders ALTER COLUMN price SET DEFAULT 0;

-- فهرس للمشتري
CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders(buyer_id);

-- ===== 2. CHECK constraints على الأسعار =====
-- منع الأسعار السالبة عبر API المباشر
ALTER TABLE products ADD CONSTRAINT chk_price_pos CHECK (price >= 0);
ALTER TABLE products ADD CONSTRAINT chk_start_price_pos CHECK (start_price IS NULL OR start_price > 0);
ALTER TABLE products ADD CONSTRAINT chk_min_bid_pos CHECK (min_bid IS NULL OR min_bid > 0);
ALTER TABLE products ADD CONSTRAINT chk_buy_now_pos CHECK (buy_now IS NULL OR buy_now > 0);
ALTER TABLE bids ADD CONSTRAINT chk_bid_amount_pos CHECK (amount > 0);
ALTER TABLE orders ADD CONSTRAINT chk_order_total_pos CHECK (total >= 0);

-- ===== 3. RLS: المشتري يشوف طلباته =====
CREATE POLICY "orders_select_buyer" ON orders
  FOR SELECT USING (auth.uid() = buyer_id);

-- ===== 4. RLS: تقييد إدراج المعاملات للأدمن فقط =====
-- منع أي مستخدم من حقن معاملات مالية مزيفة
DROP POLICY IF EXISTS "transactions_insert" ON transactions;
CREATE POLICY "transactions_insert_admin" ON transactions
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ===== 5. Trigger: التحقق من صحة المزايدات =====
-- يمنع: المزايدة على مزاد منتهي + مبلغ أقل من أعلى مزايدة
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

  -- تحقق من أن المبلغ أعلى من آخر مزايدة
  IF EXISTS (
    SELECT 1 FROM bids
    WHERE product_id = NEW.product_id AND amount >= NEW.amount
  ) THEN
    RAISE EXCEPTION 'المبلغ يجب أن يكون أعلى من أعلى مزايدة حالية';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_bid ON bids;
CREATE TRIGGER trg_validate_bid
  BEFORE INSERT ON bids
  FOR EACH ROW EXECUTE FUNCTION validate_bid();

SELECT '08_financial_fixes applied successfully!' AS status;
