-- Optional starter data. Run schema.sql first.
-- Add your real properties here, replacing these examples as needed.
insert into public.properties (property_code, name, keyword, location, owner_name, contact_number, property_type, facing, dimension, total_area, area_unit, price, price_unit)
values
  ('SP040', 'Existing commercial site', 'commercial', 'Hassan', 'Ramesh', '9876543210', 'Commercial', 'East', '30 x 40', 1200, 'sqft', 3500, 'sqft')
on conflict (property_code) do update set facing = excluded.facing;

-- With SP040 as the current last code, the next generated code is SP041.
select setval('property_code_seq', greatest(40, coalesce((select max(nullif(regexp_replace(property_code, '\D', '', 'g'), ''))::bigint from public.properties), 0)), true);
