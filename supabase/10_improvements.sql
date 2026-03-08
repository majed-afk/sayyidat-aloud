-- ===================================================================
-- 10_improvements.sql — تحسينات أمنية + إشعارات + تقييمات + نزاعات
-- صيدات العود — مارس 2026
-- ===================================================================

-- ============ 1) RLS: منع قراءة المنتجات غير المعتمدة ============
-- حذف السياسة القديمة أولاً
DROP POLICY IF EXISTS "products_select_all" ON products;
DROP POLICY IF EXISTS "products_select_approved_only" ON products;

CREATE POLICY "products_select_approved_only" ON products
  FOR SELECT USING (
    (active = true AND approval_status = 'approved')
    OR seller_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============ 2) Trigger: حماية انتقالات حالة المزاد ============
CREATE OR REPLACE FUNCTION validate_auction_transition()
RETURNS TRIGGER AS $$
BEGIN
  -- لا يمكن إعادة تفعيل مزاد ملغي
  IF OLD.auction_status = 'cancelled' AND NEW.auction_status != 'cancelled' THEN
    RAISE EXCEPTION 'Cannot reactivate cancelled auction';
  END IF;
  -- لا يمكن تعديل مزاد مباع
  IF OLD.auction_status = 'sold' AND NEW.auction_status != 'sold' THEN
    RAISE EXCEPTION 'Cannot modify sold auction';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_auction_transition ON products;
CREATE TRIGGER check_auction_transition
  BEFORE UPDATE OF auction_status ON products
  FOR EACH ROW EXECUTE FUNCTION validate_auction_transition();

-- ============ 3) جدول الإشعارات ============
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'outbid', 'auction_won', 'auction_ending', 'new_order',
    'order_status', 'product_approved', 'product_rejected',
    'bid_retracted', 'review_received'
  )),
  title TEXT NOT NULL,
  body TEXT DEFAULT '',
  link TEXT DEFAULT '',
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user
  ON notifications(user_id, is_read, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select_own" ON notifications;
CREATE POLICY "notifications_select_own" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
CREATE POLICY "notifications_update_own" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_insert_auth" ON notifications;
CREATE POLICY "notifications_insert_auth" ON notifications
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "notifications_delete_own" ON notifications;
CREATE POLICY "notifications_delete_own" ON notifications
  FOR DELETE USING (auth.uid() = user_id);

-- ============ 4) جدول التقييمات والمراجعات ============
CREATE TABLE IF NOT EXISTS reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT DEFAULT '',
  is_visible BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(order_id, reviewer_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id, is_visible);
CREATE INDEX IF NOT EXISTS idx_reviews_seller ON reviews(seller_id);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reviews_select_visible" ON reviews;
CREATE POLICY "reviews_select_visible" ON reviews
  FOR SELECT USING (
    is_visible = true
    OR reviewer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "reviews_insert_own" ON reviews;
CREATE POLICY "reviews_insert_own" ON reviews
  FOR INSERT WITH CHECK (auth.uid() = reviewer_id);

DROP POLICY IF EXISTS "reviews_update_admin" ON reviews;
CREATE POLICY "reviews_update_admin" ON reviews
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Trigger: تحديث rating في products تلقائياً عند إضافة/تعديل/حذف مراجعة
CREATE OR REPLACE FUNCTION update_product_rating()
RETURNS TRIGGER AS $$
DECLARE target_product_id UUID;
BEGIN
  target_product_id := COALESCE(NEW.product_id, OLD.product_id);
  UPDATE products SET rating = (
    SELECT COALESCE(ROUND(AVG(rating)::NUMERIC, 1), 0)
    FROM reviews
    WHERE product_id = target_product_id AND is_visible = true
  ) WHERE id = target_product_id;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_rating ON reviews;
CREATE TRIGGER trg_update_rating
  AFTER INSERT OR UPDATE OR DELETE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_product_rating();

-- ============ 5) Rate Limiting: منع المزايدات السريعة ============
CREATE OR REPLACE FUNCTION check_bid_rate_limit()
RETURNS TRIGGER AS $$
DECLARE last_bid_time TIMESTAMPTZ;
BEGIN
  SELECT MAX(created_at) INTO last_bid_time
  FROM bids
  WHERE bidder_id = NEW.bidder_id
    AND product_id = NEW.product_id
    AND status = 'active';

  IF last_bid_time IS NOT NULL AND (NOW() - last_bid_time) < INTERVAL '5 seconds' THEN
    RAISE EXCEPTION 'Rate limit: wait 5 seconds between bids';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bid_rate_limit ON bids;
CREATE TRIGGER trg_bid_rate_limit
  BEFORE INSERT ON bids
  FOR EACH ROW EXECUTE FUNCTION check_bid_rate_limit();

-- ============ 6) جدول النزاعات ============
CREATE TABLE IF NOT EXISTS disputes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id),
  buyer_id UUID NOT NULL REFERENCES profiles(id),
  seller_id UUID NOT NULL REFERENCES profiles(id),
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'rejected')),
  resolution TEXT DEFAULT '',
  admin_notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status, created_at DESC);

ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "disputes_select_involved" ON disputes;
CREATE POLICY "disputes_select_involved" ON disputes
  FOR SELECT USING (
    auth.uid() = buyer_id
    OR auth.uid() = seller_id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "disputes_insert_buyer" ON disputes;
CREATE POLICY "disputes_insert_buyer" ON disputes
  FOR INSERT WITH CHECK (auth.uid() = buyer_id);

DROP POLICY IF EXISTS "disputes_update_admin" ON disputes;
CREATE POLICY "disputes_update_admin" ON disputes
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============ 7) تسلسل رقم الفاتورة ============
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1001;

-- ============ 8) عمود invoice_number في orders ============
ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_number TEXT DEFAULT '';

-- ============ 9) إضافة نوع refund للمعاملات ============
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_type_check
  CHECK (type IN ('sale', 'commission', 'withdrawal', 'refund'));

-- ===================================================================
-- نهاية الملف — يُشغَّل في Supabase SQL Editor
-- ===================================================================
