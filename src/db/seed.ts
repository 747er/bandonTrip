import { eq } from "drizzle-orm";
import type { Db } from "./index";
import * as s from "./schema";
import { hashPassword } from "../lib/password";

/**
 * Creates the organizer account and the Bandon 2026 trip if they don't exist yet.
 * Safe to run repeatedly. Only facts from the trip brief are seeded: no golfer names,
 * tee-time assignments or reservation details are made up here. Add those in /admin.
 */
export async function seed(db: Db) {
  const email = process.env.ORGANIZER_EMAIL?.trim().toLowerCase();
  const password = process.env.ORGANIZER_PASSWORD;
  if (!email || !password) {
    console.warn(
      "[seed] ORGANIZER_EMAIL / ORGANIZER_PASSWORD not set; skipping seed.",
    );
    return;
  }

  let [organizer] = await db
    .select()
    .from(s.organizers)
    .where(eq(s.organizers.email, email));
  if (!organizer) {
    [organizer] = await db
      .insert(s.organizers)
      .values({
        email,
        name: process.env.ORGANIZER_NAME?.trim() || "Organizer",
        passwordHash: hashPassword(password),
      })
      .returning();
  }

  const slug = "bandon-2026";
  const [existing] = await db.select().from(s.trips).where(eq(s.trips.slug, slug));
  if (existing) return;

  const [trip] = await db
    .insert(s.trips)
    .values({
      ownerId: organizer.id,
      slug,
      title: "Bandon 2026",
      location: "Bandon, Oregon",
      tagline: "Four days, four courses, one long walk beside the Pacific.",
      startDate: "2026-11-19",
      endDate: "2026-11-22",
      timezone: "America/Los_Angeles",
      visibility: "public",
    })
    .returning();

  const [five] = await db
    .insert(s.groups)
    .values([
      {
        tripId: trip.id,
        name: "The Five",
        description: "Our group within the club trip.",
        sortOrder: 0,
      },
    ])
    .returning();

  const resort = "Bandon Dunes Golf Resort, 57744 Round Lake Rd, Bandon, OR 97411";

  const golf = [
    { date: "2026-11-19", course: "Old Macdonald", start: "10:10", end: "11:10", par: 71 },
    { date: "2026-11-20", course: "Pacific Dunes", start: "08:20", end: "09:30", par: 71 },
    { date: "2026-11-21", course: "Bandon Trails", start: "08:00", end: "08:50", par: 71 },
    { date: "2026-11-22", course: "Bandon Dunes", start: "08:10", end: "09:30", par: 72 },
  ];

  for (const g of golf) {
    const [event] = await db
      .insert(s.events)
      .values({
        tripId: trip.id,
        type: "golf",
        date: g.date,
        startTime: g.start,
        endTime: g.end,
        title: g.course,
        venue: g.course,
        address: resort,
        description: "",
      })
      .returning();
    await db.insert(s.rounds).values({
      tripId: trip.id,
      eventId: event.id,
      courseName: g.course,
      par: g.par,
      date: g.date,
    });
  }

  await db.insert(s.events).values([
    {
      tripId: trip.id,
      type: "dining",
      date: "2026-11-19",
      startTime: "17:30",
      title: "Trails End",
      venue: "Trails End Restaurant",
      address: resort,
      groupId: five.id,
      partySize: 5,
    },
    {
      tripId: trip.id,
      type: "activity",
      date: "2026-11-20",
      startTime: "15:00",
      title: "Shorty's",
      venue: "Shorty's",
      address: resort,
    },
    {
      tripId: trip.id,
      type: "dining",
      date: "2026-11-20",
      startTime: "19:30",
      title: "Pacific Grill",
      venue: "Pacific Grill",
      address: resort,
      groupId: five.id,
      partySize: 5,
    },
    {
      tripId: trip.id,
      type: "dining",
      date: "2026-11-21",
      startTime: "17:00",
      title: "Ghost Tree",
      venue: "Ghost Tree",
      address: resort,
      groupId: five.id,
      partySize: 5,
    },
  ]);

  console.log(`[seed] Created trip "${trip.title}" at /t/${trip.slug}`);
}
