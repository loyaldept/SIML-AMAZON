-- Fix unique constraint for channel_connections upsert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'idx_channel_connections_user_channel'
  ) THEN
    CREATE UNIQUE INDEX idx_channel_connections_user_channel ON channel_connections(user_id, channel);
  END IF;
END $$;

-- Fix unique constraint for inventory upsert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'idx_inventory_user_asin'
  ) THEN
    CREATE UNIQUE INDEX idx_inventory_user_asin ON inventory(user_id, asin);
  END IF;
END $$;

-- Fix unique constraint for orders upsert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'idx_orders_user_amazon_order'
  ) THEN
    CREATE UNIQUE INDEX idx_orders_user_amazon_order ON orders(user_id, amazon_order_id);
  END IF;
END $$;

-- Fix profiles: ensure update policy exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'profiles_update_own' AND tablename = 'profiles'
  ) THEN
    CREATE POLICY profiles_update_own ON profiles FOR UPDATE USING (auth.uid() = id);
  END IF;
END $$;

-- Fix profiles: ensure delete policy exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'profiles_delete_own' AND tablename = 'profiles'
  ) THEN
    CREATE POLICY profiles_delete_own ON profiles FOR DELETE USING (auth.uid() = id);
  END IF;
END $$;

-- Recreate the profile trigger to make sure it works
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, first_name, email, onboarding_complete)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(new.raw_user_meta_data ->> 'first_name', ''),
    new.email,
    false
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Also add a notifications delete policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'notifications_delete_own' AND tablename = 'notifications'
  ) THEN
    CREATE POLICY notifications_delete_own ON notifications FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;
