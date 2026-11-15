"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { contours } from "./contours";

const WIDE = [...contours(1180, 140, 11, 48, 0.9), ...contours(150, 760, 10, 52, 2.6)];
const TALL = [...contours(330, 120, 10, 38, 0.9), ...contours(30, 700, 9, 42, 2.6)];

/** The name of the event other parts of the page fire to ask for the sheet. */
export const OPEN_WHO = "bt:who";

/** Keep the choice on this device for a year. */
function remember(cookie: string, id: string) {
  document.cookie = `${cookie}=${id}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}

/**
 * Who is looking. A full-screen sheet over the page asks once, remembers the answer in a
 * cookie on this device, and lifts away. The chosen name then sits at the top right of
 * every page, and choosing it brings the sheet back to change it.
 */
export function WhoSheet({
  roster,
  viewer,
  slug,
  cookie,
}: {
  roster: { id: string; name: string }[];
  viewer: { id: string; firstName: string } | null;
  slug: string;
  /** Name of the cookie the server reads the choice from */
  cookie: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  // Open from the first paint when nobody has been chosen yet.
  const [open, setOpen] = useState(!viewer);
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => {
    const show = () => {
      setPicked(null);
      setOpen(true);
    };
    window.addEventListener(OPEN_WHO, show);
    return () => window.removeEventListener(OPEN_WHO, show);
  }, []);

  // The page behind stays put while the sheet is up.
  useEffect(() => {
    document.documentElement.style.overflow = open ? "hidden" : "";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open || !viewer) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, viewer]);

  const choose = (id: string) => {
    setPicked(id);
    remember(cookie, id);
    // Redraw the page behind for this person, then let the sheet go.
    router.refresh();
    setTimeout(() => setOpen(false), 380);
  };

  const base = `/t/${slug}`;
  const onPhoto = pathname === base || pathname === `${base}/weather` || pathname.startsWith(`${base}/courses/`);

  return (
    <>
      {viewer && (
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event(OPEN_WHO))}
          aria-haspopup="dialog"
          aria-label={`${viewer.firstName}. Change who is viewing`}
          className={`absolute right-4 top-2.5 z-30 inline-flex min-h-9 items-center gap-2 border px-3 text-label font-semibold backdrop-blur-sm transition-colors md:right-10 md:top-[1.375rem] ${
            onPhoto
              ? "border-paper/45 bg-forest-deep/35 text-paper hover:bg-forest-deep/60"
              : "border-pine/30 text-pine hover:bg-pine/8"
          } ${pathname === `${base}/weather` ? "max-md:hidden" : ""}`}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
            <circle cx="8" cy="5.5" r="2.75" />
            <path d="M2.75 14c.6-2.8 2.6-4.25 5.25-4.25s4.65 1.45 5.25 4.25" />
          </svg>
          {viewer.firstName}
        </button>
      )}

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Who's playing?"
        inert={!open}
        className={`on-forest fixed inset-0 z-50 overflow-y-auto overscroll-contain text-limestone transition-[transform,opacity,visibility] duration-[650ms] ease-settle motion-reduce:transition-none ${
          open ? "visible translate-y-0 opacity-100" : "invisible -translate-y-[6%] opacity-0"
        }`}
        style={{ background: "linear-gradient(to bottom, #1b3d31 0%, #17332b 40%, #10261f 100%)" }}
      >
        <svg aria-hidden="true" className="pointer-events-none absolute inset-0 hidden h-full w-full opacity-[0.15] md:block" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" fill="none" stroke="#cbbb97" strokeWidth="1">
          {WIDE.map((points, n) => (
            <polygon key={n} points={points} vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
        <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.13] md:hidden" viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice" fill="none" stroke="#cbbb97" strokeWidth="1">
          {TALL.map((points, n) => (
            <polygon key={n} points={points} vectorEffect="non-scaling-stroke" />
          ))}
        </svg>

        <div className="relative mx-auto flex min-h-full w-full max-w-6xl flex-col px-5 pb-10 pt-4 md:px-10 md:pb-14 md:pt-7">
          <div className="flex items-center justify-between">
            <p className="serif text-[17px] italic">BandonTrip</p>
            {viewer && (
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="-mr-2 flex h-11 w-11 items-center justify-center text-mist transition-colors hover:text-limestone"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                  <path d="M3 3l10 10M13 3L3 13" />
                </svg>
              </button>
            )}
          </div>

          <div className="my-auto py-8 md:py-12">
            <p className="flex items-center gap-3 text-meta text-mist">
              {viewer ? `You're in as ${viewer.firstName}` : "Bandon 2026"}
              <span aria-hidden="true" className="h-px w-9 bg-copper-light" />
            </p>
            <h2 className="display mt-2 text-[clamp(3rem,11vw,6rem)]">Who&rsquo;s playing?</h2>
            <p className="mt-3 max-w-md text-meta text-mist md:text-ui">
              Choose your name for your tee times, your foursomes and where you&rsquo;re staying.
            </p>

            <ul className="mt-8 columns-2 gap-x-5 md:mt-12 md:columns-3 md:gap-x-10 lg:columns-4">
              {roster.map((person) => {
                const current = viewer?.id === person.id;
                const going = picked === person.id;
                return (
                  <li key={person.id} className="break-inside-avoid border-b border-rule-light">
                    <button
                      type="button"
                      onClick={() => choose(person.id)}
                      aria-current={current ? "true" : undefined}
                      className={`flex min-h-[3.25rem] w-full items-center gap-2.5 py-2 text-left transition-colors hover:text-copper-light ${
                        current || going ? "text-copper-light" : ""
                      }`}
                    >
                      <span className="serif text-[17px] leading-tight md:text-[22px]">{person.name}</span>
                      {(going || (current && !picked)) && (
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
                          <path d="M3 8.5l3.2 3.2L13 4.8" />
                        </svg>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <p className="max-w-md text-[13px] leading-relaxed text-mist">
            Your choice is remembered on this device.
          </p>
        </div>
      </div>
    </>
  );
}
