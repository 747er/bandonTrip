import type { Metadata } from "next";
import Link from "next/link";
import { requireOrganizer } from "@/lib/auth";
import { logout } from "../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: { default: "Organizer", template: "%s | Organizer" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const organizer = await requireOrganizer();
  return (
    <div className="admin">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex h-12 max-w-5xl items-center justify-between px-4">
          <Link href="/admin" className="text-[14px] font-semibold">
            BandonTrip <span className="font-normal text-zinc-500">Organizer</span>
          </Link>
          <form action={logout} className="flex items-center gap-3">
            <span className="hidden text-[13px] text-zinc-500 sm:inline">{organizer.email}</span>
            <button type="submit" className="btn">
              Sign out
            </button>
          </form>
        </div>
      </header>
      {children}
    </div>
  );
}
