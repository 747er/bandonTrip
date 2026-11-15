import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/public/SiteFooter";
import { TabNav } from "@/components/public/TabNav";
import { dateRange } from "@/lib/time";
import { getTrip } from "@/lib/trip";

export async function generateMetadata({ params }: LayoutProps<"/t/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const data = await getTrip(slug);
  if (!data) return {};
  const { trip } = data;
  return {
    title: { default: trip.title, template: `%s | ${trip.title}` },
    description: `${trip.title}, ${dateRange(trip.startDate, trip.endDate)}. ${trip.tagline}`,
  };
}

export default async function TripLayout({ children, params }: LayoutProps<"/t/[slug]">) {
  const { slug } = await params;
  const data = await getTrip(slug);
  if (!data) notFound();
  const { trip } = data;

  return (
    <div className="pub relative">
      <header className="absolute inset-x-0 z-20">
        <div className="mx-auto max-w-[90rem]">
          <TabNav slug={trip.slug} title={trip.title} />
        </div>
      </header>

      <main>{children}</main>

      <SiteFooter slug={trip.slug} />
    </div>
  );
}
