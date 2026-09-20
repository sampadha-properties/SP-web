# Sampadha Properties

A mobile-first property operations workspace for listings, visits, document collection, editing, and independent callback requests.

## What is included

- One `properties` record shared by Listing, To-visit, To-collect, and Edit.
- Database-safe `SP001` and `RQ001` allocation through PostgreSQL sequences and RPCs.
- Search, newest-first ordering, status toggles, Indian currency formatting, and live total-price calculation.
- Supabase PostgreSQL, Storage bucket, RLS policies, generated totals, timestamps, and indexes.
- A zero-configuration local fallback using browser storage so the UI can be tested before Supabase credentials are added.

## Run locally

Requires Node.js 20 or newer.

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. Without Supabase values, the app uses local browser storage and starts with a sample SP040 record. This fallback is for local development only.

## Supabase setup

1. Create a free project at [supabase.com](https://supabase.com).
2. In Project Settings > API, copy the Project URL and anon public key into `.env.local` as `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Open SQL Editor and run `supabase/schema.sql`.
4. Run `supabase/seed.sql` if you want the sample SP040 or to set the counter after importing existing records.
5. Confirm Storage contains the public `property-images` bucket. The schema creates it and adds policies.
6. Restart `npm run dev` after changing environment variables.

The supplied policies allow internal anonymous access. For a public production deployment, add Supabase Auth and change the `anon` policies to authenticated-only before launch. Never put a service-role key in this app.

## Existing properties and IDs

Import existing rows with their exact `property_code` values, for example SP001 through SP040. Then set the sequence to the current last number:

```sql
select setval('property_code_seq', 40, true);
```

The next call to the database RPC creates SP041. The frontend never counts visible cards. Request IDs use a separate `request_code_seq` and can be initialized similarly.

## Architecture

The UI reads one `properties` table for all four property workflows. The status buttons update that same row, so a visit/document/sold change appears everywhere after the mutation. `call_requests` is separate and uses RQ codes. `total_price` is a generated PostgreSQL column (`price * total_area`) and the form shows the same calculation while typing. Area and price units are synchronized in the form and constrained to match in PostgreSQL.

The current UI has a local fallback, but Supabase becomes the source of truth automatically when both environment variables are present. Image fields are ready for Supabase Storage paths/URLs; upload controls can be connected to the `property-images` bucket without changing the property model.

## GitHub

```powershell
git init
git add .
git commit -m "Initial Sampadha properties app"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/sampadha-properties.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username and create the repository first.

## Vercel deployment

1. Sign in at [vercel.com](https://vercel.com) and choose **Add New > Project**.
2. Import the GitHub repository.
3. Keep the detected Next.js settings.
4. Add the two environment variables from `.env.example` using the production Supabase values.
5. Deploy and open the assigned URL.
6. Test create visit, edit, status toggles, search, and a call request on mobile and desktop.

Vercel and Supabase both have free tiers suitable for a small internal workspace. Review their current quotas before production use.

## Checks

```powershell
npm run lint
npm run build
```

Manual smoke test: create a visit and confirm the same SP code is visible in Listing, To-visit, To-collect, and Edit; edit its owner; toggle visit/documents; mark it sold; create RQ001 and RQ002; search SP/RQ codes; verify price x area and unit synchronization; refresh the page.
