-- =============================================
-- 12_security_fixes.sql — إصلاح ثغرات الأمان ونزاهة المزاد
-- =============================================
-- يجب تنفيذه في Supabase SQL Editor بعد 11_auction_hardening.sql
-- يعالج 4 ثغرات: P0 ترقية صلاحيات، P0 تعديل المزايدة، P1 المسار المالي، P1 العروض المفتوحة


-- ===== القسم 1: [P0] منع ترقية الصلاحيات عبر profiles =====
-- المشكلة: profiles_update_own يسمح بتعديل أي عمود — المستخدم يقدر يغير role='admin' أو balance=999999
-- الحل: trigger يُعيد القيم الحساسة لقيمها الأصلية إذا المعدِّل ليس أدمن

CREATE OR REPLACE FUNCTION protect_sensitive_profile_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- فقط الأدمن يقدر يغير هذي الحقول
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    NEW.role := OLD.role;
    NEW.balance := OLD.balance;
    NEW.total_sales := OLD.total_sales;
    NEW.total_revenue := OLD.total_revenue;
    NEW.verified := OLD.verified;
    NEW.suspended := OLD.suspended;
    NEW.seller_verified := OLD.seller_verified;
    NEW.merchant_verified := OLD.merchant_verified;
    NEW.completed_auctions := OLD.completed_auctions;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_profile ON profiles;
CREATE TRIGGER trg_protect_profile
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION protect_sensitive_profile_fields();


-- ===== القسم 2: [P0] منع تعديل مبلغ المزايدة بعد الإدراج =====
-- المشكلة: validate_bid trigger يشتغل فقط على INSERT. bids_update_own يسمح بتعديل amount
-- الحل: trigger يرفض تعديل الحقول الجوهرية (amount, product_id, bidder_id)

CREATE OR REPLACE FUNCTION protect_bid_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.amount != OLD.amount THEN
    RAISE EXCEPTION 'لا يمكن تعديل مبلغ المزايدة بعد الإدراج';
  END IF;
  IF NEW.product_id != OLD.product_id THEN
    RAISE EXCEPTION 'لا يمكن تغيير المنتج';
  END IF;
  IF NEW.bidder_id != OLD.bidder_id THEN
    RAISE EXCEPTION 'لا يمكن تغيير المزايد';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_bid ON bids;
CREATE TRIGGER trg_protect_bid
  BEFORE UPDATE ON bids
  FOR EACH ROW EXECUTE FUNCTION protect_bid_fields();


-- ===== القسم 3: [P1] إصلاح المسار المالي — RPC function =====
-- المشكلة: الداشبورد يحاول INSERT في transactions كمستخدم عادي لكن RLS تمنعه (admin-only)
--          أيضاً يرسل date بدل created_at ولا يرسل seller_id
-- الحل: RPC بصلاحيات مرتفعة تسجل المعاملات وتحدث الرصيد

CREATE OR REPLACE FUNCTION record_sale_transaction(
  p_order_id TEXT,
  p_amount NUMERIC,
  p_commission_rate NUMERIC DEFAULT 0.05
)
RETURNS JSON AS $$
DECLARE
  v_caller UUID;
  v_commission NUMERIC;
  v_net NUMERIC;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  v_commission := ROUND(p_amount * p_commission_rate, 2);
  v_net := p_amount - v_commission;

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
      total_revenue = total_revenue + p_amount,
      total_sales = total_sales + 1
  WHERE id = v_caller;

  RETURN json_build_object('success', true, 'net', v_net, 'commission', v_commission);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ===== القسم 4: [P1] قبول عرض في المزاد المفتوح =====
-- المشكلة: نوع "مزاد مفتوح (عروض)" يعد البائع "استقبل عروضاً وقرر البيع" لكن لا يوجد مسار لذلك
-- الحل: RPC تسمح للبائع باختيار فائز من المزايدين

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

  -- قفل المنتج
  SELECT id, seller_id, auction_status, listing_type
  INTO v_product
  FROM products
  WHERE id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'product_not_found');
  END IF;

  -- التحقق: المتصل هو البائع
  IF v_product.seller_id != v_caller THEN
    RETURN json_build_object('success', false, 'error', 'not_seller');
  END IF;

  -- التحقق: المزاد نشط
  IF v_product.auction_status != 'live' THEN
    RETURN json_build_object('success', false, 'error', 'not_live');
  END IF;

  -- التحقق: المزايد عنده عرض فعلاً
  SELECT EXISTS(
    SELECT 1 FROM bids WHERE product_id = p_product_id AND bidder_id = p_bidder_id AND status = 'active'
  ) INTO v_bid_exists;

  IF NOT v_bid_exists THEN
    RETURN json_build_object('success', false, 'error', 'no_active_bid');
  END IF;

  -- تحديث المنتج: تعيين الفائز وإنهاء المزاد
  UPDATE products
  SET auction_status = 'ended',
      winner_id = p_bidder_id
  WHERE id = p_product_id;

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


SELECT '12_security_fixes applied successfully!' AS status;
