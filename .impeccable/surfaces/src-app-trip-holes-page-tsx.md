---
version: 1
slug: "src-app-trip-holes-page-tsx"
primary_target: "src/app/(trip)/holes/page.tsx"
related_targets: ["src/components/public/holes/HoleFlyover.tsx"]
---

# Holes (/holes)

Scope: the hole-by-hole section. Mode: operate. Phone-first, full-screen.
Audience and job: a trip golfer walking their own round, hole 1 to 18, seeing the wind at about the time their group reaches each hole (from their tee time). Opened the night before, on the walk to the tee, and between shots.
Constraints: one forecast everywhere (point forecast, same as the wind dock); hole length is an estimate from OpenStreetMap and says so; no invented hole notes, photos, or yardages. Wind map keeps its holes and links here.

## Direction contract

FORM: seed:d7099c41fd68e7cb, dealt structure "Flyover" (chosen by the user).
THESIS: each hole fills the phone on the resort's aerial, turned so the tee is at your feet and the green straight ahead, with the wind streaming over it. Refuses the category default of a scorecard table or a north-up map you must hunt through.
OWN-WORLD: the wind page's world: dimmed NAIP aerial over deep Pacific, warm wind streaks, dark forest glass panels with hairline limestone edges, weathered copper for the open hole, Caslon display numerals, Schibsted Grotesk for readings.
STORY: open the page and you are standing on your next tee; the sheet says how the wind plays (into, helping, across) and when you'll be there; step on and the camera turns and flies to the next tee.
FIRST VIEWPORT: full-bleed rotated aerial of the hole (outline in copper, line of play dotted, green washed), wind particles over it; top: round picker and a north marker that turns with the map; bottom glass sheet (left-standing on desktop), one hole at a time: 44px prev/next flanking the copper hole number, par, about N yds, tee-time estimate; then wind speed and how it plays with a relative arrow, gusts, rain, temperature. No round overview: the user cut the 1-18 rail ("One hole at a time! Don't give up that much real estate for the round view").
SIGNATURE: the flyover: stepping holes rotates and flies the camera tee to tee while the forecast clock advances.
