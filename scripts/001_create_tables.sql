-- Profiles table
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text default '',
  email text default '',
  company text default '',
  phone text default '',
  language text default 'en',
  notifications_enabled boolean default true,
  dark_mode boolean default false,
  auto_sync boolean default true,
  onboarded boolean default false,
  preferences jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.profiles enable row level security;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

-- Channel connections
create table if not exists public.channel_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  channel text not null,
  status text not null default 'disconnected',
  store_name text default '',
  connected_at timestamptz,
  created_at timestamptz default now()
);
alter table public.channel_connections enable row level security;
create policy "channels_select_own" on public.channel_connections for select using (auth.uid() = user_id);
create policy "channels_insert_own" on public.channel_connections for insert with check (auth.uid() = user_id);
create policy "channels_update_own" on public.channel_connections for update using (auth.uid() = user_id);
create policy "channels_delete_own" on public.channel_connections for delete using (auth.uid() = user_id);

-- Inventory
create table if not exists public.inventory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sku text not null,
  asin text default '',
  title text not null,
  image_url text default '',
  quantity integer default 0,
  price numeric(10,2) default 0,
  cost numeric(10,2) default 0,
  channel text default 'Amazon',
  status text default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.inventory enable row level security;
create policy "inventory_select_own" on public.inventory for select using (auth.uid() = user_id);
create policy "inventory_insert_own" on public.inventory for insert with check (auth.uid() = user_id);
create policy "inventory_update_own" on public.inventory for update using (auth.uid() = user_id);
create policy "inventory_delete_own" on public.inventory for delete using (auth.uid() = user_id);

-- Listings (when user lists a product)
create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  asin text default '',
  sku text not null,
  price numeric(10,2) default 0,
  quantity integer default 1,
  condition text default 'new',
  channels text[] default '{}',
  status text default 'pending',
  progress integer default 0,
  created_at timestamptz default now()
);
alter table public.listings enable row level security;
create policy "listings_select_own" on public.listings for select using (auth.uid() = user_id);
create policy "listings_insert_own" on public.listings for insert with check (auth.uid() = user_id);
create policy "listings_update_own" on public.listings for update using (auth.uid() = user_id);
create policy "listings_delete_own" on public.listings for delete using (auth.uid() = user_id);

-- Notifications
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  message text not null,
  type text default 'info',
  read boolean default false,
  created_at timestamptz default now()
);
alter table public.notifications enable row level security;
create policy "notifications_select_own" on public.notifications for select using (auth.uid() = user_id);
create policy "notifications_insert_own" on public.notifications for insert with check (auth.uid() = user_id);
create policy "notifications_update_own" on public.notifications for update using (auth.uid() = user_id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.email, '')
  )
  on conflict (id) do nothing;

  -- Create default channel connections
  insert into public.channel_connections (user_id, channel, status) values
    (new.id, 'Amazon', 'disconnected'),
    (new.id, 'eBay', 'disconnected'),
    (new.id, 'Shopify', 'disconnected');

  -- Create welcome notification
  insert into public.notifications (user_id, title, message, type) values
    (new.id, 'Welcome to Siml!', 'Your account is ready. Connect your selling channels to get started.', 'info');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
