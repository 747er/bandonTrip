import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getOrganizer } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Organizer sign in", robots: { index: false } };

export default async function LoginPage() {
  if (await getOrganizer()) redirect("/admin");
  return (
    <div className="admin flex items-center justify-center px-4">
      <div className="panel w-full max-w-sm p-6">
        <h1 className="text-[17px] font-semibold">Organizer sign in</h1>
        <p className="mt-1 text-[13px] text-zinc-500">
          Guests don&rsquo;t need an account. This is only for editing a trip.
        </p>
        <LoginForm />
      </div>
    </div>
  );
}
