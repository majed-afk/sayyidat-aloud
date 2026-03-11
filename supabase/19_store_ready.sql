-- 19_store_ready.sql — إصلاحات جاهزية المتاجر — صيدات العود
-- تاريخ: 2026-03-11


-- ===== 1. إغلاق ثغرة تصعيد الصلاحيات =====
-- المشكلة: handle_new_user يأخذ role من raw_user_meta_data
-- الحل: تجاهل role من العميل وتثبيت 'seller' دائماً

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, first_name, last_name, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', 'مستخدم'),
    COALESCE(NEW.raw_user_meta_data->>'last_name', 'جديد'),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    'seller'  -- ★ HARDCODED — لا يقبل role من العميل أبداً
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO profiles (id, first_name, last_name, phone, role)
  VALUES (NEW.id, 'مستخدم', 'جديد', '', 'seller')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ===== 2. حماية بيانات البنك — GRANT على profiles_public =====
-- profiles_public view أُنشئ في 18_launch_fixes.sql
-- نمنح صلاحية القراءة للجميع عبر الـ view الآمن

GRANT SELECT ON public.profiles_public TO authenticated;
GRANT SELECT ON public.profiles_public TO anon;


-- ===== 3. حماية الحقول المالية في الطلبات =====
-- المشكلة: البائع يمكنه تعديل total/price عبر API ثم تسجيل معاملة مضخمة
-- الحل: trigger يمنع تعديل الحقول المالية بعد الإنشاء

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

  -- المسموح تعديله: status, carrier, tracking_number,
  -- waybill_generated, cancel_reason, payment_method, shipping_method
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_order ON orders;
CREATE TRIGGER trg_protect_order
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION protect_order_fields();


-- ===== 4. إضافة عمود طريقة الدفع =====

ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'cod';


-- ===== 5. حذف الحساب الذاتي (شرط Apple Store) =====

CREATE OR REPLACE FUNCTION delete_own_account(p_reason TEXT DEFAULT '')
RETURNS JSON AS $$
DECLARE
  v_caller UUID;
  v_pending INTEGER;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- فحص طلبات معلقة (كبائع)
  SELECT COUNT(*) INTO v_pending
  FROM orders
  WHERE seller_id = v_caller AND status IN ('new', 'processing');

  IF v_pending > 0 THEN
    RETURN json_build_object('success', false, 'error', 'pending_orders',
      'message', 'لديك ' || v_pending || ' طلب معلّق كبائع. أكمل أو ألغِ طلباتك أولاً');
  END IF;

  -- فحص طلبات معلقة (كمشتري)
  SELECT COUNT(*) INTO v_pending
  FROM orders
  WHERE buyer_id = v_caller AND status IN ('new', 'processing');

  IF v_pending > 0 THEN
    RETURN json_build_object('success', false, 'error', 'pending_orders_buyer',
      'message', 'لديك ' || v_pending || ' طلب كمشترٍ قيد المعالجة');
  END IF;

  -- فحص سحوبات معلقة
  IF EXISTS (
    SELECT 1 FROM transactions
    WHERE seller_id = v_caller AND type = 'withdrawal' AND status = 'pending'
  ) THEN
    RETURN json_build_object('success', false, 'error', 'pending_withdrawal',
      'message', 'لديك طلب سحب معلّق. انتظر حتى يتم معالجته');
  END IF;

  -- تعطيل المنتجات
  UPDATE products SET active = false WHERE seller_id = v_caller;

  -- مسح البيانات الحساسة (soft delete)
  UPDATE profiles
  SET suspended = true,
      first_name = 'محذوف',
      last_name = '',
      phone = '',
      store_name = '',
      store_desc = '',
      bank_name = '',
      iban = '',
      bank_holder = ''
  WHERE id = v_caller;

  -- حذف من auth.users (يحذف الـ profile تلقائياً عبر CASCADE)
  DELETE FROM auth.users WHERE id = v_caller;

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
