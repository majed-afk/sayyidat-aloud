-- ============================================================
-- 13_support_tickets.sql — نظام تذاكر الدعم الفني — صيدات العود
-- ============================================================

-- ===== القسم 1: جدول التذاكر =====
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_number TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN (
    'order_issue', 'payment_issue', 'product_complaint',
    'account_issue', 'technical_issue', 'other'
  )),
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  order_id TEXT REFERENCES orders(id),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN (
    'open', 'in_progress', 'resolved', 'closed'
  )),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN (
    'low', 'normal', 'high', 'urgent'
  )),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- ===== القسم 2: جدول رسائل التذاكر =====
CREATE TABLE IF NOT EXISTS ticket_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_admin BOOLEAN DEFAULT FALSE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== القسم 3: الفهارس =====
CREATE INDEX IF NOT EXISTS idx_tickets_user ON support_tickets(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON support_tickets(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_number ON support_tickets(ticket_number);
CREATE INDEX IF NOT EXISTS idx_ticket_msgs_ticket ON ticket_messages(ticket_id, created_at);

-- ===== القسم 4: تفعيل RLS =====
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_messages ENABLE ROW LEVEL SECURITY;

-- ===== القسم 5: سياسات التذاكر =====

-- القراءة: المستخدم يرى تذاكره فقط، الأدمن يرى الكل
DROP POLICY IF EXISTS "tickets_select" ON support_tickets;
CREATE POLICY "tickets_select" ON support_tickets
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- الإنشاء: المستخدم ينشئ تذكرة لنفسه فقط
DROP POLICY IF EXISTS "tickets_insert" ON support_tickets;
CREATE POLICY "tickets_insert" ON support_tickets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- التحديث: المستخدم يحدث تذاكره، الأدمن يحدث أي تذكرة
DROP POLICY IF EXISTS "tickets_update" ON support_tickets;
CREATE POLICY "tickets_update" ON support_tickets
  FOR UPDATE USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ===== القسم 6: سياسات الرسائل =====

-- القراءة: عبر ملكية التذكرة الأب
DROP POLICY IF EXISTS "ticket_msgs_select" ON ticket_messages;
CREATE POLICY "ticket_msgs_select" ON ticket_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM support_tickets
      WHERE support_tickets.id = ticket_messages.ticket_id
      AND (support_tickets.user_id = auth.uid()
           OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
    )
  );

-- الإنشاء: المرسل هو المستخدم الحالي + يملك التذكرة أو أدمن
DROP POLICY IF EXISTS "ticket_msgs_insert" ON ticket_messages;
CREATE POLICY "ticket_msgs_insert" ON ticket_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM support_tickets
      WHERE support_tickets.id = ticket_messages.ticket_id
      AND (support_tickets.user_id = auth.uid()
           OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
    )
  );

-- ===== القسم 7: Trigger تحديث updated_at =====
CREATE OR REPLACE FUNCTION update_ticket_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ticket_updated ON support_tickets;
CREATE TRIGGER trg_ticket_updated
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION update_ticket_timestamp();

-- ===== القسم 8: رسالة نجاح =====
DO $$ BEGIN RAISE NOTICE '13_support_tickets applied successfully!'; END $$;
SELECT '13_support_tickets applied successfully!' AS status;
