-- Run this entire file in Supabase SQL Editor. Safe to run multiple times (idempotent).

-- ========== TABLES ==========
create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  sort_order int,
  photo_url text,
  created_at timestamptz default now()
);

create table if not exists public.bins (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  location_id uuid references public.locations(id) on delete set null,
  photo_url text,
  qr_code_id uuid,
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.item_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  description text,
  photo_url text,
  default_bin_id uuid references public.bins(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  item_group_id uuid references public.item_groups(id) on delete cascade,
  bin_id uuid references public.bins(id) on delete set null,
  location_id uuid references public.locations(id) on delete set null,
  quantity_on_hand numeric(10,2) not null default 0,
  unit text default 'pcs',
  low_stock_threshold numeric(10,2),
  expiry_date timestamptz,
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.qr_codes (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  type text not null check (type in ('bin', 'item_group')),
  target_id uuid not null,
  created_at timestamptz default now()
);

create table if not exists public.checkouts (
  id uuid primary key default gen_random_uuid(),
  checkout_batch_id uuid,
  item_id uuid references public.items(id) on delete set null,
  bin_id uuid references public.bins(id) on delete set null,
  borrower_name text not null,
  borrower_type text,
  club_name text,
  event_name text,
  quantity numeric(10,2),
  checked_out_at timestamptz default now(),
  due_back_at timestamptz,
  checked_in_at timestamptz,
  issue_type text check (issue_type in ('lost', 'broken')),
  status text not null default 'checked_out' check (status in ('checked_out', 'returned', 'lost')),
  issue_resolved boolean not null default false,
  notes text
);

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references public.items(id) on delete set null,
  bin_id uuid references public.bins(id) on delete set null,
  borrower_name text not null,
  club_name text,
  event_name text,
  quantity numeric(10,2),
  start_at timestamptz not null,
  end_at timestamptz,
  status text not null default 'planned' check (status in ('planned', 'confirmed', 'cancelled', 'fulfilled')),
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'staff' check (role in ('admin', 'staff', 'viewer')),
  created_at timestamptz default now()
);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb,
  created_at timestamptz default now()
);

create table if not exists public.club_requests (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references public.items(id) on delete set null,
  custom_item_name text,
  requested_quantity numeric(10,2) not null,
  product_url text,
  requester_name text not null,
  club_name text not null,
  level text check (level in ('UG','PG')),
  will_collect_self boolean,
  collector_name text,
  collector_email text,
  pickup_at timestamptz,
  dropoff_at timestamptz,
  responsibility_confirmed boolean not null default false,
  status text not null default 'open'
    check (status in ('open','approved','ordered','fulfilled','resolved')),
  seen boolean not null default false,
  created_at timestamptz default now()
);

-- ========== INDEXES ==========
create index if not exists idx_item_groups_name on public.item_groups using gin (to_tsvector('english', name));
create index if not exists idx_items_notes on public.items using gin (to_tsvector('english', coalesce(notes, '')));
create index if not exists idx_bins_label on public.bins (label);
create index if not exists idx_locations_name on public.locations (name);

-- Backfill schema for existing projects
alter table public.items
  add column if not exists location_id uuid references public.locations(id) on delete set null;

alter table public.items
  add column if not exists expiry_date timestamptz;

-- ========== VIEWS ==========
create or replace view public.v_items_with_status as
select
  i.id,
  ig.name as item_group_name,
  b.label as bin_label,
  coalesce(li.name, lb.name) as location_name,
  i.quantity_on_hand,
  i.unit,
  i.low_stock_threshold,
  i.expiry_date,
  exists (
    select 1 from public.checkouts c
    where c.item_id = i.id and c.status = 'checked_out'
  ) as is_checked_out
from public.items i
left join public.item_groups ig on ig.id = i.item_group_id
left join public.bins b on b.id = i.bin_id
left join public.locations li on li.id = i.location_id
left join public.locations lb on lb.id = b.location_id;

create or replace view public.v_low_stock_items as
select *
from public.v_items_with_status
where low_stock_threshold is not null
  and quantity_on_hand <= low_stock_threshold;

-- ========== RLS ==========
alter table public.locations enable row level security;
alter table public.bins enable row level security;
alter table public.item_groups enable row level security;
alter table public.items enable row level security;
alter table public.checkouts enable row level security;
alter table public.reservations enable row level security;
alter table public.club_requests enable row level security;
alter table public.qr_codes enable row level security;
alter table public.activity_logs enable row level security;
alter table public.profiles enable row level security;

-- ========== DROP EXISTING POLICIES (so this script can be re-run) ==========
drop policy if exists "authenticated_select_locations" on public.locations;
drop policy if exists "authenticated_write_locations" on public.locations;
drop policy if exists "anon_all_locations" on public.locations;

drop policy if exists "authenticated_select_bins" on public.bins;
drop policy if exists "authenticated_write_bins" on public.bins;
drop policy if exists "anon_all_bins" on public.bins;

drop policy if exists "authenticated_select_item_groups" on public.item_groups;
drop policy if exists "authenticated_write_item_groups" on public.item_groups;
drop policy if exists "anon_all_item_groups" on public.item_groups;

drop policy if exists "authenticated_select_items" on public.items;
drop policy if exists "authenticated_write_items" on public.items;
drop policy if exists "anon_all_items" on public.items;

drop policy if exists "authenticated_select_checkouts" on public.checkouts;
drop policy if exists "authenticated_write_checkouts" on public.checkouts;
drop policy if exists "anon_all_checkouts" on public.checkouts;

drop policy if exists "authenticated_select_reservations" on public.reservations;
drop policy if exists "authenticated_write_reservations" on public.reservations;
drop policy if exists "anon_all_reservations" on public.reservations;

drop policy if exists "authenticated_select_qr_codes" on public.qr_codes;
drop policy if exists "authenticated_write_qr_codes" on public.qr_codes;
drop policy if exists "anon_all_qr_codes" on public.qr_codes;

drop policy if exists "authenticated_select_activity_logs" on public.activity_logs;
drop policy if exists "authenticated_write_activity_logs" on public.activity_logs;
drop policy if exists "anon_all_activity_logs" on public.activity_logs;

drop policy if exists "anon_all_club_requests" on public.club_requests;

drop policy if exists "select_own_profile" on public.profiles;
drop policy if exists "update_own_profile" on public.profiles;

-- ========== PUBLIC ACCESS POLICIES (no login required) ==========
create policy "anon_all_locations" on public.locations for all using (true) with check (true);
create policy "anon_all_bins" on public.bins for all using (true) with check (true);
create policy "anon_all_item_groups" on public.item_groups for all using (true) with check (true);
create policy "anon_all_items" on public.items for all using (true) with check (true);
create policy "anon_all_checkouts" on public.checkouts for all using (true) with check (true);
create policy "anon_all_reservations" on public.reservations for all using (true) with check (true);
create policy "anon_all_qr_codes" on public.qr_codes for all using (true) with check (true);
create policy "anon_all_activity_logs" on public.activity_logs for all using (true) with check (true);

create policy "anon_all_club_requests" on public.club_requests for all using (true) with check (true);

-- Profiles: only own profile (for future optional login)
create policy "select_own_profile" on public.profiles for select using (auth.uid() = id);
create policy "update_own_profile" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
