create extension if not exists pgcrypto;

create sequence if not exists property_code_seq start 41;
create sequence if not exists request_code_seq start 1;

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  property_code text not null unique,
  name text not null default '',
  keyword text not null default '',
  location text not null default '',
  google_maps_url text not null default '',
  owner_name text not null default '',
  contact_number text not null default '',
  second_contact_number text default '',
  property_category text not null default 'sale' check (property_category in ('sale', 'rental', 'lease')),
  property_type text not null default '',
  rental_type text default null check (rental_type is null or rental_type in ('rental', 'lease')),
  rental_category text default null check (rental_category is null or rental_category in ('home', 'commercial_space')),
  custom_price_enabled boolean not null default false,
  custom_selling_price numeric(20,2),
  floor text not null default '',
  property_kind text not null default '',
  facing text not null default '',
  dimension text not null default '',
  total_area numeric(14,2),
  area_unit text not null default 'sqft' check (area_unit in ('sqft','gunta','acre')),
  price numeric(16,2),
  price_unit text not null default 'sqft' check (price_unit in ('sqft','gunta','acre')),
  total_price numeric(20,2),
  rent_price numeric(16,2),
  advance_price numeric(16,2),
  visited boolean not null default false,
  documents_collected boolean not null default false,
  sold boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  image_path text,
  image_url text,
  check (total_area is null or total_area >= 0),
  check (price is null or price >= 0),
  check (rent_price is null or rent_price >= 0),
  check (advance_price is null or advance_price >= 0),
  check (custom_selling_price is null or custom_selling_price >= 0),
  check (area_unit = price_unit)
);

alter table public.properties add column if not exists second_contact_number text default '';
alter table public.properties add column if not exists property_category text default 'sale';
alter table public.properties add column if not exists rental_type text default null;
alter table public.properties add column if not exists rental_category text default null;
alter table public.properties add column if not exists custom_price_enabled boolean default false;
alter table public.properties add column if not exists custom_selling_price numeric(20,2);
alter table public.properties add column if not exists floor text default '';
alter table public.properties add column if not exists property_kind text default '';
alter table public.properties add column if not exists rent_price numeric(16,2);
alter table public.properties add column if not exists advance_price numeric(16,2);

create table if not exists public.call_requests (
  id uuid primary key default gen_random_uuid(),
  request_code text not null unique,
  contact_number text not null default '',
  owner_name text not null default '',
  location text not null default '',
  google_maps_url text not null default '',
  property_type text not null default '',
  notes text not null default '',
  status text not null default 'Pending' check (status in ('Pending','Completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists properties_created_at_idx on public.properties(created_at desc);
create index if not exists properties_type_idx on public.properties(property_type);
create index if not exists properties_status_idx on public.properties(visited, documents_collected, sold);
create index if not exists properties_owner_location_idx on public.properties(owner_name, location);
create index if not exists properties_category_idx on public.properties(property_category, rental_type, rental_category);
create index if not exists call_requests_created_at_idx on public.call_requests(created_at desc);
create index if not exists call_requests_status_idx on public.call_requests(status);

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists properties_updated_at on public.properties;
create trigger properties_updated_at before update on public.properties for each row execute function public.set_updated_at();
drop trigger if exists call_requests_updated_at on public.call_requests;
create trigger call_requests_updated_at before update on public.call_requests for each row execute function public.set_updated_at();

create or replace function public.create_property() returns public.properties language plpgsql security definer set search_path = public as $$
declare new_code text; result public.properties;
begin
  new_code := 'SP' || lpad(nextval('property_code_seq')::text, 3, '0');
  insert into public.properties(property_code) values (new_code) returning * into result;
  return result;
end; $$;

create or replace function public.create_call_request(payload jsonb) returns public.call_requests language plpgsql security definer set search_path = public as $$
declare result public.call_requests; new_code text;
begin
  new_code := 'RQ' || lpad(nextval('request_code_seq')::text, 3, '0');
  insert into public.call_requests(request_code, contact_number, owner_name, location, google_maps_url, property_type, notes, status)
  values (new_code, coalesce(payload->>'contact_number',''), coalesce(payload->>'owner_name',''), coalesce(payload->>'location',''), coalesce(payload->>'google_maps_url',''), coalesce(payload->>'property_type',''), coalesce(payload->>'notes',''), 'Pending') returning * into result;
  return result;
end; $$;

alter table public.properties enable row level security;
alter table public.call_requests enable row level security;
drop policy if exists properties_read on public.properties;
create policy properties_read on public.properties for select to anon, authenticated using (true);
drop policy if exists properties_write on public.properties;
create policy properties_write on public.properties for all to anon, authenticated using (true) with check (true);
drop policy if exists calls_read on public.call_requests;
create policy calls_read on public.call_requests for select to anon, authenticated using (true);
drop policy if exists calls_write on public.call_requests;
create policy calls_write on public.call_requests for all to anon, authenticated using (true) with check (true);

-- Storage is optional. Only create the bucket/policies when the storage schema exists.
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'storage'
      and table_name = 'buckets'
  ) then
    if not exists (select 1 from storage.buckets where id = 'property-images') then
      insert into storage.buckets (id, name, public)
      values ('property-images', 'property-images', true);
    end if;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'storage'
      and table_name = 'objects'
  ) then
    drop policy if exists property_images_read on storage.objects;
    create policy property_images_read
      on storage.objects
      for select
      to anon, authenticated
      using (bucket_id = 'property-images');

    drop policy if exists property_images_write on storage.objects;
    create policy property_images_write
      on storage.objects
      for all
      to anon, authenticated
      using (bucket_id = 'property-images')
      with check (bucket_id = 'property-images');
  end if;
end $$;

-- Existing data import: insert SP001...SP040 in seed.sql, then set the sequence to the next number.

update public.properties set property_category = 'sale' where property_category is null or property_category = '';
update public.properties set custom_price_enabled = false where custom_price_enabled is null;
update public.properties set second_contact_number = '' where second_contact_number is null;
update public.properties set floor = '' where floor is null;
update public.properties set property_kind = '' where property_kind is null;
update public.properties set dimension = '' where dimension is null;
update public.properties set rental_type = null where rental_type = '';
update public.properties set rental_category = null where rental_category = '';

alter table public.properties alter column property_category set default 'sale';
alter table public.properties alter column custom_price_enabled set default false;
alter table public.properties alter column second_contact_number set default '';

-- Existing records remain valid. New rental/lease entries can be created without changing the existing SP sequence.
