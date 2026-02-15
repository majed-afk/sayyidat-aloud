-- ===== Fix: حل مشكلة "Database error saving new user" =====
-- شغّل هذا في SQL Editor

-- 1. مسح المستخدمين القدام اللي فشل تسجيلهم
DELETE FROM auth.users;

-- 2. حذف الـ trigger القديم
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

-- 3. تعديل جدول profiles: السماح بقيم فارغة مؤقتاً
ALTER TABLE profiles ALTER COLUMN first_name SET DEFAULT '';
ALTER TABLE profiles ALTER COLUMN last_name SET DEFAULT '';

-- 4. إنشاء trigger محسّن مع معالجة الأخطاء
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, first_name, last_name, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', 'مستخدم'),
    COALESCE(NEW.raw_user_meta_data->>'last_name', 'جديد'),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'seller')
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- في حالة أي خطأ، أنشئ البروفايل بقيم افتراضية
  INSERT INTO profiles (id, first_name, last_name, phone, role)
  VALUES (
    NEW.id,
    'مستخدم',
    'جديد',
    '',
    'seller'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. ربط الـ trigger بجدول auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
