import { buildCalendar } from "@/lib/ics";
import { getTrip } from "@/lib/trip";

export async function GET(request: Request, { params }: RouteContext<"/t/[slug]/calendar.ics">) {
  const { slug } = await params;
  const data = await getTrip(slug);
  if (!data) return new Response("Not found", { status: 404 });

  const url = new URL(request.url);
  const only = url.searchParams.get("event");
  const events = only ? data.events.filter((e) => e.id === only) : data.events;
  if (events.length === 0) return new Response("Not found", { status: 404 });

  const name = only
    ? events[0].title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "event"
    : data.trip.slug;
  return new Response(buildCalendar(data.trip, events, url.origin), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
