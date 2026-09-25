-- Safe additive migration for Sampadha property workflow extension.
-- Purpose: add deal/request tracking, video/final-price fields, and app-level metadata without disrupting the existing SP/RQ sequence.
-- Backward compatibility: existing properties and request records remain fully usable; new columns are nullable/defaulted.

create extension if not exists pgcrypto;

-- Keep the current property code sequence and request sequence intact.
-- The existing SP and RQ numbering is preserved; this migration only adds the new workflow tables.
create sequence if not exists public.property_code_seq start 41;
create sequence if not exists public.request_code_seq start 1;

alter table if exists public.properties
  add column if not exists video_uploaded boolean default false,
  add column if not exists years_old integer,
  add column if not exists details text default '',
  add column if not exists final_price numeric(20,2),
  add column if not exists total_price numeric(20,2),
  add column if not exists deal_status text;

update public.properties
set video_uploaded = false
where video_uploaded is null;

update public.properties
set details = ''
where details is null;

update public.properties
set property_category = 'sale'
where property_category is null or property_category = '';

alter table public.properties
  alter column video_uploaded set default false,
  alter column details set default '';

-- total_price may be a generated column in production. Only backfill it when
-- the existing schema stores it as a normal column; never assign to generated columns.
do $$
begin
  if not exists (
    select 1
    from pg_attribute
    where attrelid = 'public.properties'::regclass
      and attname = 'total_price'
      and attgenerated <> ''
  ) then
    update public.properties
    set total_price = case
      when custom_price_enabled then custom_selling_price
      when price is not null and total_area is not null then price * total_area
      else null
    end
    where total_price is null
      and property_category = 'sale';
  end if;
end $$;

