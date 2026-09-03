-- 5areta Supabase schema
-- Production model: existing approved anonymous-device sessions + RLS.
-- There is no shop PIN or automatic device self-authorization flow.

create table if not exists public.authorized_devices (
  user_id uuid primary key references auth.users(id) on delete cascade,
  approved_at timestamptz not null default now()
);

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

create unique index if not exists days_unique_date_idx on public.days(date);

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
  archived boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.products
  add column if not exists archived boolean not null default false,
  add column if not exists archived_at timestamptz;

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
  canceled boolean not null default false,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.inventory_movements
  add column if not exists canceled boolean not null default false,
  add column if not exists canceled_at timestamptz;

create index if not exists inventory_movements_product_id_idx on public.inventory_movements(product_id);
create index if not exists products_archived_idx on public.products(archived);
create index if not exists inventory_movements_canceled_idx on public.inventory_movements(canceled);

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
revoke execute on function public.is_authorized_device() from anon;
grant execute on function public.is_authorized_device() to authenticated;

alter table public.authorized_devices enable row level security;
alter table public.app_settings enable row level security;
alter table public.days enable row level security;
alter table public.withdrawals enable row level security;
alter table public.products enable row level security;
alter table public.inventory_movements enable row level security;

drop policy if exists "device can read own approval" on public.authorized_devices;
create policy "device can read own approval"
on public.authorized_devices for select
to authenticated
using (user_id = (select auth.uid()));

do $$
declare
  t text;
begin
  foreach t in array array['app_settings','days','withdrawals','products','inventory_movements']
  loop
    execute format('drop policy if exists "authorized device access" on public.%I', t);
    execute format('drop policy if exists "authorized devices read %I" on public.%I', t, t);
    execute format('drop policy if exists "authorized devices insert %I" on public.%I', t, t);
    execute format('drop policy if exists "authorized devices update %I" on public.%I', t, t);
    execute format('drop policy if exists "authorized devices delete %I" on public.%I', t, t);

    execute format(
      'create policy "authorized device access" on public.%I for all to authenticated using (public.is_authorized_device()) with check (public.is_authorized_device())',
      t
    );
  end loop;
end $$;

grant usage on schema public to authenticated;
grant select on public.authorized_devices to authenticated;
grant select, insert, update, delete on public.app_settings, public.days, public.withdrawals, public.products, public.inventory_movements to authenticated;

create or replace function public.cancel_inventory_movement(p_movement_id text)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  m public.inventory_movements%rowtype;
  p public.products%rowtype;
  v_latest_cost numeric := 0;
  v_canceled_at timestamptz := now();
begin
  select * into m from public.inventory_movements where id = p_movement_id for update;
  if not found then raise exception 'movement_not_found' using errcode = 'P0001'; end if;

  if m.canceled then
    select * into p from public.products where id = m.product_id;
    return jsonb_build_object('ok', true, 'already_canceled', true, 'movement_id', m.id, 'product_id', m.product_id, 'quantity', coalesce(p.quantity, 0), 'current_cost', coalesce(p.current_cost, 0), 'canceled_at', m.canceled_at);
  end if;

  select * into p from public.products where id = m.product_id for update;
  if not found then raise exception 'product_not_found' using errcode = 'P0001'; end if;

  if m.type = 'purchase' then
    if p.quantity < m.quantity then raise exception 'purchase_quantity_already_used' using errcode = 'P0001'; end if;
    update public.products set quantity = quantity - m.quantity, updated_at = now() where id = p.id;
  elsif m.type in ('sale','consumption') then
    update public.products set quantity = quantity + m.quantity, updated_at = now() where id = p.id;
  else
    raise exception 'unsupported_movement_type' using errcode = 'P0001';
  end if;

  update public.inventory_movements set canceled = true, canceled_at = v_canceled_at, updated_at = now() where id = m.id;

  if m.type = 'purchase' then
    select im.unit_cost into v_latest_cost
    from public.inventory_movements im
    where im.product_id = m.product_id and im.type = 'purchase' and im.canceled = false and im.id <> m.id
    order by im.date desc, im.created_at desc
    limit 1;
    update public.products set current_cost = coalesce(v_latest_cost, 0), updated_at = now() where id = m.product_id;
  end if;

  select * into p from public.products where id = m.product_id;
  return jsonb_build_object('ok', true, 'already_canceled', false, 'movement_id', m.id, 'product_id', m.product_id, 'quantity', p.quantity, 'current_cost', p.current_cost, 'canceled_at', v_canceled_at);
end;
$$;

revoke execute on function public.cancel_inventory_movement(text) from public, anon;
grant execute on function public.cancel_inventory_movement(text) to authenticated;

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', false)
on conflict (id) do update set public = excluded.public;

drop policy if exists "authorized devices read product images" on storage.objects;
create policy "authorized devices read product images"
on storage.objects for select to authenticated
using (bucket_id = 'product-images' and public.is_authorized_device());

drop policy if exists "authorized devices upload product images" on storage.objects;
create policy "authorized devices upload product images"
on storage.objects for insert to authenticated
with check (bucket_id = 'product-images' and public.is_authorized_device());

drop policy if exists "authorized devices update product images" on storage.objects;
create policy "authorized devices update product images"
on storage.objects for update to authenticated
using (bucket_id = 'product-images' and public.is_authorized_device())
with check (bucket_id = 'product-images' and public.is_authorized_device());

drop policy if exists "authorized devices delete product images" on storage.objects;
create policy "authorized devices delete product images"
on storage.objects for delete to authenticated
using (bucket_id = 'product-images' and public.is_authorized_device());