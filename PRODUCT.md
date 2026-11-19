# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
The 23 golfers on the Bandon 2026 trip (Bandon Dunes Golf Resort, Nov 19–22, 2026). Each person picks their name once on a sheet; the site then shows their own tee times, lodging and, for the core six, meals. They use it mostly on phones: the night before a round, on the walk to the first tee, and between shots. Desktop is secondary.

## Product Purpose
One private trip site that answers "where am I going, when, and what will it be like out there?" Success is nobody having to ask the group chat for a tee time, a dinner booking, or what the wind is doing.

## Positioning
Built around this trip's own facts: the real tee sheet, each person's tee time, the resort's actual holes (OpenStreetMap), and an hour-by-hour forecast for the resort's coordinates. Everything is personal to the person viewing.

## Operating Context
- Four rounds on four courses: Old Macdonald (Thu), Pacific Dunes (Fri), Bandon Trails (Sat), Bandon Dunes (Sun), plus Shorty's and the Punchbowl as outings.
- Sections today: Home, Schedule, Wind (a live wind map of the resort), Packing, and a page per course.
- The trip data lives in one file (`src/data/trip.ts`); there is no database or admin.
- Forecast from Open-Meteo, about two weeks ahead; days outside the window show no forecast rather than an estimate.

## Capabilities and Constraints
- Next.js app router; pages are server-rendered per viewer from a cookie.
- Hole geometry (line of play, green, outline, par) for every hole at the resort comes from OpenStreetMap via `src/lib/holes.json`. There is no official hole-by-hole yardage in the data; any distance worked from the line of play is an estimate and must say so.
- Wind is a 6×6 grid around the resort plus a point forecast, per hour.
- Aerial imagery is self-hosted NAIP tiles for the resort.

## Brand Commitments
- Voice: plain, specific, golfer's language ("into the wind", "left to right"); no hype.
- The site reads as an editorial travel publication in Bandon's own materials: shore pine, wet limestone, dune sand, sea mist, weathered copper.

## Evidence on Hand
- Real tee sheet, schedule, rooms (`src/data/trip.ts`); course facts from the resort's own pages (`src/data/courses.ts`).
- Course photos supplied by the trip organiser (`public/images`); no other imagery is to be fetched without being asked.
- No per-hole photos, yardages, or hole descriptions exist; none may be invented.

## Product Principles
1. Personal first: show the viewer's own time, round and room before anything general.
2. True to the forecast: every number on screen reads from the same forecast, and agrees everywhere it appears.
3. Phone in one hand, on a windy course: big targets, glanceable answers, no hunting.
4. Say where a number comes from when it is an estimate.

## Accessibility & Inclusion
Readable outdoors on a phone in daylight; respects reduced motion; every control usable by keyboard and screen reader.
