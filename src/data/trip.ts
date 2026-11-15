// The whole trip, in one file. Edit it, push, and the site updates: there is no database
// and no admin. Times are 24-hour local time ("16:00"); dates are "YYYY-MM-DD".

export type EventType = "golf" | "dining" | "activity" | "lodging" | "custom";

export type TripEvent = {
  type: EventType;
  date: string;
  /** Start time. For golf, the first tee time. */
  startTime?: string;
  /** End time. For golf, the last tee time. */
  endTime?: string;
  /** Short name. It also picks the photo (public/images) and the pin on the maps. */
  title: string;
  venue?: string;
  address?: string;
  description?: string;
  /** Golf only */
  par?: number;
  /** Dining: the reservation */
  partySize?: number;
  group?: string;
  reservationNote?: string;
};

const RESORT = "Bandon Dunes Golf Resort, 57744 Round Lake Rd, Bandon, OR 97411";

export const TRIP = {
  slug: "bandon-2026",
  title: "Bandon 2026",
  location: "Bandon, Oregon",
  tagline: "Four days, four courses, one long walk beside the Pacific.",
  startDate: "2026-11-19",
  endDate: "2026-11-22",
  timezone: "America/Los_Angeles",
  /** For the forecast and the wind map */
  latitude: 43.188,
  longitude: -124.39,
};

// ---- Everyone on the trip ----
// A person's key is their last name as the tee sheet writes it. `core` marks our six,
// who see the full itinerary with meals; everyone else sees their tee times and lodging.

export type Person = { key: string; name: string; room: string; core?: boolean };

export const ROOMS: Record<string, { name: string; /** Which pin on the maps */ place: string }> = {
  grove1: { name: "Grove Cottage #1", place: "grove-cottages" },
  grove2: { name: "Grove Cottage #2", place: "grove-cottages" },
  grove3: { name: "Grove Cottage #3", place: "grove-cottages" },
  grove4: { name: "Grove Cottage #4", place: "grove-cottages" },
  loft1: { name: "Chrome Lake Loft #1", place: "chrome-lake" },
  loft2: { name: "Chrome Lake Loft #2", place: "chrome-lake" },
  double: { name: "Chrome Lake Double", place: "chrome-lake" },
  forest: { name: "Forest King", place: "the-inn" },
};

export const PEOPLE: Person[] = [
  { key: "Kritser", name: "JD Kritser", room: "grove1", core: true },
  { key: "Elms", name: "Cristian Elms", room: "grove1" },
  { key: "Hansen", name: "Brian Hansen", room: "grove1" },
  { key: "Pennington", name: "Justin Pennington", room: "grove1", core: true },
  { key: "Thompson", name: "Alex Thompson", room: "grove2" },
  { key: "Soren", name: "Soren Abildgaard", room: "grove2" },
  { key: "Steen", name: "Mark Steen", room: "grove2" },
  { key: "Anderson", name: "Kurt Anderson", room: "grove2" },
  { key: "Koerner", name: "Jason Koerner", room: "grove3", core: true },
  { key: "Krueck", name: "Erich Krueck", room: "grove3", core: true },
  { key: "Wilson", name: "Cody Wilson", room: "grove3", core: true },
  { key: "Woolsey", name: "Cam Woolsey", room: "grove3", core: true },
  { key: "Bach", name: "Trent Bach", room: "grove4" },
  { key: "Wagner", name: "Aaron Wagner", room: "grove4" },
  { key: "Mertz", name: "Andrew Mertz", room: "grove4" },
  { key: "Campagna", name: "Brian Campagna", room: "grove4" },
  { key: "Johnston", name: "Troy Johnston", room: "loft1" },
  { key: "Toolan", name: "Mike Toolan", room: "loft1" },
  { key: "De Graff", name: "Ben De Graff", room: "loft2" },
  { key: "Haggerty", name: "Brooks Haggerty", room: "loft2" },
  { key: "KQ", name: "KQ", room: "double" },
  { key: "Maez", name: "Erik Maez", room: "double" },
  { key: "Sawin", name: "Bob Sawin", room: "forest" },
];

// ---- The tee sheet, by round title: each time and who is in it (by key) ----

