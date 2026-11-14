import Link from "next/link";
import { AdminTabs, CopyLink } from "@/components/admin/controls";
import { requireTrip } from "@/lib/auth";
import { dateRange } from "@/lib/time";

export default async function TripAdminLayout({
  children,
  params,
}: LayoutProps<"/admin/trips/[id]">) {
  const { id } = await params;
  const { trip } = await requireTrip(id);
  return (
    <>
      <div className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-[18px] font-semibold leading-tight">{trip.title}</h1>
              <p className="text-[13px] text-zinc-500">
                {dateRange(trip.startDate, trip.endDate)}
                <span className="mx-1.5 text-zinc-300">|</span>
                {trip.visibility === "public" ? "Public" : "Unlisted"}
              </p>
            </div>
            <div className="flex gap-2">
              <CopyLink path={`/t/${trip.slug}`} />
              <Link href={`/t/${trip.slug}`} className="btn">
                View trip page
              </Link>
            </div>
          </div>
          <div className="mt-3">
            <AdminTabs tripId={trip.id} />
          </div>
        </div>
      </div>
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">{children}</main>
    </>
  );
}
