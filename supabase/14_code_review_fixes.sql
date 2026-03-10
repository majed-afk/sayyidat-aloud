-- ============================================================
-- 14_code_review_fixes.sql — إصلاحات مراجعة الكود — صيدات العود
-- ============================================================
-- يعالج: P0 تعارض أنواع، P1 مسار Buy Now، P1 السحب، P2 منع المزايدة الذاتية

-- ===== القسم 1: إصلاح نوع order_id في reviews (P0) =====
-- المشكلة: order_id معرّف كـ UUID لكن orders.id هو TEXT
-- الحل: حذف وإعادة إنشاء بالنوع الصحيح (المنصة قبل الإطلاق)

DROP TABLE IF EXISTS reviews CASCADE;
CREATE TABLE reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT DEFAULT '',
  is_visible BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(order_id, reviewer_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id, is_visible);
CREATE INDEX IF NOT EXISTS idx_reviews_seller ON reviews(seller_id);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reviews_select_visible" ON reviews;
CREATE POLICY "reviews_select_visible" ON reviews
  FOR SELECT USING (
    is_visible = true
    OR reviewer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "reviews_insert_own" ON reviews;
CREATE POLICY "reviews_insert_own" ON reviews
  FOR INSERT WITH CHECK (auth.uid() = reviewer_id);

DROP POLICY IF EXISTS "reviews_update_admin" ON reviews;
CREATE POLICY "reviews_update_admin" ON reviews
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Trigger: تحديث rating في products تلقائياً
CREATE OR REPLACE FUNCTION update_product_rating()
RETURNS TRIGGER AS $$
DECLARE target_product_id UUID;
BEGIN
  target_product_id := COALESCE(NEW.product_id, OLD.product_id);
  UPDATE products SET rating = (
    SELECT COALESCE(ROUND(AVG(rating)::NUMERIC, 1), 0)
    FROM reviews
    WHERE product_id = target_product_id AND is_visible = true
  ) WHERE id = target_product_id;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_rating ON reviews;
CREATE TRIGGER trg_update_rating
  AFTER INSERT OR UPDATE OR DELETE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_product_rating();


-- ===== القسم 2: إصلاح نوع order_id في disputes (P0) =====

DROP TABLE IF EXISTS disputes CASCADE;
CREATE TABLE disputes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  buyer_id UUID NOT NULL REFERENCES profiles(id),
  seller_id UUID NOT NULL REFERENCES profiles(id),
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'rejected')),
  resolution TEXT DEFAULT '',
  admin_notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status, created_at DESC);

ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "disputes_select_involved" ON disputes;
CREATE POLICY "disputes_select_involved" ON disputes
  FOR SELECT USING (
    auth.uid() = buyer_id
    OR auth.uid() = seller_id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "disputes_insert_buyer" ON disputes;
CREATE POLICY "disputes_insert_buyer" ON disputes
  FOR INSERT WITH CHECK (auth.uid() = buyer_id);

DROP POLICY IF EXISTS "disputes_update_admin" ON disputes;
CREATE POLICY "disputes_update_admin" ON disputes
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );


-- ===== القسم 3: RPC buy_now_auction (P1) =====
-- يسمح للمشتري بالشراء الفوري: يعيّن winner_id ويغير الحالة إلى ended
-- بعدها complete_auction_purchase يكمل الباقي

CREATE OR REPLACE FUNCTION buy_now_auction(p_product_id UUID)
RETURNS JSON AS $$
DECLARE
  v_product RECORD;
  v_caller UUID;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- قفل الصف لمنع race conditions
  SELECT id, seller_id, auction_status, buy_now, listing_type, auction_end_date
  INTO v_product
  FROM products
  WHERE id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'product_not_found');
  END IF;

  -- تحقق: مزاد
  IF v_product.listing_type != 'auction' THEN
    RETURN json_build_object('success', false, 'error', 'not_auction');
  END IF;

  -- تحقق: مزاد نشط
  IF v_product.auction_status != 'live' THEN
    RETURN json_build_object('success', false, 'error', 'auction_not_live');
  END IF;

  -- تحقق: سعر شراء فوري موجود
  IF v_product.buy_now IS NULL OR v_product.buy_now <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'no_buy_now_price');
  END IF;

  -- تحقق: ليس البائع نفسه
  IF v_caller = v_product.seller_id THEN
    RETURN json_build_object('success', false, 'error', 'cannot_buy_own');
  END IF;

  -- تعيين الفائز وإنهاء المزاد
  UPDATE products
  SET winner_id = v_caller,
      auction_status = 'ended'
  WHERE id = p_product_id;

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ===== القسم 4: RPC record_withdrawal (P1) =====
-- السحب عبر RPC آمن بدل INSERT المباشر المحظور بـ RLS

