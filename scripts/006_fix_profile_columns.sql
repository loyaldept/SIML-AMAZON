-- Add all missing profile columns that settings/onboarding write to
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS timezone text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS language text DEFAULT 'en';

-- Make sure listings and inventory have all needed columns
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS image_url text;

-- Update the profile trigger to include full_name
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, full_name, business_name)
  VALUES (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', null),
    coalesce(new.raw_user_meta_data ->> 'full_name', null),
    null
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;
