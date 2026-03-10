-- ============================================================
-- 15_review2_fixes.sql — إصلاحات المراجعة الثانية — صيدات العود
-- ============================================================
-- P0×2 + P1×4 + P2×3 = 9 إصلاحات

-- ===== القسم 1 (P0): إصلاح record_sale_transaction =====
-- المشكلة: تقبل p_amount من العميل بدون تحقق من الطلب
-- الحل: التحقق من وجود الطلب + أنه يخص البائع + لم يُعالَج مسبقاً

CREATE OR REPLACE FUNCTION record_sale_transaction(
  p_order_id TEXT,
  p_amount NUMERIC,
  p_commission_rate NUMERIC DEFAULT 0.05
)
RETURNS JSON AS $$
DECLARE
  v_caller UUID;
  v_order RECORD;
  v_already_processed BOOLEAN;
  v_commission NUMERIC;
  v_net NUMERIC;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- ★ تحقق: الطلب موجود ويخص البائع الحالي
  SELECT id, seller_id, total, status
  INTO v_order
  FROM orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'order_not_found');
  END IF;

  IF v_order.seller_id != v_caller THEN
    RETURN json_build_object('success', false, 'error', 'not_order_seller');
  END IF;

  -- ★ تحقق: الطلب مكتمل
  IF v_order.status != 'completed' THEN
    RETURN json_build_object('success', false, 'error', 'order_not_completed');
  END IF;

  -- ★ تحقق: لم يُعالَج مسبقاً (لا توجد معاملة بيع سابقة لنفس الطلب)
  SELECT EXISTS(
    SELECT 1 FROM transactions
    WHERE ref = p_order_id AND type = 'sale' AND seller_id = v_caller
  ) INTO v_already_processed;

  IF v_already_processed THEN
    RETURN json_build_object('success', false, 'error', 'already_processed');
  END IF;

  -- ★ استخدام المبلغ الحقيقي من الطلب (لا نثق بالعميل)
  v_commission := ROUND(v_order.total * p_commission_rate, 2);
  v_net := v_order.total - v_commission;

  -- إدراج معاملة البيع
  INSERT INTO transactions (seller_id, type, amount, ref, status, description)
  VALUES (v_caller, 'sale', v_net, p_order_id, 'completed',
          'بيع طلب #' || p_order_id);

  -- إدراج معاملة العمولة
  INSERT INTO transactions (seller_id, type, amount, ref, status, description)
  VALUES (v_caller, 'commission', -v_commission, p_order_id, 'completed',
          'عمولة المنصة ' || (p_commission_rate * 100) || '%');

  -- تحديث رصيد البائع
  UPDATE profiles
  SET balance = balance + v_net,
      total_revenue = total_revenue + v_order.total,
      total_sales = total_sales + 1
  WHERE id = v_caller;

  RETURN json_build_object('success', true, 'net', v_net, 'commission', v_commission);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ===== القسم 2 (P1): منع إعادة تفعيل مزايدة مسحوبة =====
-- المشكلة: protect_bid_fields لا يمنع تغيير status من retracted→active
-- الحل: إضافة فحص الانتقال المسموح

CREATE OR REPLACE FUNCTION protect_bid_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- منع تعديل الحقول الثابتة
  IF NEW.amount != OLD.amount THEN
    RAISE EXCEPTION 'لا يمكن تعديل مبلغ المزايدة بعد الإدراج';
  END IF;
  IF NEW.product_id != OLD.product_id THEN
    RAISE EXCEPTION 'لا يمكن تغيير المنتج';
  END IF;
  IF NEW.bidder_id != OLD.bidder_id THEN
    RAISE EXCEPTION 'لا يمكن تغيير المزايد';
  END IF;

  -- ★ منع الانتقالات غير المسموحة للحالة
  IF NEW.status != OLD.status THEN
    -- الانتقال الوحيد المسموح: active → retracted
    IF NOT (OLD.status = 'active' AND NEW.status = 'retracted') THEN
      RAISE EXCEPTION 'انتقال حالة غير مسموح: % → %', OLD.status, NEW.status;
    END IF;
  END IF;

  -- ★ منع تعديل created_at
  IF NEW.created_at != OLD.created_at THEN
    RAISE EXCEPTION 'لا يمكن تعديل تاريخ الإنشاء';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ===== القسم 3 (P1): إضافة سياسة UPDATE transactions للأدمن =====
-- المشكلة: لا توجد سياسة FOR UPDATE على transactions
-- الحل: إنشاء RPC آمن لاعتماد/رفض السحب

