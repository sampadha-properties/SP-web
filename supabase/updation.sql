-- Sampadha Properties: safe migration from the old SP030 schema.
-- Run this after the old schema has been applied. It is designed to be rerunnable.
-- Existing rows, including SP030, are preserved.

create extension if not exists pgcrypto;

create sequence if not exists public.property_code_seq start 41;
create sequence if not exists public.request_code_seq start 1;

alter table if exists public.properties
  add column if not exists second_contact_number text default '',
  add column if not exists property_category text default 'sale',
  add column if not exists rental_type text,
  add column if not exists rental_category text,
  add column if not exists custom_price_enabled boolean default false,
  add column if not exists custom_selling_price numeric(20,2),
  add column if not exists floor text default '',
  add column if not exists property_kind text default '',
  add column if not exists rent_price numeric(16,2),
  add column if not exists advance_price numeric(16,2);

-- Normalize old nullable values before applying defaults and checks.
update public.properties set second_contact_number = '' where second_contact_number is null;
update public.properties set property_category = 'sale' where property_category is null or property_category = '';
update public.properties set custom_price_enabled = false where custom_price_enabled is null;
update public.properties set floor = '' where floor is null;
update public.properties set property_kind = '' where property_kind is null;
update public.properties set rental_type = null where rental_type = '';
update public.properties set rental_category = null where rental_category = '';

alter table public.properties alter column second_contact_number set default '';
alter table public.properties alter column property_category set default 'sale';
alter table public.properties alter column custom_price_enabled set default false;
alter table public.properties alter column floor set default '';
alter table public.properties alter column property_kind set default '';

-- Add new-category checks only when they do not already exist.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'properties_property_category_check') then
    alter table public.properties add constraint properties_property_category_check
      check (property_category in ('sale', 'rental', 'lease'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'properties_rental_type_check') then
    alter table public.properties add constraint properties_rental_type_check
      check (rental_type is null or rental_type in ('rental', 'lease'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'properties_rental_category_check') then
    alter table public.properties add constraint properties_rental_category_check
      check (rental_category is null or rental_category in ('home', 'commercial_space'));
  end if;
end $$;

create index if not exists properties_category_idx
  on public.properties(property_category, rental_type, rental_category);

create index if not exists properties_type_idx
  on public.properties(property_type);

create index if not exists properties_status_idx
  on public.properties(visited, documents_collected, sold);

create index if not exists properties_created_at_idx
  on public.properties(created_at desc);

create index if not exists properties_owner_location_idx
  on public.properties(owner_name, location);

-- Keep the shared SP sequence ahead of every existing property code.
select setval(
  'public.property_code_seq',
  greatest(
    40,
    coalesce(
      (select max(nullif(regexp_replace(property_code, '[^0-9]', '', 'g'), ''))::bigint
       from public.properties),
      0
    )
  ),
  true
);

-- Keep the call-request sequence ahead of every existing request code.
-- When there are no requests, start at 1 without consuming RQ001.
do $$
declare
  last_request_number bigint;
begin
  select max(nullif(regexp_replace(request_code, '[^0-9]', '', 'g'), '')::bigint)
    into last_request_number
    from public.call_requests;

  if last_request_number is null then
    perform setval('public.request_code_seq', 1, false);
  else
    perform setval('public.request_code_seq', greatest(1, last_request_number), true);
  end if;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists properties_updated_at on public.properties;
create trigger properties_updated_at
before update on public.properties
for each row execute function public.set_updated_at();

drop trigger if exists call_requests_updated_at on public.call_requests;
create trigger call_requests_updated_at
before update on public.call_requests
for each row execute function public.set_updated_at();

create or replace function public.create_property()
returns public.properties
language plpgsql
security definer
set search_path = public
as $$
declare
  new_code text;
  result public.properties;
begin
  new_code := 'SP' || lpad(nextval('public.property_code_seq')::text, 3, '0');
  insert into public.properties(property_code)
  values (new_code)
  returning * into result;
  return result;
end;
$$;

create or replace function public.create_call_request(payload jsonb)
returns public.call_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.call_requests;
  new_code text;
begin
  new_code := 'RQ' || lpad(nextval('public.request_code_seq')::text, 3, '0');
  insert into public.call_requests(
    request_code, contact_number, owner_name, location,
    google_maps_url, property_type, notes, status
  )
  values (
    new_code,
    coalesce(payload->>'contact_number', ''),
    coalesce(payload->>'owner_name', ''),
    coalesce(payload->>'location', ''),
    coalesce(payload->>'google_maps_url', ''),
    coalesce(payload->>'property_type', ''),
    coalesce(payload->>'notes', ''),
    'Pending'
  )
  returning * into result;
  return result;
end;
$$;

alter table if exists public.properties enable row level security;
alter table if exists public.call_requests enable row level security;

drop policy if exists properties_read on public.properties;
create policy properties_read on public.properties
for select to anon, authenticated using (true);

drop policy if exists properties_write on public.properties;
create policy properties_write on public.properties
for all to anon, authenticated using (true) with check (true);

drop policy if exists calls_read on public.call_requests;
create policy calls_read on public.call_requests
for select to anon, authenticated using (true);

drop policy if exists calls_write on public.call_requests;
create policy calls_write on public.call_requests
for all to anon, authenticated using (true) with check (true);

-- Storage is optional in some Supabase projects. Do not fail the migration when it is absent.
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'storage' and table_name = 'buckets'
  ) then
    if not exists (select 1 from storage.buckets where id = 'property-images') then
      insert into storage.buckets(id, name, public)
      values ('property-images', 'property-images', true);
    end if;
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'storage' and table_name = 'objects'
  ) then
    drop policy if exists property_images_read on storage.objects;
    create policy property_images_read on storage.objects
      for select to anon, authenticated
      using (bucket_id = 'property-images');

    drop policy if exists property_images_write on storage.objects;
    create policy property_images_write on storage.objects
      for all to anon, authenticated
      using (bucket_id = 'property-images')
      with check (bucket_id = 'property-images');
  end if;
end $$;

-- Logo setup:
-- Put the website logo at: sampadha-properties/public/logo.png
-- The navbar loads it automatically from /logo.png.
