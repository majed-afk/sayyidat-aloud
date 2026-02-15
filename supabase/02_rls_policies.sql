-- ===== Row Level Security — صيدات العود =====
-- Run this AFTER 01_tables.sql

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;

-- ===== PROFILES =====
-- Everyone can read profiles (for store display)
CREATE POLICY "profiles_select_all" ON profiles
  FOR SELECT USING (true);

-- Users can update their own profile
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Admin can update any profile
CREATE POLICY "profiles_update_admin" ON profiles
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Admin can delete profiles
CREATE POLICY "profiles_delete_admin" ON profiles
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ===== PRODUCTS =====
-- Everyone can read active products (for marketplace)
CREATE POLICY "products_select_all" ON products
  FOR SELECT USING (true);

-- Sellers can insert their own products
CREATE POLICY "products_insert_own" ON products
  FOR INSERT WITH CHECK (auth.uid() = seller_id);

-- Sellers can update their own products
CREATE POLICY "products_update_own" ON products
  FOR UPDATE USING (auth.uid() = seller_id);

-- Sellers can delete their own products
CREATE POLICY "products_delete_own" ON products
  FOR DELETE USING (auth.uid() = seller_id);

-- Admin can manage all products
CREATE POLICY "products_admin_all" ON products
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ===== BIDS =====
-- Everyone can read bids (for auction display)
CREATE POLICY "bids_select_all" ON bids
  FOR SELECT USING (true);

-- Authenticated users can place bids
CREATE POLICY "bids_insert_auth" ON bids
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ===== ORDERS =====
-- Sellers can read their own orders
CREATE POLICY "orders_select_own" ON orders
  FOR SELECT USING (auth.uid() = seller_id);

-- Sellers can update their own orders
CREATE POLICY "orders_update_own" ON orders
  FOR UPDATE USING (auth.uid() = seller_id);

-- Authenticated users can create orders (buyers)
CREATE POLICY "orders_insert_auth" ON orders
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Admin can see all orders
CREATE POLICY "orders_admin_all" ON orders
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ===== ORDER STATUS HISTORY =====
CREATE POLICY "order_history_select" ON order_status_history
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM orders WHERE orders.id = order_status_history.order_id AND orders.seller_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "order_history_insert" ON order_status_history
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ===== TRANSACTIONS =====
-- Sellers can read their own transactions
CREATE POLICY "transactions_select_own" ON transactions
  FOR SELECT USING (auth.uid() = seller_id);

-- System/admin can insert transactions
CREATE POLICY "transactions_insert" ON transactions
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Admin can see all transactions
CREATE POLICY "transactions_admin_select" ON transactions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ===== MONTHLY SALES =====
CREATE POLICY "monthly_sales_select_own" ON monthly_sales
  FOR SELECT USING (auth.uid() = seller_id);

CREATE POLICY "monthly_sales_manage_own" ON monthly_sales
  FOR ALL USING (auth.uid() = seller_id);

CREATE POLICY "monthly_sales_admin" ON monthly_sales
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ===== ADMIN SETTINGS =====
CREATE POLICY "admin_settings_select_all" ON admin_settings
  FOR SELECT USING (true);

CREATE POLICY "admin_settings_manage" ON admin_settings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