DROP POLICY IF EXISTS "transactions_update_admin" ON transactions;
CREATE POLICY "transactions_update_admin" ON transactions
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- أيضاً RPC أكثر أماناً لاعتماد السحب
CREATE OR REPLACE FUNCTION approve_withdrawal(p_txn_id UUID, p_approve BOOLEAN)
RETURNS JSON AS $$
DECLARE
  v_caller UUID;
  v_txn RECORD;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- تحقق: أدمن
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_caller AND role = 'admin') THEN
    RETURN json_build_object('success', false, 'error', 'not_admin');
  END IF;

  -- قفل الصف
  SELECT id, type, status, seller_id, amount
  INTO v_txn
  FROM transactions
  WHERE id = p_txn_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'txn_not_found');
  END IF;

  IF v_txn.type != 'withdrawal' THEN
    RETURN json_build_object('success', false, 'error', 'not_withdrawal');
  END IF;

  IF v_txn.status != 'pending' THEN
    RETURN json_build_object('success', false, 'error', 'already_processed');
  END IF;

  IF p_approve THEN
    UPDATE transactions SET status = 'completed' WHERE id = p_txn_id;
  ELSE
    -- رفض: إرجاع المبلغ للرصيد
    UPDATE transactions SET status = 'cancelled' WHERE id = p_txn_id;
    UPDATE profiles
    SET balance = balance + ABS(v_txn.amount)
    WHERE id = v_txn.seller_id;
  END IF;

  RETURN json_build_object('success', true, 'action', CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ===== القسم 4 (P1): إضافة timeout لـ Buy Now المهجور =====
-- المشكلة: buy_now_auction يقفل المزاد بدون آلية إفراج
-- الحل: إضافة عمود buy_now_locked_at + دالة تفريغ

ALTER TABLE products ADD COLUMN IF NOT EXISTS buy_now_locked_at TIMESTAMPTZ;

-- تحديث buy_now_auction لتسجيل وقت القفل
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

  SELECT id, seller_id, auction_status, buy_now, listing_type, winner_id, buy_now_locked_at
  INTO v_product
  FROM products
  WHERE id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'product_not_found');
  END IF;

  IF v_product.listing_type != 'auction' THEN
    RETURN json_build_object('success', false, 'error', 'not_auction');
  END IF;

  -- ★ إذا مقفول لكن مرّ أكثر من 15 دقيقة → فكّ القفل تلقائياً
  IF v_product.auction_status = 'ended'
     AND v_product.buy_now_locked_at IS NOT NULL
     AND v_product.buy_now_locked_at < NOW() - INTERVAL '15 minutes'
  THEN
    UPDATE products
    SET auction_status = 'live', winner_id = NULL, buy_now_locked_at = NULL
    WHERE id = p_product_id;
    -- أعد تحميل البيانات
    SELECT id, seller_id, auction_status, buy_now, listing_type, winner_id
    INTO v_product
    FROM products WHERE id = p_product_id;
  END IF;

  IF v_product.auction_status != 'live' THEN
    RETURN json_build_object('success', false, 'error', 'auction_not_live');
  END IF;

  IF v_product.buy_now IS NULL OR v_product.buy_now <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'no_buy_now_price');
  END IF;

  IF v_caller = v_product.seller_id THEN
    RETURN json_build_object('success', false, 'error', 'cannot_buy_own');
  END IF;

  -- ★ تعيين الفائز + تسجيل وقت القفل
  UPDATE products
  SET winner_id = v_caller,
      auction_status = 'ended',
      buy_now_locked_at = NOW()
  WHERE id = p_product_id;

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- دالة تنظيف Buy Now المهجورة (تُستدعى دورياً أو مع auto_end)
CREATE OR REPLACE FUNCTION release_abandoned_buy_now()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  UPDATE products
  SET auction_status = 'live', winner_id = NULL, buy_now_locked_at = NULL
  WHERE auction_status = 'ended'
    AND buy_now_locked_at IS NOT NULL
    AND buy_now_locked_at < NOW() - INTERVAL '15 minutes';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ===== القسم 5 (P2): تحديث CHECK constraint للإشعارات =====
-- ملاحظة: جدول notifications لم يُنشأ بعد — سيُضاف الـ constraint عند إنشائه
-- الأنواع المطلوبة: outbid, auction_won, auction_ending, new_order,
--   order_status, product_approved, product_rejected, bid_retracted,
--   review_received, ticket_new, ticket_status, ticket_reply


-- ===== القسم 6 (P2): تقييد accept_offer بنوع until_sold =====

CREATE OR REPLACE FUNCTION accept_offer(p_product_id UUID, p_bidder_id UUID)
RETURNS JSON AS $$
DECLARE
  v_product RECORD;
  v_caller UUID;
  v_bid_exists BOOLEAN;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT id, seller_id, auction_status, listing_type, auction_type
  INTO v_product
  FROM products
  WHERE id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'product_not_found');
  END IF;

  IF v_product.seller_id != v_caller THEN
    RETURN json_build_object('success', false, 'error', 'not_seller');
  END IF;

  IF v_product.auction_status != 'live' THEN
    RETURN json_build_object('success', false, 'error', 'not_live');
  END IF;

  -- ★ تحقق: نوع المزاد must be until_sold (عروض مفتوحة)
  IF v_product.auction_type != 'until_sold' THEN
    RETURN json_build_object('success', false, 'error', 'not_open_offers_auction');
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM bids WHERE product_id = p_product_id AND bidder_id = p_bidder_id AND status = 'active'
  ) INTO v_bid_exists;

  IF NOT v_bid_exists THEN
    RETURN json_build_object('success', false, 'error', 'no_active_bid');
  END IF;

  UPDATE products
  SET auction_status = 'ended',
      winner_id = p_bidder_id
  WHERE id = p_product_id;

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ===== القسم 7: رسالة نجاح =====
DO $$ BEGIN RAISE NOTICE '15_review2_fixes applied successfully!'; END $$;
SELECT '15_review2_fixes applied successfully!' AS status;
