-- ===== صيدات العود — Supabase Database Schema =====
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- ===== 1. PROFILES (بيانات المستخدمين) =====
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  role TEXT NOT NULL DEFAULT 'seller' CHECK (role IN ('seller', 'admin')),
  verified BOOLEAN DEFAULT FALSE,
  suspended BOOLEAN DEFAULT FALSE,
  store_name TEXT DEFAULT '',
  store_desc TEXT DEFAULT '',
  bank_name TEXT DEFAULT '',
  iban TEXT DEFAULT '',
  bank_holder TEXT DEFAULT '',
  balance NUMERIC(12,2) DEFAULT 0,
  total_sales INTEGER DEFAULT 0,
  total_revenue NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== 2. PRODUCTS (المنتجات) =====
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  listing_type TEXT NOT NULL DEFAULT 'market' CHECK (listing_type IN ('market', 'auction')),
  category TEXT NOT NULL,
  type TEXT NOT NULL,
  origin TEXT NOT NULL,
  weight NUMERIC(10,2) DEFAULT 0,
  unit TEXT DEFAULT 'جرام',
  price NUMERIC(12,2) DEFAULT 0,
  stock INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  image_url TEXT DEFAULT '',
  description TEXT DEFAULT '',
  -- Auction fields
  auction_type TEXT CHECK (auction_type IN ('timed', 'until_sold')),
  auction_status TEXT DEFAULT 'draft' CHECK (auction_status IN ('draft', 'live', 'ended', 'sold')),
  start_price NUMERIC(12,2),
  min_bid NUMERIC(12,2),
  auction_duration INTEGER,
  buy_now NUMERIC(12,2),
  auction_start_date TIMESTAMPTZ,
  auction_end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== 3. BIDS (المزايدات) =====
CREATE TABLE bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  bidder_name TEXT NOT NULL,
  bidder_id UUID REFERENCES profiles(id),
  amount NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== 4. ORDERS (الطلبات) =====
CREATE TABLE orders (
  id TEXT PRIMARY KEY, -- e.g., SA-847291
  seller_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  product_name TEXT NOT NULL,
  buyer_name TEXT NOT NULL,
  buyer_phone TEXT NOT NULL,
  buyer_city TEXT NOT NULL,
  buyer_district TEXT DEFAULT '',
  buyer_street TEXT DEFAULT '',
  qty INTEGER NOT NULL DEFAULT 1,
  price NUMERIC(12,2) NOT NULL,
  total NUMERIC(12,2) NOT NULL,
  shipping NUMERIC(12,2) DEFAULT 0,
  shipping_method TEXT DEFAULT 'عادي',
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'processing', 'completed', 'cancelled')),
  -- Shipping / Waybill
  carrier TEXT DEFAULT '',
  carrier_name TEXT DEFAULT '',
  tracking_number TEXT DEFAULT '',
  waybill_generated BOOLEAN DEFAULT FALSE,
  waybill_date DATE,
  cancel_reason TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== 5. ORDER STATUS HISTORY (سجل حالة الطلب) =====
CREATE TABLE order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  note TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== 6. TRANSACTIONS (المعاملات المالية) =====
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('sale', 'commission', 'withdrawal')),
  amount NUMERIC(12,2) NOT NULL,
  ref TEXT DEFAULT '',
  status TEXT DEFAULT 'completed',
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== 7. MONTHLY SALES (المبيعات الشهرية) =====
CREATE TABLE monthly_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  amount NUMERIC(12,2) DEFAULT 0,
  UNIQUE(seller_id, month)
);

-- ===== 8. ADMIN SETTINGS (إعدادات الأدمن) =====
CREATE TABLE admin_settings (
  key TEXT PRIMARY KEY,
  value TEXT DEFAULT ''
);

-- ===== INDEXES =====
CREATE INDEX idx_products_seller ON products(seller_id);
CREATE INDEX idx_products_active ON products(active) WHERE active = TRUE;
CREATE INDEX idx_products_listing ON products(listing_type);
CREATE INDEX idx_orders_seller ON orders(seller_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_transactions_seller ON transactions(seller_id);
CREATE INDEX idx_bids_product ON bids(product_id);
CREATE INDEX idx_order_history ON order_status_history(order_id);

-- ===== AUTO-CREATE PROFILE ON SIGNUP =====
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, first_name, last_name, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'seller')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
