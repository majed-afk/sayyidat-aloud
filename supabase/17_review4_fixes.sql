-- ============================================================
-- 17_review4_fixes.sql — إصلاحات المراجعة الرابعة — صيدات العود
-- ============================================================
-- P1×1 + P2×2 = 3 إصلاحات


-- ===== القسم 1 (P2): تقييد سياسة INSERT للإشعارات =====
-- المشكلة: notifications_insert_auth تسمح لأي مستخدم بإنشاء إشعار لأي user_id
-- الحل: تقييد المباشر + RPC لإشعارات النظام (SECURITY DEFINER)

-- تقييد الإدراج المباشر ليسمح فقط للمستخدم بإشعار نفسه
DROP POLICY IF EXISTS "notifications_insert_auth" ON notifications;
DROP POLICY IF EXISTS "notifications_insert_own" ON notifications;
CREATE POLICY "notifications_insert_own" ON notifications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RPC آمن لإشعارات النظام (حيث المرسل ≠ المستقبل)
-- مثل: إشعار البائع بطلب جديد، إشعار المشتري بتحديث الشحن
CREATE OR REPLACE FUNCTION send_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_body TEXT DEFAULT '',
  p_link TEXT DEFAULT ''
)
RETURNS JSON AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  INSERT INTO notifications (user_id, type, title, body, link)
  VALUES (p_user_id, p_type, p_title, p_body, p_link);

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ===== القسم 2: رسالة نجاح =====
DO $$ BEGIN RAISE NOTICE '17_review4_fixes applied successfully!'; END $$;
SELECT '17_review4_fixes applied successfully!' AS status;
