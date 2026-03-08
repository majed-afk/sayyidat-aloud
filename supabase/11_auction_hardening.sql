-- =============================================
-- 11_auction_hardening.sql — تصليب نظام المزاد
-- =============================================
-- يجب تنفيذه في Supabase SQL Editor بعد 10_improvements.sql
-- يعالج 10 مشاكل أمنية/وظيفية في نظام المزاد

-- ===== القسم 1: إنهاء المزادات المنتهية تلقائياً [Issue 1] =====
-- يُستدعى عبر sb.rpc('auto_end_expired_auctions') عند تحميل أي صفحة منتج
-- Supabase Free لا يدعم pg_cron، فالحل: cleanup عند كل زيارة

CREATE OR REPLACE FUNCTION auto_end_expired_auctions()
RETURNS INTEGER AS $$
DECLARE
  ended_count INTEGER := 0;
  rec RECORD;
BEGIN
  -- جلب المزادات المنتهية زمنياً لكن لا تزال live
  FOR rec IN
    SELECT p.id, p.seller_id
    FROM products p
    WHERE p.auction_status = 'live'
      AND p.auction_end_date IS NOT NULL
      AND p.auction_end_date <= NOW()
    FOR UPDATE SKIP LOCKED
  LOOP
    -- تعيين الفائز (أعلى مزايدة نشطة)
    UPDATE products
    SET auction_status = 'ended',
        winner_id = (
          SELECT bidder_id FROM bids
          WHERE product_id = rec.id AND status = 'active'
          ORDER BY amount DESC LIMIT 1
        )
    WHERE id = rec.id;

    ended_count := ended_count + 1;
  END LOOP;

  RETURN ended_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ===== القسم 2: إكمال شراء المزاد بأمان [Issue 2 + Issue 10] =====
-- يحل مشكلة RLS: المشتري لا يستطيع تحديث المنتج (products_update_own تتطلب seller_id)
-- يزيد completed_auctions + يوثق البائع تلقائياً

CREATE OR REPLACE FUNCTION complete_auction_purchase(p_product_id UUID, p_order_id TEXT)
RETURNS JSON AS $$
DECLARE
  v_product RECORD;
  v_caller UUID;
  v_completed INTEGER;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- قفل الصف لمنع race conditions
  SELECT id, auction_status, winner_id, seller_id
  INTO v_product
  FROM products
  WHERE id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'product_not_found');
  END IF;

  -- التحقق: المتصل هو الفائز
  IF v_product.winner_id IS NULL OR v_product.winner_id != v_caller THEN
    RETURN json_build_object('success', false, 'error', 'not_winner');
  END IF;

  -- التحقق: الحالة = ended (لم يُباع بعد)
  IF v_product.auction_status != 'ended' THEN
    RETURN json_build_object('success', false, 'error', 'invalid_status_' || v_product.auction_status);
  END IF;

  -- تحديث حالة المزاد إلى sold
  UPDATE products
  SET auction_status = 'sold'
  WHERE id = p_product_id;

  -- زيادة عداد المزادات المكتملة للبائع
  UPDATE profiles
  SET completed_auctions = COALESCE(completed_auctions, 0) + 1
  WHERE id = v_product.seller_id;

  -- التوثيق التلقائي: إذا أكمل البائع مزادين أو أكثر
  SELECT completed_auctions INTO v_completed
  FROM profiles WHERE id = v_product.seller_id;

  IF v_completed >= 2 THEN
    UPDATE profiles
    SET seller_verified = true
    WHERE id = v_product.seller_id AND seller_verified = false;
  END IF;

  RETURN json_build_object('success', true, 'auction_status', 'sold');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ===== القسم 3: تحسين trigger المزايدة [Issue 3 + Issue 1 fallback] =====
-- يضيف: فحص start_price، فحص min_bid، إنهاء تلقائي عند المزايدة على مزاد منتهي

CREATE OR REPLACE FUNCTION validate_bid()
RETURNS TRIGGER AS $$
DECLARE
  v_product RECORD;
  v_highest NUMERIC;
BEGIN
  -- جلب بيانات المنتج
  SELECT id, auction_status, auction_end_date, start_price, min_bid, listing_type
  INTO v_product
  FROM products
  WHERE id = NEW.product_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'المنتج غير موجود';
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

-- إعادة إنشاء الـ trigger
DROP TRIGGER IF EXISTS trg_validate_bid ON bids;
CREATE TRIGGER trg_validate_bid
  BEFORE INSERT ON bids
  FOR EACH ROW EXECUTE FUNCTION validate_bid();


-- ===== القسم 4: تشديد RLS INSERT [Issue 4] =====
-- منع إدراج مزايدة أو طلب بهوية مختلفة

-- المزايدات: bidder_id يجب = المستخدم الحالي
DROP POLICY IF EXISTS "bids_insert_auth" ON bids;
CREATE POLICY "bids_insert_own" ON bids
  FOR INSERT WITH CHECK (auth.uid() = bidder_id);

-- الطلبات: buyer_id يجب = المستخدم الحالي
DROP POLICY IF EXISTS "orders_insert_auth" ON orders;
CREATE POLICY "orders_insert_own" ON orders
  FOR INSERT WITH CHECK (auth.uid() = buyer_id);

-- المشتري يشوف طلباته
DROP POLICY IF EXISTS "orders_select_buyer" ON orders;
CREATE POLICY "orders_select_buyer" ON orders
  FOR SELECT USING (auth.uid() = buyer_id);


-- ===== القسم 5: عمود rating للمنتجات =====
ALTER TABLE products ADD COLUMN IF NOT EXISTS rating NUMERIC(3,1) DEFAULT 0;


SELECT '11_auction_hardening applied successfully!' AS status;
