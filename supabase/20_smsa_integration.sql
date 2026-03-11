-- 20_smsa_integration.sql — ربط SMSA Express — صيدات العود
-- تاريخ: 2026-03-11


-- ===== 1. أعمدة جديدة لجدول الطلبات =====

ALTER TABLE orders ADD COLUMN IF NOT EXISTS awb_number TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipment_state TEXT DEFAULT 'none';

-- قيد على القيم المسموحة
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_shipment_state_check'
  ) THEN
    ALTER TABLE orders ADD CONSTRAINT orders_shipment_state_check
      CHECK (shipment_state IN ('none','creating','finalized','needs_reconcile','cancelled'));
  END IF;
END $$;

-- ★ UNIQUE AWB غير فارغ — يمنع تكرار AWB على مستوى DB
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_awb_unique
  ON orders (awb_number) WHERE awb_number != '';


-- ===== 2. تحديث حماية الحقول المالية (protect_order_fields) =====
-- إضافة حماية awb_number و shipment_state بعد الـ finalize

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

  -- ★ حماية awb_number بعد الـ finalize
  IF OLD.shipment_state = 'finalized' AND NEW.awb_number IS DISTINCT FROM OLD.awb_number THEN
    RAISE EXCEPTION 'cannot modify awb_number after finalization';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ===== 3. تحديث CHECK constraint لجدول المعاملات =====

ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_type_check
  CHECK (type IN ('sale','commission','withdrawal','refund','shipping','shipping_refund'));

-- ★ شحنة واحدة فقط لكل طلب (باستخدام ref)
CREATE UNIQUE INDEX IF NOT EXISTS idx_tx_shipping_unique
  ON transactions (ref, type) WHERE type = 'shipping';

-- ★ استرجاع واحد فقط لكل طلب
CREATE UNIQUE INDEX IF NOT EXISTS idx_tx_shipping_refund_unique
  ON transactions (ref, type) WHERE type = 'shipping_refund';


-- ===== 4. جدول سجل المصالحة (reconciliation) =====

CREATE TABLE IF NOT EXISTS shipment_reconcile_log (
  id SERIAL PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  awb_number TEXT DEFAULT '',
  failure_reason TEXT NOT NULL,
  failure_time TIMESTAMPTZ DEFAULT NOW(),
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES profiles(id),
  notes TEXT DEFAULT ''
);

ALTER TABLE shipment_reconcile_log ENABLE ROW LEVEL SECURITY;

-- RLS: الأدمن فقط يقرأ/يعدل
DROP POLICY IF EXISTS admin_reconcile ON shipment_reconcile_log;
CREATE POLICY admin_reconcile ON shipment_reconcile_log
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- service_role يقدر يكتب (للـ API)
DROP POLICY IF EXISTS service_write_reconcile ON shipment_reconcile_log;
CREATE POLICY service_write_reconcile ON shipment_reconcile_log
  FOR INSERT WITH CHECK (true);


-- ===== 5. RPC: reserve_shipping — حجز (none → creating) =====

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

  -- تحقق الرصيد
  IF (SELECT balance FROM profiles WHERE id = p_caller_id) < p_cost THEN
    RETURN '{"success":false,"error":"insufficient_balance"}'::json;
  END IF;

  -- خصم الرصيد (حجز)
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


-- ===== 6. RPC: commit_shipping — تأكيد (creating → finalized) =====

CREATE OR REPLACE FUNCTION commit_shipping(
  p_order_id TEXT,
  p_awb TEXT,
  p_caller_id UUID
) RETURNS JSON AS $$
DECLARE
  v_order RECORD;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN '{"success":false,"error":"not_found"}'::json;
  END IF;

  IF v_order.seller_id != p_caller_id THEN
    RETURN '{"success":false,"error":"not_owner"}'::json;
  END IF;

  -- ★ Idempotent: same AWB already committed
  IF v_order.awb_number = p_awb AND v_order.shipment_state = 'finalized' THEN
    RETURN '{"success":true,"note":"already_committed"}'::json;
  END IF;

  -- ★ State machine: فقط creating → finalized
  IF v_order.shipment_state != 'creating' THEN
    RETURN '{"success":false,"error":"invalid_state"}'::json;
  END IF;

  UPDATE orders SET
    awb_number = p_awb,
    waybill_generated = true,
    shipment_state = 'finalized'
  WHERE id = p_order_id;

  RETURN '{"success":true}'::json;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ===== 7. RPC: rollback_shipping — استرجاع عند فشل SMSA (creating → none) =====

