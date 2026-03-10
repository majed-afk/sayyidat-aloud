-- ============================================================
-- 16_review3_fixes.sql — إصلاحات المراجعة الثالثة — صيدات العود
-- ============================================================
-- P1×3 + P2×2 = 5 إصلاحات


-- ===== القسم 1 (P1): إنشاء/تحديث جدول الإشعارات مع أنواع الدعم =====
-- المشكلة: الجدول غير موجود في Supabase (لم يُنفّذ 10_improvements.sql)
-- والكود يرسل ticket_new / ticket_status / ticket_reply

CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'outbid', 'auction_won', 'auction_ending', 'new_order',
    'order_status', 'product_approved', 'product_rejected',
    'bid_retracted', 'review_received',
    'ticket_new', 'ticket_status', 'ticket_reply'
  )),
  title TEXT NOT NULL,
  body TEXT DEFAULT '',
  link TEXT DEFAULT '',
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- فهرس للاستعلامات المتكررة
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, created_at DESC);

-- RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select_own" ON notifications;
CREATE POLICY "notifications_select_own" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_insert_auth" ON notifications;
CREATE POLICY "notifications_insert_auth" ON notifications
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
CREATE POLICY "notifications_update_own" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- في حال كان الجدول موجوداً مسبقاً بدون أنواع الدعم، نحدّث الـ constraint
DO $$
BEGIN
  -- حاول حذف وإعادة إنشاء الـ constraint
  ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
  ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
    CHECK (type IN (
      'outbid', 'auction_won', 'auction_ending', 'new_order',
      'order_status', 'product_approved', 'product_rejected',
      'bid_retracted', 'review_received',
      'ticket_new', 'ticket_status', 'ticket_reply'
    ));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'notifications constraint update skipped: %', SQLERRM;
END $$;


-- ===== القسم 2 (P2): دمج release_abandoned_buy_now في auto_end =====
-- المشكلة: release_abandoned_buy_now معرّفة لكن لا تُستدعى أبداً
-- الحل: استدعاؤها داخل auto_end_expired_auctions

CREATE OR REPLACE FUNCTION auto_end_expired_auctions()
RETURNS INTEGER AS $$
DECLARE
  ended_count INTEGER := 0;
  rec RECORD;
BEGIN
  -- ★ فك قفل Buy Now المهجور (15+ دقيقة)
  PERFORM release_abandoned_buy_now();

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


-- ===== القسم 3: رسالة نجاح =====
DO $$ BEGIN RAISE NOTICE '16_review3_fixes applied successfully!'; END $$;
SELECT '16_review3_fixes applied successfully!' AS status;
