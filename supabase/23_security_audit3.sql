-- 23_security_audit3.sql — إصلاحات أمنية — الجولة الثالثة — صيدات العود
-- تاريخ: 2026-03-12
-- يُنفّذ بعد 22_security_audit2.sql


-- ===== [F-02] P1: إصلاح سباق الرصيد في record_withdrawal =====
-- المشكلة: SELECT balance بدون FOR UPDATE يسمح بطلبي سحب متزامنين
-- الإصلاح: إضافة FOR UPDATE لقفل الصف أثناء المعاملة

DROP FUNCTION IF EXISTS record_withdrawal(NUMERIC, TEXT);

CREATE OR REPLACE FUNCTION record_withdrawal(
  p_amount NUMERIC,
  p_bank_name TEXT
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

  -- ★ FIX: FOR UPDATE لمنع سباق الرصيد
  SELECT balance, iban INTO v_balance, v_iban
  FROM profiles
  WHERE id = v_caller
  FOR UPDATE;

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


-- ===== [F-03] P1: تقييد قراءة البروفايلات — حماية IBAN/رصيد =====
-- المشكلة: profiles_select_all يكشف iban, bank_name, bank_holder, balance, total_revenue
-- الإصلاح: السماح بقراءة الصف الكامل لصاحبه أو الأدمن فقط
-- الصفحات العامة تستخدم profiles_public view (لا تحتوي حقول حساسة)

DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
DROP POLICY IF EXISTS "profiles_select_admin" ON profiles;

-- صاحب الحساب: كل الحقول
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- الأدمن: كل الحقول لكل المستخدمين
CREATE POLICY "profiles_select_admin" ON profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ★ دالة مساعدة لجلب معرّفات الأدمن (تُستخدم في تذاكر الدعم)
-- بديل عن query مباشر على profiles الذي لن يعمل بعد تقييد السياسة
CREATE OR REPLACE FUNCTION get_admin_ids()
RETURNS SETOF UUID AS $$
  SELECT id FROM profiles WHERE role = 'admin';
$$ LANGUAGE sql SECURITY DEFINER;

-- صلاحيات: متاح للمسجّلين فقط
REVOKE EXECUTE ON FUNCTION get_admin_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_admin_ids() TO authenticated;

-- ★ تأكيد أن profiles_public view يعمل بصلاحيات عالية (SECURITY DEFINER)
-- يتخطى RLS ويعرض حقول غير حساسة فقط — لا حاجة لتعديل
-- (Views في PostgreSQL تُنفّذ بصلاحيات المالك بشكل افتراضي)


-- ===== [F-05] P2: إصلاح record_sale_transaction — تحقق من ملكية الطلب =====
-- المشكلة: RPC تقبل أي p_order_id بدون التأكد من ملكية الطلب
-- الإصلاح: التحقق من أن الطلب يخص المتصل + حالته completed + منع التكرار

DROP FUNCTION IF EXISTS record_sale_transaction(TEXT, NUMERIC, NUMERIC);

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
  v_order RECORD;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- ★ FIX: تحقق من ملكية الطلب وحالته
  SELECT * INTO v_order FROM orders
  WHERE id = p_order_id AND seller_id = v_caller AND status = 'completed'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'invalid_order');
  END IF;

  -- ★ FIX: منع التكرار
  IF EXISTS (SELECT 1 FROM transactions WHERE ref = p_order_id AND type = 'sale') THEN
    RETURN json_build_object('success', false, 'error', 'already_recorded');
  END IF;

  -- ★ FIX: استخدام المبلغ من الطلب الفعلي بدل قبوله من العميل
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
