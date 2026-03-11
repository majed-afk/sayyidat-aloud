-- 21_smsa_security_patch.sql — إصلاحات أمنية + سباقات — صيدات العود
-- تاريخ: 2026-03-11
-- يُنفّذ بعد 20_smsa_integration.sql


-- ===== 1. [P0] إصلاح Trigger — السماح بتصفير awb_number عند الإلغاء =====
-- المشكلة: protect_order_fields يمنع تعديل awb_number إذا كانت الحالة finalized
-- لكن cancel_shipping تحتاج تصفير awb_number عند الانتقال finalized → cancelled

CREATE OR REPLACE FUNCTION protect_order_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- حقول مالية/هوية — لا تتغير بعد الإنشاء
  IF NEW.buyer_id IS DISTINCT FROM OLD.buyer_id THEN
    RAISE EXCEPTION 'cannot modify buyer_id';
  END IF;
  IF NEW.seller_id IS DISTINCT FROM OLD.seller_id THEN
    RAISE EXCEPTION 'cannot modify seller_id';
  END IF;
  IF NEW.product_id IS DISTINCT FROM OLD.product_id THEN
    RAISE EXCEPTION 'cannot modify product_id';
  END IF;
  IF NEW.product_name IS DISTINCT FROM OLD.product_name THEN
    RAISE EXCEPTION 'cannot modify product_name';
  END IF;
  IF NEW.price IS DISTINCT FROM OLD.price THEN
    RAISE EXCEPTION 'cannot modify price';
  END IF;
  IF NEW.qty IS DISTINCT FROM OLD.qty THEN
    RAISE EXCEPTION 'cannot modify qty';
  END IF;
  IF NEW.total IS DISTINCT FROM OLD.total THEN
    RAISE EXCEPTION 'cannot modify total';
  END IF;
  IF NEW.shipping IS DISTINCT FROM OLD.shipping THEN
    RAISE EXCEPTION 'cannot modify shipping';
  END IF;
  IF NEW.vat IS DISTINCT FROM OLD.vat THEN
    RAISE EXCEPTION 'cannot modify vat';
  END IF;
  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'cannot modify created_at';
  END IF;

  -- ★ حماية awb_number بعد الـ finalize (يُستثنى الإلغاء → cancelled)
  IF OLD.shipment_state = 'finalized'
     AND NEW.shipment_state != 'cancelled'
     AND NEW.awb_number IS DISTINCT FROM OLD.awb_number THEN
    RAISE EXCEPTION 'cannot modify awb_number after finalization';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ===== 2. [P0] سد صلاحيات PUBLIC على RPCs =====
-- المشكلة: REVOKE من anon/authenticated فقط — PUBLIC قد يكون لا يزال مسموحاً

REVOKE EXECUTE ON FUNCTION reserve_shipping(TEXT,NUMERIC,UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION commit_shipping(TEXT,TEXT,UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION rollback_shipping(TEXT,UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION cancel_shipping(TEXT,UUID) FROM PUBLIC;

-- إعادة التأكيد: service_role فقط
GRANT EXECUTE ON FUNCTION reserve_shipping(TEXT,NUMERIC,UUID) TO service_role;
GRANT EXECUTE ON FUNCTION commit_shipping(TEXT,TEXT,UUID) TO service_role;
GRANT EXECUTE ON FUNCTION rollback_shipping(TEXT,UUID) TO service_role;
GRANT EXECUTE ON FUNCTION cancel_shipping(TEXT,UUID) TO service_role;


-- ===== 3. [P1] إصلاح سباق الرصيد السالب =====
-- المشكلة: SELECT balance بدون FOR UPDATE يسمح بسباق
-- الإصلاح: FOR UPDATE على صف profiles قبل الخصم

CREATE OR REPLACE FUNCTION reserve_shipping(
  p_order_id TEXT,
  p_cost NUMERIC,
  p_caller_id UUID
) RETURNS JSON AS $$
DECLARE
  v_order RECORD;
BEGIN
  -- قفل الصف (سريع — فقط لتغيير الحالة)
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN '{"success":false,"error":"not_found"}'::json;
  END IF;

  IF v_order.seller_id != p_caller_id THEN
    RETURN '{"success":false,"error":"not_owner"}'::json;
  END IF;

  IF v_order.status != 'processing' THEN
    RETURN '{"success":false,"error":"invalid_status"}'::json;
  END IF;

  -- ★ Idempotent: already creating
  IF v_order.shipment_state = 'creating' THEN
    RETURN '{"success":true,"note":"already_reserved"}'::json;
  END IF;

  -- ★ Idempotent: already finalized
  IF v_order.shipment_state = 'finalized' THEN
    RETURN '{"success":true,"note":"already_finalized"}'::json;
  END IF;

  -- ★ State machine: فقط none → creating
  IF v_order.shipment_state != 'none' THEN
    RETURN '{"success":false,"error":"invalid_state"}'::json;
  END IF;

  -- ★ تحقق الرصيد مع FOR UPDATE — يمنع سباق الرصيد السالب
  IF (SELECT balance FROM profiles WHERE id = p_caller_id FOR UPDATE) < p_cost THEN
    RETURN '{"success":false,"error":"insufficient_balance"}'::json;
  END IF;

  -- خصم الرصيد (حجز) — الصف مقفل بالفعل
  UPDATE profiles SET balance = balance - p_cost WHERE id = p_caller_id;

  -- تسجيل معاملة شحن
  INSERT INTO transactions (seller_id, type, amount, ref, status, description)
  VALUES (p_caller_id, 'shipping', -p_cost, p_order_id, 'completed', 'تكلفة شحن SMSA');

  -- تحديث حالة الطلب
  UPDATE orders SET
    shipment_state = 'creating',
    carrier = 'smsa',
    carrier_name = 'SMSA Express'
  WHERE id = p_order_id;

  RETURN '{"success":true}'::json;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ===== 4. [P2] تقييد policy المصالحة لـ service_role فقط =====
-- المشكلة: FOR INSERT WITH CHECK (true) بدون TO service_role

DROP POLICY IF EXISTS service_write_reconcile ON shipment_reconcile_log;
CREATE POLICY service_write_reconcile ON shipment_reconcile_log
  FOR INSERT TO service_role WITH CHECK (true);


-- ===== 5. إعادة تأكيد صلاحيات RPCs بعد إعادة التعريف =====

REVOKE EXECUTE ON FUNCTION reserve_shipping(TEXT,NUMERIC,UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION reserve_shipping(TEXT,NUMERIC,UUID) TO service_role;
