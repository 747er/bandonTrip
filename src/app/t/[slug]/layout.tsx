import type { Metadata } from "next";
import { notFound } from "next/navigation";
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

      <footer className="border-t border-rule px-5 pb-28 pt-10 md:px-8 md:pb-14">
        <div className="mx-auto max-w-6xl text-[13px] leading-relaxed text-moss md:px-2">
          <p className="serif text-[15px] italic text-pine">BandonTrip</p>
          <p className="mt-2 max-w-md">
            Made by golfers for their own trip. An independent site, not affiliated with or
            endorsed by Bandon Dunes Golf Resort.
          </p>
        </div>
      </footer>
    </div>
  );
}
