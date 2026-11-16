import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/public/SiteFooter";
import { TabNav } from "@/components/public/TabNav";
import { WhoSheet } from "@/components/public/WhoSheet";
import { ROSTER } from "@/lib/trip";
import { dateRange } from "@/lib/time";
import { getTrip, VIEWER_COOKIE } from "@/lib/viewer";

export async function generateMetadata(): Promise<Metadata> {
  const data = await getTrip();
  if (!data) return {};
  const { trip } = data;
  return {
    title: { default: trip.title, template: `%s | ${trip.title}` },
    description: `${trip.title}, ${dateRange(trip.startDate, trip.endDate)}. ${trip.tagline}`,
  };
}

export default async function TripLayout({ children }: LayoutProps<"/">) {
  const data = await getTrip();
  if (!data) notFound();
  const { trip, viewer } = data;

  const sheet = (
    <WhoSheet
      roster={ROSTER.map(({ id, name }) => ({ id, name }))}
      viewer={viewer ? { id: viewer.id, firstName: viewer.firstName } : null}
      cookie={VIEWER_COOKIE}
    />
  );
  // Nobody chosen yet: the name sheet is the whole page. Nothing of the trip is drawn
  // (or sent) until a player is picked.
  if (!viewer) return <div className="pub relative min-h-svh bg-forest-deep">{sheet}</div>;

  return (
    <div className="pub relative">
      <header className="absolute inset-x-0 z-20">
        <div className="mx-auto max-w-[90rem]">
          <TabNav title={trip.title} />
        </div>
      </header>
      {/* Outside the header, so the sheet can cover everything, the tab bar included. */}
      {sheet}

      <main>{children}</main>

      <SiteFooter viewer={viewer.name} />
    </div>
  );
}
