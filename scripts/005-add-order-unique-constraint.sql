-- Add unique constraint on (user_id, amazon_order_id) for orders upsert
-- First, make sure there are no duplicates
DELETE FROM orders a USING orders b
WHERE a.id > b.id
  AND a.user_id = b.user_id
  AND a.amazon_order_id = b.amazon_order_id
  AND a.amazon_order_id IS NOT NULL;

-- Add the unique constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_user_id_amazon_order_id_key'
  ) THEN
    ALTER TABLE orders ADD CONSTRAINT orders_user_id_amazon_order_id_key UNIQUE (user_id, amazon_order_id);
  END IF;
END $$;

-- Add warehouse and fulfillment_channel columns to inventory if not exists
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS warehouse text;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS fulfillment_channel text;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS fnsku text;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS condition text;