-- Only create a dedicated deals table with a FK to the source property.
create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete restrict,
  buyer_name text not null default '',
  buyer_phone text not null default '',
  deal_price numeric(20,2),
  deal_price_unit text not null default 'sqft' check (deal_price_unit in ('sqft','gunta','acre')),
  custom_deal_price_enabled boolean not null default false,
  custom_deal_price numeric(20,2),
  deal_status text not null default 'In Talk' check (deal_status in ('In Talk', 'Agreement', 'Deal Done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- New client request table for the property matching engine.
create table if not exists public.client_requests (
  id uuid primary key default gen_random_uuid(),
  request_code text not null unique,
  client_name text not null default '',
  phone_number text not null default '',
  property_category text not null default 'sale' check (property_category in ('sale', 'rental', 'lease')),
  property_type text not null default '',
  rental_type text default null check (rental_type is null or rental_type in ('rental', 'lease')),
  rental_category text default null check (rental_category is null or rental_category in ('home', 'commercial_space')),
  location text not null default '',
  facing text not null default 'Any Facing',
  dimension text not null default '',
  floor text not null default '',
  property_kind text not null default '',
  area numeric(14,2),
  area_unit text not null default 'sqft' check (area_unit in ('sqft','gunta','acre')),
  price numeric(16,2),
  price_unit text not null default 'sqft' check (price_unit in ('sqft','gunta','acre')),
  custom_budget_enabled boolean not null default false,
  custom_budget numeric(20,2),
  budget numeric(20,2),
  advance_budget numeric(20,2),
  area_match_mode text not null default 'min' check (area_match_mode in ('min','max')),
  budget_match_mode text not null default 'min' check (budget_match_mode in ('min','max')),
  details text not null default '',
  match_mode text not null default 'min' check (match_mode in ('min','max')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.client_requests
  add column if not exists floor text not null default '',
  add column if not exists property_kind text not null default '',
  add column if not exists advance_budget numeric(20,2),
  add column if not exists area_match_mode text not null default 'min',
  add column if not exists budget_match_mode text not null default 'min';

create table if not exists public.rental_home_units (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  floor text not null default '',
  property_kind text not null default '',
  facing text not null default 'Any Facing',
  rent_price numeric(16,2),
  advance_price numeric(16,2),
  dimension text not null default '',
  available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (rent_price is null or rent_price >= 0),
  check (advance_price is null or advance_price >= 0)
);

create table if not exists public.app_metadata (
  id uuid primary key default gen_random_uuid(),
  metadata_key text not null unique,
  metadata_value jsonb not null default '{}'::jsonb,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists deals_property_idx on public.deals(property_id, deal_status, created_at desc);
create index if not exists deals_status_idx on public.deals(deal_status);
create index if not exists client_requests_category_idx on public.client_requests(property_category, property_type, budget);
create index if not exists client_requests_location_idx on public.client_requests(location, property_type);
create index if not exists rental_home_units_property_idx on public.rental_home_units(property_id, available);
create index if not exists rental_home_units_match_idx on public.rental_home_units(property_kind, facing, rent_price);
create index if not exists app_metadata_key_idx on public.app_metadata(metadata_key);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists properties_total_price_sync on public.properties;

drop trigger if exists deals_updated_at on public.deals;
create trigger deals_updated_at before update on public.deals for each row execute function public.set_updated_at();

drop trigger if exists client_requests_updated_at on public.client_requests;
create trigger client_requests_updated_at before update on public.client_requests for each row execute function public.set_updated_at();

drop trigger if exists rental_home_units_updated_at on public.rental_home_units;
create trigger rental_home_units_updated_at before update on public.rental_home_units for each row execute function public.set_updated_at();

drop trigger if exists app_metadata_updated_at on public.app_metadata;
create trigger app_metadata_updated_at before update on public.app_metadata for each row execute function public.set_updated_at();

create or replace function public.upsert_app_metadata(p_key text, p_value jsonb, p_description text default '')
returns public.app_metadata
language plpgsql
security definer
set search_path = public
as $$
declare result public.app_metadata;
begin
  insert into public.app_metadata(metadata_key, metadata_value, description)
  values (p_key, coalesce(p_value, '{}'::jsonb), coalesce(p_description, ''))
  on conflict (metadata_key)
  do update set
    metadata_value = excluded.metadata_value,
    description = excluded.description,
    updated_at = now()
  returning * into result;

  return result;
end;
$$;

create or replace function public.create_deal(payload jsonb)
returns public.deals
language plpgsql
security definer
set search_path = public
as $$
declare result public.deals;
begin
  insert into public.deals(
    property_id,
    buyer_name,
    buyer_phone,
    deal_price,
    deal_price_unit,
    custom_deal_price_enabled,
    custom_deal_price,
    deal_status
  )
  values (
    coalesce((payload->>'property_id')::uuid, null),
    coalesce(payload->>'buyer_name', ''),
    coalesce(payload->>'buyer_phone', ''),
    nullif(payload->>'deal_price', '')::numeric,
    coalesce(payload->>'deal_price_unit', 'sqft'),
    coalesce((payload->>'custom_deal_price_enabled')::boolean, false),
    nullif(payload->>'custom_deal_price', '')::numeric,
    coalesce(payload->>'deal_status', 'In Talk')
  )
  returning * into result;
  return result;
end;
$$;

create or replace function public.create_client_request(payload jsonb)
returns public.client_requests
language plpgsql
security definer
set search_path = public
as $$
declare result public.client_requests; new_code text;
begin
  new_code := 'RQ' || lpad(nextval('public.request_code_seq')::text, 3, '0');

  insert into public.client_requests(
    request_code,
    client_name,
    phone_number,
    property_category,
    property_type,
    rental_type,
    rental_category,
    location,
    facing,
    dimension,
    floor,
    property_kind,
    area,
    area_unit,
    price,
    price_unit,
    custom_budget_enabled,
    custom_budget,
    budget,
    advance_budget,
    area_match_mode,
    budget_match_mode,
    details,
    match_mode
  )
  values (
    new_code,
    coalesce(payload->>'client_name', ''),
    coalesce(payload->>'phone_number', ''),
    coalesce(payload->>'property_category', 'sale'),
    coalesce(payload->>'property_type', ''),
    nullif(payload->>'rental_type', ''),
    nullif(payload->>'rental_category', ''),
    coalesce(payload->>'location', ''),
    coalesce(payload->>'facing', 'Any Facing'),
    coalesce(payload->>'dimension', ''),
    coalesce(payload->>'floor', ''),
    coalesce(payload->>'property_kind', ''),
    nullif(payload->>'area', '')::numeric,
    coalesce(payload->>'area_unit', 'sqft'),
    nullif(payload->>'price', '')::numeric,
    coalesce(payload->>'price_unit', 'sqft'),
    coalesce((payload->>'custom_budget_enabled')::boolean, false),
    nullif(payload->>'custom_budget', '')::numeric,
    nullif(payload->>'budget', '')::numeric,
    nullif(payload->>'advance_budget', '')::numeric,
    coalesce(payload->>'area_match_mode', 'min'),
    coalesce(payload->>'budget_match_mode', coalesce(payload->>'match_mode', 'min')),
    coalesce(payload->>'details', ''),
    coalesce(payload->>'match_mode', 'min')
  ) returning * into result;

  return result;
end;
$$;

-- RLS for the new workflow tables.
alter table public.deals enable row level security;
alter table public.client_requests enable row level security;
alter table public.rental_home_units enable row level security;

drop policy if exists deals_read on public.deals;
create policy deals_read on public.deals for select to anon, authenticated using (true);

drop policy if exists deals_write on public.deals;
create policy deals_write on public.deals for all to anon, authenticated using (true) with check (true);

drop policy if exists client_requests_read on public.client_requests;
create policy client_requests_read on public.client_requests for select to anon, authenticated using (true);

drop policy if exists client_requests_write on public.client_requests;
create policy client_requests_write on public.client_requests for all to anon, authenticated using (true) with check (true);

drop policy if exists rental_home_units_read on public.rental_home_units;
create policy rental_home_units_read on public.rental_home_units for select to anon, authenticated using (true);

drop policy if exists rental_home_units_write on public.rental_home_units;
create policy rental_home_units_write on public.rental_home_units for all to anon, authenticated using (true) with check (true);

-- Keep sequence values in sync with the existing property/request table data.
do $$
declare
  last_property bigint;
  last_request bigint;
begin
  select max(nullif(regexp_replace(property_code, '[^0-9]', '', 'g'), '')::bigint)
  into last_property
  from public.properties;

  if last_property is not null then
    perform setval('public.property_code_seq', greatest(41, last_property), true);
  end if;

  last_request := null;
  if to_regclass('public.client_requests') is not null then
    select max(nullif(regexp_replace(request_code, '[^0-9]', '', 'g'), '')::bigint)
    into last_request
    from public.client_requests;
  end if;
  if to_regclass('public.call_requests') is not null then
    select greatest(coalesce(last_request, 0), coalesce(max(nullif(regexp_replace(request_code, '[^0-9]', '', 'g'), '')::bigint), 0))
    into last_request
    from public.call_requests;
  end if;

  if last_request is not null then
    perform setval('public.request_code_seq', greatest(1, last_request), true);
  else
    perform setval('public.request_code_seq', 1, false);
  end if;
end $$;
