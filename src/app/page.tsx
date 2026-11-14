import { redirect } from "next/navigation";
import { CoastScene } from "@/components/public/CoastScene";
import { getFeaturedTripSlug } from "@/lib/trip";

export const dynamic = "force-dynamic";

// bandontrip.com opens straight onto the current public trip.
export default async function FrontDoor() {
  const slug = await getFeaturedTripSlug();
  if (slug) redirect(`/t/${slug}`);

  return (
    <div className="pub relative isolate flex min-h-[100svh] flex-col overflow-hidden">
      <CoastScene className="absolute inset-0 -z-10 h-full w-full" />
      <div className="mx-auto w-full max-w-5xl px-5 pt-[20svh] text-forest-deep md:px-8">
        <h1 className="display text-[clamp(4rem,20vw,9rem)]">BandonTrip</h1>
        <p className="serif mt-5 max-w-sm text-[18px] italic leading-snug">
          Trip pages are shared by link. Ask your organizer for yours.
        </p>
      </div>
    </div>
  );
}
