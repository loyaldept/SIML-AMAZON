-- Add Amazon SP-API token storage to channel_connections
ALTER TABLE channel_connections ADD COLUMN IF NOT EXISTS access_token text;
ALTER TABLE channel_connections ADD COLUMN IF NOT EXISTS refresh_token text;
ALTER TABLE channel_connections ADD COLUMN IF NOT EXISTS token_expires_at timestamptz;
ALTER TABLE channel_connections ADD COLUMN IF NOT EXISTS seller_id text;
ALTER TABLE channel_connections ADD COLUMN IF NOT EXISTS marketplace_id text DEFAULT 'ATVPDKIKX0DER';

-- Add orders table for Amazon order tracking
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amazon_order_id text,
  status text DEFAULT 'pending',
  order_total numeric(10,2) DEFAULT 0,
  currency text DEFAULT 'USD',
  items_count int DEFAULT 0,
  buyer_email text,
  channel text DEFAULT 'Amazon',
  purchase_date timestamptz,
  last_update_date timestamptz,
  shipping_address jsonb,
  order_items jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders_select_own" ON orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "orders_insert_own" ON orders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "orders_update_own" ON orders FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "orders_delete_own" ON orders FOR DELETE USING (auth.uid() = user_id);

-- Add financial_events table
CREATE TABLE IF NOT EXISTS financial_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_group_id text,
  event_type text,
  amount numeric(10,2) DEFAULT 0,
  currency text DEFAULT 'USD',
  description text,
  posted_date timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE financial_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "financial_events_select_own" ON financial_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "financial_events_insert_own" ON financial_events FOR INSERT WITH CHECK (auth.uid() = user_id);
