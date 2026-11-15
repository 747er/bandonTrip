# BandonTrip

The hub site for our Bandon Dunes trip, November 19-22, 2026: an elevated spreadsheet for
the group. An independent site, not affiliated with or endorsed by Bandon Dunes Golf Resort.

There is no database, no sign-in and no admin. The trip is one file. Each person picks
their name on the front door (remembered in a cookie on their device) and sees their own
tee times, foursomes and room; our six also see the meals and outings.

## Changing the trip

Edit [`src/data/trip.ts`](src/data/trip.ts) and push. It holds the dates, where we are
staying, and every event: rounds with their tee-time windows and par, dinners with party
size, and anything else. To add who goes off when, give a round `teeTimes`:

```ts
teeTimes: [
  { time: "10:10", players: ["Cody", "Sam", "Alex"] },
  { time: "10:20", players: ["Pat", "Lee", "Jo"] },
],
```

## Pages

| Page | What it is |
| --- | --- |
| Home (`/`) | Cover, next round, the courses, the four-day forecast. Changes before, during and after the trip |
| Schedule | Day by day, with the forecast at each start time and the resort map |
| Wind | Live wind particles over aerial imagery, hour by hour, with daylight |
| Packing | The resort's packing advice as a checklist that remembers ticks on each device |

## Running it

```bash
npm install
npm run dev
```

No environment variables are needed. Deploying to Vercel needs no settings either.

## Where things live

| Path | What |
| --- | --- |
| `src/data/trip.ts` | The trip |
| `src/lib/packing.ts` | The packing list |
| `public/images/` | Photography and the resort map. Drop files in by name; see the README there |
| `public/tiles/naip/` | Aerial map tiles for the resort, built by `scripts/build-tiles.mjs` |
| `src/lib/resortMap.ts` | Where each clubhouse sits on the printed map and in the real world |
| `src/lib/weather.ts`, `src/lib/wind.ts` | Daily and hourly forecast from Open-Meteo. Nothing is estimated |
| `scripts/clean-map.mjs` | Rebuilds the resort map image without its printed markers |

## Data sources

All public, none need a key: forecast from [Open-Meteo](https://open-meteo.com/), aerial
imagery from USDA NAIP via the USGS National Map, place positions from OpenStreetMap.
