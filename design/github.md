repo: 747er/bandonTrip
branch: main

## Last sync
date: 2026-11-16T18:24:21Z

### Updated in this project
- Recreated the phone Schedule screen (viewing as Cody Wilson)
- Three new schedule approaches responding to review feedback (1a chosen)
- Recreated the phone Home page and three options to cut repetition
- Recreated the phone Wind page and two options for direction, time and place

## Screen map
| Project screen | Repo files |
| --- | --- |
| Schedule Current.dc.html | src/app/(trip)/schedule/page.tsx, src/components/public/ScheduleView.tsx, src/components/public/DayMap.tsx, src/components/public/TabNav.tsx, src/components/public/WhoSheet.tsx, src/components/public/TripHeading.tsx, src/components/public/SiteFooter.tsx, src/components/public/Glyphs.tsx, src/app/globals.css, src/data/trip.ts, src/lib/resortMap.ts |
| Schedule Approaches.dc.html | same as above, plus src/data/courses.ts |
| Home Current.dc.html | src/app/(trip)/page.tsx, src/components/public/MobileDay.tsx, src/components/public/NextUp.tsx, src/components/public/CourseExplorer.tsx, src/components/public/features.tsx, src/components/public/Countdown.tsx, src/components/public/SiteFooter.tsx, src/app/globals.css |
| Home Approaches.dc.html | same as Home Current, plus src/components/public/Carousel.tsx, src/data/courses.ts |
| Wind Current.dc.html | src/app/(trip)/wind/page.tsx, src/components/public/wind/WindExplorer.tsx, src/components/public/wind/ForecastTimeline.tsx, src/components/public/wind/particles.ts, src/lib/wind.ts, src/lib/windMath.ts, src/lib/resortMap.ts, src/app/globals.css, public/tiles/naip/15/* |
| Wind Approaches.dc.html | same as Wind Current |
