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
  /** Golf: who goes off when, once it is known. Leave out until then. */
  teeTimes?: { time: string; players?: string[]; note?: string }[];
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
  /** Where the group is staying: the home pin on the maps */
  lodging: "Grove Cottages",
};

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
  { type: "dining", date: "2026-11-19", startTime: "17:30", title: "Trails End", venue: "Trails End Restaurant", address: RESORT, partySize: 5, group: "The Five" },

  // ---- Friday ----
  { type: "golf", date: "2026-11-20", startTime: "08:20", endTime: "09:30", title: "Pacific Dunes", venue: "Pacific Dunes", address: RESORT, par: 71 },
  { type: "activity", date: "2026-11-20", startTime: "15:00", title: "Shorty's", venue: "Shorty's", address: RESORT },
  { type: "dining", date: "2026-11-20", startTime: "19:30", title: "Pacific Grill", venue: "Pacific Grill", address: RESORT, partySize: 5, group: "The Five" },

  // ---- Saturday ----
  { type: "golf", date: "2026-11-21", startTime: "08:00", endTime: "08:50", title: "Bandon Trails", venue: "Bandon Trails", address: RESORT, par: 71 },
  { type: "dining", date: "2026-11-21", startTime: "17:00", title: "Ghost Tree", venue: "Ghost Tree", address: RESORT, partySize: 5, group: "The Five" },

  // ---- Sunday ----
  { type: "golf", date: "2026-11-22", startTime: "08:10", endTime: "09:30", title: "Bandon Dunes", venue: "Bandon Dunes", address: RESORT, par: 72 },
];
