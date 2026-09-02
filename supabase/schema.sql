-- 5areta Supabase schema
-- Run this once in Supabase SQL Editor.

create table if not exists public.authorized_devices (
  user_id uuid primary key references auth.users(id) on delete cascade,
  approved_at timestamptz not null default now()
);

create table if not exists public.device_pin_attempts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  attempts integer not null default 0,
  window_started_at timestamptz not null default now()
);

create table if not exists public.shop_access_config (
  id smallint primary key check (id = 1),
  pin_hash text not null,
  updated_at timestamptz not null default now()
);

-- Set pin_hash securely in the connected Supabase project. Never commit the plaintext PIN.

create table if not exists public.app_settings (
  id smallint primary key default 1 check (id = 1),
  opening_vault numeric(14,2) not null default 0,
  low_stock_threshold integer not null default 3,
  updated_at timestamptz not null default now()
);
insert into public.app_settings(id) values (1) on conflict (id) do nothing;

create table if not exists public.days (
  id text primary key,
  date date not null,
  customers integer not null default 0 check (customers >= 0),
  revenue numeric(14,2) not null default 0 check (revenue >= 0),
  operating numeric(14,2) not null default 0 check (operating >= 0),
  worker numeric(14,2) not null default 0 check (worker >= 0),
  personal numeric(14,2) not null default 0 check (personal >= 0),
  notes text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.withdrawals (
  id text primary key,
  date date not null,
  amount numeric(14,2) not null check (amount > 0),
  reason text not null,
  notes text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id text primary key,
  name text not null,
  quantity integer not null default 0 check (quantity >= 0),
  current_cost numeric(14,2) not null default 0 check (current_cost >= 0),
  selling_price numeric(14,2) not null default 0 check (selling_price >= 0),
  image_path text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory_movements (
  id text primary key,
  product_id text not null references public.products(id) on delete cascade,
  type text not null check (type in ('purchase','sale','consumption')),
  date date not null,
  quantity integer not null check (quantity > 0),
  unit_cost numeric(14,2) not null default 0,
  unit_price numeric(14,2),
  total_cost numeric(14,2) not null default 0,
  revenue numeric(14,2),
  profit numeric(14,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_meta (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.authorized_devices enable row level security;
alter table public.device_pin_attempts enable row level security;
alter table public.app_settings enable row level security;
alter table public.days enable row level security;
alter table public.withdrawals enable row level security;
alter table public.products enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.app_meta enable row level security;

create or replace function public.verify_shop_pin(candidate text)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $
  select exists (
    select 1 from public.shop_access_config c
    where c.id = 1
      and extensions.crypt(candidate, c.pin_hash) = c.pin_hash
  );
$;

create or replace function public.is_authorized_device()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.authorized_devices d
    where d.user_id = auth.uid()
  );
$$;

revoke all on function public.is_authorized_device() from public;
grant execute on function public.is_authorized_device() to authenticated;

drop policy if exists "device can read own approval" on public.authorized_devices;
create policy "device can read own approval"
on public.authorized_devices for select
to authenticated
using (user_id = auth.uid());

-- No client write policy on authorized_devices or device_pin_attempts.
-- The Edge Function uses service-role access for those tables.

do $$
declare
  t text;
begin
  foreach t in array array['app_settings','days','withdrawals','products','inventory_movements','app_meta']
  loop
    execute format('drop policy if exists "authorized devices read %I" on public.%I', t, t);
    execute format('drop policy if exists "authorized devices insert %I" on public.%I', t, t);
    execute format('drop policy if exists "authorized devices update %I" on public.%I', t, t);
    execute format('drop policy if exists "authorized devices delete %I" on public.%I', t, t);

    execute format('create policy "authorized devices read %I" on public.%I for select to authenticated using (public.is_authorized_device())', t, t);
    execute format('create policy "authorized devices insert %I" on public.%I for insert to authenticated with check (public.is_authorized_device())', t, t);
    execute format('create policy "authorized devices update %I" on public.%I for update to authenticated using (public.is_authorized_device()) with check (public.is_authorized_device())', t, t);
    execute format('create policy "authorized devices delete %I" on public.%I for delete to authenticated using (public.is_authorized_device())', t, t);
  end loop;
end $$;

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', false)
on conflict (id) do update set public = excluded.public;

drop policy if exists "authorized devices read product images" on storage.objects;
create policy "authorized devices read product images"
on storage.objects for select
to authenticated
using (bucket_id = 'product-images' and public.is_authorized_device());

drop policy if exists "authorized devices upload product images" on storage.objects;
create policy "authorized devices upload product images"
on storage.objects for insert
to authenticated
with check (bucket_id = 'product-images' and public.is_authorized_device());

drop policy if exists "authorized devices update product images" on storage.objects;
create policy "authorized devices update product images"
on storage.objects for update
to authenticated
using (bucket_id = 'product-images' and public.is_authorized_device())
with check (bucket_id = 'product-images' and public.is_authorized_device());

drop policy if exists "authorized devices delete product images" on storage.objects;
create policy "authorized devices delete product images"
on storage.objects for delete
to authenticated
using (bucket_id = 'product-images' and public.is_authorized_device());

grant usage on schema public to authenticated;
grant select on public.authorized_devices to authenticated;
grant select, insert, update, delete on public.app_settings, public.days, public.withdrawals, public.products, public.inventory_movements, public.app_meta to authenticated;
