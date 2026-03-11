-- 18_launch_fixes.sql — إصلاحات ما قبل الإطلاق — صيدات العود
-- تاريخ: 2026-03-11


-- ===== 1. View آمن للبروفايلات العامة (إخفاء بيانات البنك) =====
-- الـ JS يمكنه استخدام profiles_public للصفحات العامة (market, product)
-- البروفايل الكامل (مع بيانات البنك) يُجلب فقط لصاحب الحساب

CREATE OR REPLACE VIEW public.profiles_public AS
SELECT id, first_name, last_name, phone, role, verified,
       seller_verified, merchant_verified, store_name, store_desc,
       completed_auctions, total_sales, suspended, created_at
FROM profiles;


-- ===== 2. تقييد ORDER_STATUS_HISTORY INSERT =====
-- المشكلة: السياسة الحالية تسمح لأي مستخدم مسجّل بإضافة history لأي طلب
-- الحل: تقييد للبائع أو المشتري صاحب الطلب أو الأدمن

DROP POLICY IF EXISTS "order_history_insert" ON order_status_history;

CREATE POLICY "order_history_insert_restricted" ON order_status_history
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_id
      AND (orders.seller_id = auth.uid() OR orders.buyer_id = auth.uid())
    )
    OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );


-- ===== 3. إضافة FK على disputes.order_id =====
-- المشكلة: disputes.order_id ليس له FOREIGN KEY → إمكانية disputes يتيمة

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_disputes_order'
    AND table_name = 'disputes'
  ) THEN
    ALTER TABLE disputes
      ADD CONSTRAINT fk_disputes_order
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
  END IF;
END $$;


-- ===== 4. حد زمني server-side لسحب المزايدة (5 دقائق) =====
-- المشكلة: الحد الزمني يُفحص فقط client-side في bids.js
-- الحل: إضافة فحص NOW() - created_at في trigger

CREATE OR REPLACE FUNCTION protect_bid_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- منع تعديل الحقول الثابتة
  IF NEW.amount != OLD.amount THEN
    RAISE EXCEPTION 'لا يمكن تعديل مبلغ المزايدة بعد الإدراج';
  END IF;
  IF NEW.product_id != OLD.product_id THEN
    RAISE EXCEPTION 'لا يمكن تغيير المنتج';
  END IF;
  IF NEW.bidder_id != OLD.bidder_id THEN
    RAISE EXCEPTION 'لا يمكن تغيير المزايد';
  END IF;
  IF NEW.created_at != OLD.created_at THEN
    RAISE EXCEPTION 'لا يمكن تعديل تاريخ المزايدة';
  END IF;

  -- منع الانتقالات غير المسموحة للحالة
  IF NEW.status != OLD.status THEN
    -- الانتقال الوحيد المسموح: active → retracted
    IF NOT (OLD.status = 'active' AND NEW.status = 'retracted') THEN
      RAISE EXCEPTION 'انتقال حالة غير مسموح: % → %', OLD.status, NEW.status;
    END IF;

    -- ★ حد 5 دقائق server-side للتراجع
    IF (NOW() - OLD.created_at) > INTERVAL '5 minutes' THEN
      RAISE EXCEPTION 'انتهت مهلة سحب المزايدة (5 دقائق)';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ===== 5. فهارس أداء مفقودة =====

CREATE INDEX IF NOT EXISTS idx_products_seller_id ON products(seller_id);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_status ON orders(buyer_id, status);
CREATE INDEX IF NOT EXISTS idx_bids_bidder_id ON bids(bidder_id);
