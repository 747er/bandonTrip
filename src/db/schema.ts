import {
  boolean,
  date,
  doublePrecision,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const organizers = pgTable("organizers", {
  id: id(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: createdAt(),
});

export const trips = pgTable("trips", {
  id: id(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => organizers.id, { onDelete: "cascade" }),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  location: text("location").notNull().default(""),
  tagline: text("tagline").notNull().default(""),
  startDate: date("start_date", { mode: "string" }).notNull(),
  endDate: date("end_date", { mode: "string" }).notNull(),
  timezone: text("timezone").notNull().default("America/Los_Angeles"),
  /** "public" trips are listed and indexable; "unlisted" trips are reachable only by link. */
  visibility: text("visibility", { enum: ["public", "unlisted"] })
    .notNull()
    .default("unlisted"),
  /** Where the trip happens, for the weather forecast. */
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  heroImageUrl: text("hero_image_url"),
  heroImageCredit: text("hero_image_credit"),
  createdAt: createdAt(),
});

export const lodgings = pgTable("lodgings", {
  id: id(),
  tripId: uuid("trip_id")
    .notNull()
    .references(() => trips.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  detail: text("detail").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const participants = pgTable("participants", {
  id: id(),
  tripId: uuid("trip_id")
    .notNull()
    .references(() => trips.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  hometown: text("hometown").notNull().default(""),
  caddie: text("caddie").notNull().default(""),
  lodgingId: uuid("lodging_id").references(() => lodgings.id, {
    onDelete: "set null",
  }),
  sortOrder: integer("sort_order").notNull().default(0),
  // Organizer-only. Never selected by public queries.
  privatePhone: text("private_phone").notNull().default(""),
  privateEmail: text("private_email").notNull().default(""),
  privateNotes: text("private_notes").notNull().default(""),
});

export const groups = pgTable("groups", {
  id: id(),
  tripId: uuid("trip_id")
    .notNull()
    .references(() => trips.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const groupMembers = pgTable(
  "group_members",
  {
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => participants.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.groupId, t.participantId] })],
);

export const EVENT_TYPES = [
  "golf",
  "dining",
  "activity",
  "lodging",
  "custom",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const events = pgTable("events", {
  id: id(),
  tripId: uuid("trip_id")
    .notNull()
    .references(() => trips.id, { onDelete: "cascade" }),
  type: text("type", { enum: EVENT_TYPES }).notNull().default("custom"),
  date: date("date", { mode: "string" }).notNull(),
  /** Local wall-clock time in the trip's timezone, "HH:MM". Null means all day. */
  startTime: text("start_time"),
  endTime: text("end_time"),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  venue: text("venue").notNull().default(""),
  address: text("address").notNull().default(""),
  /** When set, the event is for this group. Explicit attendees override it. */
  groupId: uuid("group_id").references(() => groups.id, {
    onDelete: "set null",
  }),
  partySize: integer("party_size"),
  /** Shown publicly, e.g. the name a table is booked under. */
  reservationNote: text("reservation_note").notNull().default(""),
  // Organizer-only (confirmation numbers and the like).
  privateNote: text("private_note").notNull().default(""),
});

export const eventAttendees = pgTable(
  "event_attendees",
  {
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => participants.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.eventId, t.participantId] })],
);

export const teeTimes = pgTable("tee_times", {
  id: id(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  time: text("time").notNull(),
  note: text("note").notNull().default(""),
});

export const teeTimePlayers = pgTable(
  "tee_time_players",
  {
    teeTimeId: uuid("tee_time_id")
      .notNull()
      .references(() => teeTimes.id, { onDelete: "cascade" }),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => participants.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.teeTimeId, t.participantId] })],
);

export const rounds = pgTable("rounds", {
  id: id(),
  tripId: uuid("trip_id")
    .notNull()
    .references(() => trips.id, { onDelete: "cascade" }),
  eventId: uuid("event_id").references(() => events.id, {
    onDelete: "set null",
  }),
  courseName: text("course_name").notNull(),
  par: integer("par").notNull().default(72),
  date: date("date", { mode: "string" }).notNull(),
  /** Rounds that don't count are shown on their own but left out of the cumulative board. */
  countsTowardTotal: boolean("counts_toward_total").notNull().default(true),
});

export const scores = pgTable(
  "scores",
  {
    roundId: uuid("round_id")
      .notNull()
      .references(() => rounds.id, { onDelete: "cascade" }),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => participants.id, { onDelete: "cascade" }),
    gross: integer("gross").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.roundId, t.participantId] })],
);

export const updates = pgTable("updates", {
  id: id(),
  tripId: uuid("trip_id")
    .notNull()
    .references(() => trips.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdAt: createdAt(),
});

export type Trip = typeof trips.$inferSelect;
export type Organizer = typeof organizers.$inferSelect;
export type Participant = typeof participants.$inferSelect;
export type Lodging = typeof lodgings.$inferSelect;
export type Group = typeof groups.$inferSelect;
export type TripEvent = typeof events.$inferSelect;
export type TeeTime = typeof teeTimes.$inferSelect;
export type Round = typeof rounds.$inferSelect;
export type Score = typeof scores.$inferSelect;
export type Update = typeof updates.$inferSelect;
