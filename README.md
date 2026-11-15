# BandonTrip

A trip hub for group golf trips to Bandon Dunes: tee times, tables, rooms and a leaderboard
behind one shareable link. Guests never sign in. An independent project, not affiliated with
Bandon Dunes Golf Resort.

## Two halves

- **Trip pages** (`/t/[slug]`): Home, Schedule, Scores, Packing. Styled as a travel publication.
  The home page changes before, during and after the trip.
- **Organizer** (`/admin`): plain, dense editing screens for the same data. Requires sign-in.

## Run it locally

```bash
npm install
npm run dev
```

With no `DATABASE_URL`, the app runs an embedded Postgres (PGlite) stored in `.data/`,
applies migrations and seeds the Bandon 2026 trip on first request. Delete `.data/` to start
over. The organizer account comes from `ORGANIZER_EMAIL` / `ORGANIZER_PASSWORD` in
`.env.local` (see `.env.example`).

## Deploy to Vercel

1. Create a Postgres database (Neon via the Vercel Marketplace works) and attach it so
   `DATABASE_URL` is set.
2. Add `ORGANIZER_EMAIL`, `ORGANIZER_NAME`, `ORGANIZER_PASSWORD` and `AUTH_SECRET`
   (`openssl rand -hex 32`) as environment variables.
3. Deploy. The `vercel-build` script applies migrations and seeds the first trip before
   building. Seeding only runs when the trip doesn't exist yet.

## Where things live

| Path | What |
| --- | --- |
| `src/db/schema.ts` | Trips, participants, groups, lodgings, events, tee times, rounds, scores, updates |
| `src/db/seed.ts` | The Bandon 2026 seed. Only facts from the brief: no golfer names or assignments |
| `src/lib/trip.ts` | Every query the public pages make. Private columns are never selected here |
| `src/lib/standings.ts` | Leaderboard rules (ties, missed rounds) |
| `src/lib/auth.ts` | Organizer session cookie and trip ownership checks |
| `src/app/admin/actions.ts` | All organizer mutations |
| `public/images/` | Trip photography. Drop files in by name; see the README there |
| `src/lib/weather.ts` | Forecast from Open-Meteo for the trip's coordinates. Nothing is estimated |

After changing the schema: `npm run db:generate`, commit the new file in `drizzle/`.
