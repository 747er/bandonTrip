"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/** Today's date on the trip's clock, "YYYY-MM-DD". */
const tripDate = (timeZone: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

/** How old a page can be when someone comes back to it before it is fetched again. */
const STALE = 10 * 60 * 1000;

/**
 * Keeps a tab left open current. Every page works out "today", "next" and "underway" on the
 * server when it is drawn, so a tab left open overnight would still show yesterday. This
 * fetches the page again (keeping scroll and anything open on it) when the trip's date has
 * changed, and when someone returns to a tab that has sat untouched for a while.
 */
export function KeepCurrent({ timeZone }: { timeZone: string }) {
  const router = useRouter();
  const pathname = usePathname();
  // When the page on screen was drawn, and the trip's date then.
  const drawn = useRef({ date: "", at: 0 });
  useEffect(() => {
    drawn.current = { date: tripDate(timeZone), at: Date.now() };
  }, [pathname, timeZone]);

  useEffect(() => {
    const check = (returning: boolean) => {
      if (document.visibilityState !== "visible") return;
      const date = tripDate(timeZone);
      const stale = date !== drawn.current.date || (returning && Date.now() - drawn.current.at > STALE);
      if (!stale) return;
      drawn.current = { date, at: Date.now() };
      router.refresh();
    };
    const onReturn = () => check(true);
    // Coming back to the tab, the window, or a page restored from the back button's cache.
    document.addEventListener("visibilitychange", onReturn);
    window.addEventListener("focus", onReturn);
    window.addEventListener("pageshow", onReturn);
    // Left open on screen through midnight.
    const tick = setInterval(() => check(false), 60 * 1000);
    return () => {
      document.removeEventListener("visibilitychange", onReturn);
      window.removeEventListener("focus", onReturn);
      window.removeEventListener("pageshow", onReturn);
      clearInterval(tick);
    };
  }, [router, timeZone]);

  return null;
}
