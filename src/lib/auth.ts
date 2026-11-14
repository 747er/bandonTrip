import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Organizer, Trip } from "@/db/schema";

const SESSION_COOKIE = "bt_session";
const PREVIEW_COOKIE = "bt_preview_at";
const SESSION_DAYS = 30;

function secret(): string {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) {
    throw new Error("AUTH_SECRET must be set to at least 32 characters.");
  }
  return value;
}

const sign = (payload: string) =>
  createHmac("sha256", secret()).update(payload).digest("base64url");

export async function startSession(organizerId: string) {
  const expires = Date.now() + SESSION_DAYS * 86_400_000;
  const payload = Buffer.from(JSON.stringify({ oid: organizerId, exp: expires })).toString(
    "base64url",
  );
  const jar = await cookies();
  jar.set(SESSION_COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(expires),
  });
}

export async function endSession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  jar.delete(PREVIEW_COOKIE);
}

/** The signed-in organizer, or null. Verifies the cookie signature and expiry. */
export async function getOrganizer(): Promise<Organizer | null> {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  const [payload, signature] = raw.split(".");
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  let data: { oid?: string; exp?: number };
  try {
    data = JSON.parse(Buffer.from(payload, "base64url").toString());
  } catch {
    return null;
  }
  if (!data.oid || !data.exp || data.exp < Date.now()) return null;
  const db = await getDb();
  const [organizer] = await db
    .select()
    .from(schema.organizers)
    .where(eq(schema.organizers.id, data.oid));
  return organizer ?? null;
}

export async function requireOrganizer(): Promise<Organizer> {
  const organizer = await getOrganizer();
  if (!organizer) redirect("/admin/login");
  return organizer;
}

/** Loads a trip only if the signed-in organizer owns it. Use in every admin page and action. */
export async function requireTrip(tripId: string): Promise<{ organizer: Organizer; trip: Trip }> {
  const organizer = await requireOrganizer();
  if (!/^[0-9a-f-]{36}$/i.test(tripId)) redirect("/admin");
  const db = await getDb();
  const [trip] = await db
    .select()
    .from(schema.trips)
    .where(and(eq(schema.trips.id, tripId), eq(schema.trips.ownerId, organizer.id)));
  if (!trip) redirect("/admin");
  return { organizer, trip };
}

/**
 * Organizers can preview a trip as if it were another moment ("YYYY-MM-DDTHH:MM" in the
 * trip's timezone). Ignored for anyone who isn't signed in.
 */
export async function getPreviewAt(): Promise<string | null> {
  const jar = await cookies();
  const value = jar.get(PREVIEW_COOKIE)?.value;
  if (!value || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  return (await getOrganizer()) ? value : null;
}

export async function setPreviewAt(value: string | null) {
  const jar = await cookies();
  if (value) {
    jar.set(PREVIEW_COOKIE, value, { httpOnly: true, sameSite: "lax", path: "/" });
  } else {
    jar.delete(PREVIEW_COOKIE);
  }
}
