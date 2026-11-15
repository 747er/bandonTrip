import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { TRIP } from "@/data/trip";
import { buildTrip, viewerFor, type PublicTrip, type Viewer } from "./trip";

// Who is looking. There are no accounts: each person picks their name once on the front
// door and the choice is kept in a cookie on their device.

export const VIEWER_COOKIE = "bt_me";

export const getViewer = cache(async (): Promise<Viewer | null> => {
  return viewerFor((await cookies()).get(VIEWER_COOKIE)?.value);
});

/** The trip at this address as the current viewer sees it, or null for an unknown address. */
export async function getTrip(slug: string): Promise<PublicTrip | null> {
  if (slug !== TRIP.slug) return null;
  return buildTrip(await getViewer());
}
