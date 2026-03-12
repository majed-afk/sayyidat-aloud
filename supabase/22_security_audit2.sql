-- 22_security_audit2.sql — إصلاحات أمنية — الجولة الثانية — صيدات العود
-- تاريخ: 2026-03-12
-- يُنفّذ بعد 21_smsa_security_patch.sql


-- ===== [P1] حماية shipment_state من التعديل المباشر =====
-- المشكلة: يمكن للبائع تغيير shipment_state مباشرة عبر UPDATE بدون المرور بـ RPCs
-- الإصلاح: التحقق من صحة الانتقالات في الـ trigger
--
-- الانتقالات المسموحة:
--   none → creating           (reserve_shipping RPC)
--   creating → finalized      (commit_shipping RPC)
--   creating → none           (rollback_shipping RPC)
--   finalized → cancelled     (cancel_shipping RPC)
--   أي حالة → needs_reconcile (حالة طوارئ — يُسمح بها دائماً)

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

  -- ★ [P1 NEW] حماية shipment_state — التحقق من صحة الانتقالات
  IF NEW.shipment_state IS DISTINCT FROM OLD.shipment_state THEN
    -- needs_reconcile مسموح دائماً (حالة طوارئ)
    IF NEW.shipment_state = 'needs_reconcile' THEN
      -- مسموح
      NULL;
    ELSIF OLD.shipment_state = 'none' AND NEW.shipment_state = 'creating' THEN
      -- مسموح: reserve_shipping
      NULL;
    ELSIF OLD.shipment_state = 'creating' AND NEW.shipment_state = 'finalized' THEN
      -- مسموح: commit_shipping
      NULL;
    ELSIF OLD.shipment_state = 'creating' AND NEW.shipment_state = 'none' THEN
      -- مسموح: rollback_shipping
      NULL;
    ELSIF OLD.shipment_state = 'finalized' AND NEW.shipment_state = 'cancelled' THEN
      -- مسموح: cancel_shipping
      NULL;
    ELSIF OLD.shipment_state = 'cancelled' AND NEW.shipment_state = 'none' THEN
      -- مسموح: إعادة تعيين بعد الإلغاء (لإعادة المحاولة)
      NULL;
    ELSE
      RAISE EXCEPTION 'invalid shipment_state transition: % → %', OLD.shipment_state, NEW.shipment_state;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