CREATE OR REPLACE FUNCTION record_withdrawal(
  p_amount NUMERIC,
  p_bank_name TEXT DEFAULT ''
)
RETURNS JSON AS $$
DECLARE
  v_caller UUID;
  v_balance NUMERIC;
  v_iban TEXT;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- جلب الرصيد والآيبان
  SELECT balance, iban INTO v_balance, v_iban
  FROM profiles
  WHERE id = v_caller;

  -- تحقق: مبلغ موجب
  IF p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'invalid_amount');
  END IF;

  -- تحقق: رصيد كافٍ
  IF v_balance < p_amount THEN
    RETURN json_build_object('success', false, 'error', 'insufficient_balance');
  END IF;

  -- تحقق: آيبان مسجل
  IF v_iban IS NULL OR v_iban = '' THEN
    RETURN json_build_object('success', false, 'error', 'no_iban');
  END IF;

  -- إدراج معاملة السحب (pending = تحتاج موافقة الأدمن)
  INSERT INTO transactions (seller_id, type, amount, ref, status, description)
  VALUES (
    v_caller,
    'withdrawal',
    -p_amount,
    'W-' || LPAD(FLOOR(RANDOM() * 999 + 1)::TEXT, 3, '0'),
    'pending',
    'سحب إلى ' || p_bank_name
  );

  -- خصم من الرصيد
  UPDATE profiles
  SET balance = balance - p_amount
  WHERE id = v_caller;

  RETURN json_build_object('success', true, 'new_balance', v_balance - p_amount);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ===== القسم 5: تحديث validate_bid — منع المزايدة الذاتية (P2) =====
-- إضافة seller_id إلى SELECT + فحص NEW.bidder_id != seller_id

CREATE OR REPLACE FUNCTION validate_bid()
RETURNS TRIGGER AS $$
DECLARE
  v_product RECORD;
  v_highest NUMERIC;
BEGIN
  -- جلب بيانات المنتج (مع seller_id)
  SELECT id, seller_id, auction_status, auction_end_date, start_price, min_bid, listing_type
  INTO v_product
  FROM products
  WHERE id = NEW.product_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'المنتج غير موجود';
  END IF;

  -- ★ منع المزايدة الذاتية (P2)
  IF NEW.bidder_id = v_product.seller_id THEN
    RAISE EXCEPTION 'لا يمكنك المزايدة على منتجك';
  END IF;

  -- Fallback: إذا المزاد منتهي زمنياً لكن لسا live → أنهِه تلقائياً
  IF v_product.auction_status = 'live'
     AND v_product.auction_end_date IS NOT NULL
     AND v_product.auction_end_date <= NOW()
  THEN
    UPDATE products
    SET auction_status = 'ended',
        winner_id = (
          SELECT bidder_id FROM bids
          WHERE product_id = NEW.product_id AND status = 'active'
          ORDER BY amount DESC LIMIT 1
        )
    WHERE id = NEW.product_id;

    RAISE EXCEPTION 'المزاد انتهى';
  END IF;

  -- تحقق: المزاد نشط
  IF v_product.auction_status != 'live' THEN
    RAISE EXCEPTION 'المزاد غير نشط';
  END IF;

  -- تحقق: المزاد لم ينتهِ زمنياً
  IF v_product.auction_end_date IS NOT NULL AND v_product.auction_end_date <= NOW() THEN
    RAISE EXCEPTION 'المزاد منتهي';
  END IF;

  -- جلب أعلى مزايدة نشطة
  SELECT COALESCE(MAX(amount), 0) INTO v_highest
  FROM bids
  WHERE product_id = NEW.product_id AND status = 'active';

  -- أول مزايدة: يجب >= start_price
  IF v_highest = 0 THEN
    IF v_product.start_price IS NOT NULL AND NEW.amount < v_product.start_price THEN
      RAISE EXCEPTION 'المزايدة يجب أن تكون على الأقل % ريال', v_product.start_price;
    END IF;
  ELSE
    -- مزايدة لاحقة: يجب > أعلى مزايدة
    IF NEW.amount <= v_highest THEN
      RAISE EXCEPTION 'المبلغ يجب أن يكون أعلى من أعلى مزايدة حالية';
    END IF;

    -- فحص الحد الأدنى للزيادة (min_bid)
    IF v_product.min_bid IS NOT NULL AND v_product.min_bid > 0 THEN
      IF (NEW.amount - v_highest) < v_product.min_bid THEN
        RAISE EXCEPTION 'الزيادة يجب أن تكون على الأقل % ريال', v_product.min_bid;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ===== القسم 6: رسالة نجاح =====
DO $$ BEGIN RAISE NOTICE '14_code_review_fixes applied successfully!'; END $$;
SELECT '14_code_review_fixes applied successfully!' AS status;
