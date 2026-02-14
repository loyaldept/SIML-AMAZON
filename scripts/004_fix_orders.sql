-- Fix orders table columns and add unique constraint
ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_amount numeric(10,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS raw_data jsonb;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_date timestamptz;

-- Add unique constraint for upsert
CREATE UNIQUE INDEX IF NOT EXISTS orders_user_amazon_order_idx ON orders (user_id, amazon_order_id);

-- Add connected boolean to channel_connections if missing
ALTER TABLE channel_connections ADD COLUMN IF NOT EXISTS connected boolean DEFAULT false;