CREATE OR REPLACE FUNCTION rollback_shipping(
  p_order_id TEXT,
  p_caller_id UUID
) RETURNS JSON AS $$
DECLARE
  v_order RECORD;
  v_cost NUMERIC;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN '{"success":false,"error":"not_found"}'::json;
  END IF;

  IF v_order.seller_id != p_caller_id THEN
    RETURN '{"success":false,"error":"not_owner"}'::json;
  END IF;

  -- ★ State machine: فقط creating → none
  IF v_order.shipment_state != 'creating' THEN
    RETURN '{"success":false,"error":"invalid_state"}'::json;
  END IF;

  -- جلب المبلغ المحجوز
  SELECT ABS(amount) INTO v_cost FROM transactions
  WHERE ref = p_order_id AND type = 'shipping' LIMIT 1;

  IF v_cost IS NOT NULL THEN
    -- إرجاع الرصيد
    UPDATE profiles SET balance = balance + v_cost WHERE id = p_caller_id;
    -- حذف معاملة الشحن (لم تكتمل)
    DELETE FROM transactions WHERE ref = p_order_id AND type = 'shipping';
  END IF;

  -- إرجاع الحالة
  UPDATE orders SET
    shipment_state = 'none',
    carrier = '',
    carrier_name = ''
  WHERE id = p_order_id;

  RETURN json_build_object('success', true, 'refunded', COALESCE(v_cost, 0));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ===== 8. RPC: cancel_shipping — إلغاء بعد التأكيد (finalized → cancelled) =====

CREATE OR REPLACE FUNCTION cancel_shipping(
  p_order_id TEXT,
  p_caller_id UUID
) RETURNS JSON AS $$
DECLARE
  v_order RECORD;
  v_cost NUMERIC;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN '{"success":false,"error":"not_found"}'::json;
  END IF;

  IF v_order.seller_id != p_caller_id THEN
    RETURN '{"success":false,"error":"not_owner"}'::json;
  END IF;

  -- ★ State machine: فقط finalized → cancelled
  IF v_order.shipment_state != 'finalized' THEN
    RETURN '{"success":false,"error":"invalid_state"}'::json;
  END IF;

  -- جلب مبلغ الشحن الأصلي
  SELECT ABS(amount) INTO v_cost FROM transactions
  WHERE ref = p_order_id AND type = 'shipping' LIMIT 1;

  IF v_cost IS NULL THEN
    RETURN '{"success":false,"error":"shipping_tx_not_found"}'::json;
  END IF;

  -- إرجاع المبلغ للبائع
  UPDATE profiles SET balance = balance + v_cost WHERE id = p_caller_id;

  -- تسجيل معاملة استرجاع
  INSERT INTO transactions (seller_id, type, amount, ref, status, description)
  VALUES (p_caller_id, 'shipping_refund', v_cost, p_order_id, 'completed', 'استرجاع شحن — إلغاء بوليصة');

  -- تحديث الطلب
  UPDATE orders SET
    awb_number = '',
    shipment_state = 'cancelled',
    carrier = '',
    carrier_name = '',
    waybill_generated = false
  WHERE id = p_order_id;

  RETURN json_build_object('success', true, 'refunded', v_cost);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ===== 9. ★ صلاحيات RPCs — service_role فقط =====

REVOKE EXECUTE ON FUNCTION reserve_shipping(TEXT,NUMERIC,UUID) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION commit_shipping(TEXT,TEXT,UUID) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION rollback_shipping(TEXT,UUID) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION cancel_shipping(TEXT,UUID) FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION reserve_shipping(TEXT,NUMERIC,UUID) TO service_role;
GRANT EXECUTE ON FUNCTION commit_shipping(TEXT,TEXT,UUID) TO service_role;
GRANT EXECUTE ON FUNCTION rollback_shipping(TEXT,UUID) TO service_role;
GRANT EXECUTE ON FUNCTION cancel_shipping(TEXT,UUID) TO service_role;


-- ===== 10. بذر إعدادات الشحن في admin_settings =====

INSERT INTO admin_settings (key, value) VALUES
  ('shipping_standard', '25'),
  ('shipping_express', '45'),
  ('shipping_same_day', '75')
ON CONFLICT (key) DO NOTHING;
