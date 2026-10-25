# Billuminati

Split trips, rent and dinners with friends. Everyone signs up, joins a group by invite link, and sees the same live balances.

- **Frontend:** React + TypeScript + Vite, installable as a PWA
- **Backend:** Supabase (Postgres, Auth, Realtime). All data is protected by row-level security; every write goes through a checked database function (see `supabase/migrations`).
- **Hosting:** GitHub Pages, deployed by `.github/workflows/deploy.yml` on every push to `main`.

## Run locally

```bash
npm install
npm run dev
```

`.env` holds the Supabase URL and publishable key. Both are public by design.

## How the money works

Amounts are stored as integers in the currency's minor unit (halalas, paise, cents). Splits are computed so shares always add up to the exact amount, and the database rejects any expense whose shares don't.

## Moving to a custom domain

Build with `BASE_PATH=/` and add the domain under Supabase → Authentication → URL Configuration (Site URL and Redirect URLs).
