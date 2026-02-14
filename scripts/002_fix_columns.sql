-- Add missing columns and fix naming issues

-- Add onboarding_complete to profiles (rename onboarded)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_complete boolean default false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS business_name text default '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS business_type text default '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS first_name text default '';

-- Update onboarding_complete from onboarded if it exists
UPDATE public.profiles SET onboarding_complete = onboarded WHERE onboarded IS NOT NULL;

-- Add channel column to listings (single channel per listing row)
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS channel text default 'Amazon';
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS image_url text default '';

-- Add credentials to channel_connections
ALTER TABLE public.channel_connections ADD COLUMN IF NOT EXISTS credentials jsonb default '{}';

-- Add unique constraint for inventory upsert
DO $$ BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS inventory_user_asin_idx ON public.inventory (user_id, asin);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Add unique constraint for channel_connections upsert
DO $$ BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS channel_connections_user_channel_idx ON public.channel_connections (user_id, channel);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