export const TEE_SHEET: Record<string, [time: string, players: string[]][]> = {
  "Old Macdonald": [
    ["10:10", ["Elms", "KQ", "Maez"]],
    ["10:20", ["Krueck", "Koerner", "Wilson", "Woolsey"]],
    ["10:40", ["Hansen", "Thompson", "Kritser", "Pennington"]],
    ["10:50", ["Wagner", "Mertz", "Bach", "Campagna"]],
    ["11:00", ["Steen", "Anderson", "Sawin", "Soren"]],
    ["11:10", ["Toolan", "Johnston", "De Graff", "Haggerty"]],
  ],
  "Pacific Dunes": [
    ["08:20", ["KQ", "Hansen", "Maez"]],
    ["08:30", ["Woolsey", "Wilson", "Pennington", "Kritser"]],
    ["08:40", ["Krueck", "Koerner", "Wagner", "Campagna"]],
    ["09:10", ["Bach", "Mertz", "Steen", "Anderson"]],
    ["09:20", ["Sawin", "Soren", "Toolan", "Johnston"]],
    ["09:30", ["Thompson", "Elms", "De Graff", "Haggerty"]],
  ],
  "Bandon Trails": [
    ["08:00", ["De Graff", "Haggerty", "Elms"]],
    ["08:10", ["Kritser", "Pennington", "Krueck", "Koerner"]],
    ["08:20", ["Woolsey", "Wilson", "Wagner", "Campagna"]],
    ["08:30", ["Toolan", "Johnston", "Steen", "Anderson"]],
    ["08:40", ["Thompson", "Hansen", "Sawin", "Soren"]],
    ["08:50", ["Bach", "Mertz", "Maez", "KQ"]],
  ],
  "Bandon Dunes": [
    ["08:10", ["KQ", "Maez", "Elms", "Hansen"]],
    ["08:20", ["Krueck", "Koerner", "Wilson", "Woolsey"]],
    ["08:40", ["De Graff", "Haggerty", "Wagner", "Campagna"]],
    ["08:50", ["Toolan", "Johnston", "Sawin", "Soren"]],
    ["09:20", ["Bach", "Mertz", "Kritser", "Pennington"]],
    ["09:30", ["Thompson", "Anderson", "Steen"]],
  ],
};

// ---- The schedule ----
// A round's start and end are the whole club's window; each person sees their own tee
// time from the sheet above. Meals and other outings are our six's, and only they see them.

export const EVENTS: TripEvent[] = [
  // ---- Thursday ----
  { type: "golf", date: "2026-11-19", startTime: "10:10", endTime: "11:10", title: "Old Macdonald", venue: "Old Macdonald", address: RESORT, par: 71 },
  {
    type: "activity",
    date: "2026-11-19",
    startTime: "16:00",
    endTime: "17:30",
    title: "Punchbowl",
    venue: "The Punchbowl",
    address: RESORT,
    description: "The putting course beside the Pacific Dunes clubhouse.",
  },
  { type: "dining", date: "2026-11-19", startTime: "17:30", title: "Trails End", venue: "Trails End Restaurant", address: RESORT, partySize: 6 },

  // ---- Friday ----
  { type: "golf", date: "2026-11-20", startTime: "08:20", endTime: "09:30", title: "Pacific Dunes", venue: "Pacific Dunes", address: RESORT, par: 71 },
  { type: "activity", date: "2026-11-20", startTime: "15:00", title: "Shorty's", venue: "Shorty's", address: RESORT },
  { type: "dining", date: "2026-11-20", startTime: "19:30", title: "Pacific Grill", venue: "Pacific Grill", address: RESORT, partySize: 6 },

  // ---- Saturday ----
  { type: "golf", date: "2026-11-21", startTime: "08:00", endTime: "08:50", title: "Bandon Trails", venue: "Bandon Trails", address: RESORT, par: 71 },
  { type: "dining", date: "2026-11-21", startTime: "17:00", title: "Ghost Tree", venue: "Ghost Tree", address: RESORT, partySize: 6 },

  // ---- Sunday ----
  { type: "golf", date: "2026-11-22", startTime: "08:10", endTime: "09:30", title: "Bandon Dunes", venue: "Bandon Dunes", address: RESORT, par: 72 },
];
