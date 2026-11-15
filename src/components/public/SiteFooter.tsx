"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { contours } from "./contours";
import { OPEN_WHO } from "./WhoSheet";

// One drawing for a tall, narrow footer (phones) and one for a wide, shallow one.
const TALL = [...contours(330, 90, 9, 36, 0.9), ...contours(40, 560, 8, 40, 2.6)];
const WIDE = [...contours(1160, 150, 10, 46, 0.9), ...contours(170, 600, 9, 50, 2.6)];

/**
 * The close of every page but the wind map: the green field from the cover returns along a curve, carrying
 * the links to the trip's pages and the site's note, with contour lines running through
 * the whole of it.
 */
export function SiteFooter({ slug, viewer }: { slug: string; viewer: string | null }) {
  // The wind map is a full-screen tool: it ends where the map ends.
  const pathname = usePathname();
  if (pathname === `/t/${slug}/weather`) return null;
  const links = [
    { href: `/t/${slug}/schedule`, name: "Schedule", detail: "Day by day, with the resort map" },
    { href: `/t/${slug}/weather`, name: "Wind map", detail: "Hour by hour, with daylight" },
    { href: `/t/${slug}/packing`, name: "Packing list", detail: "The resort's advice as a checklist" },
  ];
  return (
    <footer
      className="on-forest relative mt-28 text-limestone md:mt-40"
      style={{ background: "linear-gradient(to bottom, #1b3d31 0%, #17332b 40%, #10261f 100%)" }}
    >
      <svg
        aria-hidden="true"
        className="absolute inset-x-0 bottom-[calc(100%-1px)] block h-20 w-full md:h-32"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <path d="M0 0 C 26 58 68 40 100 100 L 100 101 L 0 101 Z" fill="#1b3d31" />
        <path d="M0 0 C 26 58 68 40 100 100" fill="none" stroke="#d99a6c" strokeWidth="1.25" opacity="0.65" vectorEffect="non-scaling-stroke" />
      </svg>
      {/* Contour lines in a warm sand, across the whole footer. */}
      <svg aria-hidden="true" className="absolute inset-0 hidden h-full w-full opacity-[0.16] md:block" viewBox="0 0 1440 660" preserveAspectRatio="xMidYMid slice" fill="none" stroke="#cbbb97" strokeWidth="1">
        {WIDE.map((points, n) => (
          <polygon key={n} points={points} vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      <svg aria-hidden="true" className="absolute inset-0 h-full w-full opacity-[0.14] md:hidden" viewBox="0 0 400 640" preserveAspectRatio="xMidYMid slice" fill="none" stroke="#cbbb97" strokeWidth="1">
        {TALL.map((points, n) => (
          <polygon key={n} points={points} vectorEffect="non-scaling-stroke" />
        ))}
      </svg>

      <div className="relative mx-auto w-full max-w-6xl px-5 pb-28 pt-4 md:px-10 md:pb-14 md:pt-6">
        <nav aria-labelledby="essentials" className="grid gap-x-12 md:grid-cols-[14rem_1fr]">
          <h2 id="essentials" className="display text-[34px] md:text-[40px]">
            Trip essentials
          </h2>
          <ul className="mt-4 divide-y divide-rule-light border-y border-rule-light md:mt-0">
            {links.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="group flex min-h-[4.75rem] items-center gap-4 py-4">
                  <span className="min-w-0 flex-1">
                    <span className="serif block text-[23px] leading-tight group-hover:text-copper-light">{link.name}</span>
                    <span className="mt-1 block text-meta text-mist">{link.detail}</span>
                  </span>
                  <svg width="9" height="16" viewBox="0 0 8 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-copper-light" aria-hidden="true">
                    <path d="M1 1l6 6-6 6" />
                  </svg>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="mt-12 text-[13px] leading-relaxed text-mist md:mt-16">
          {viewer && (
            <p className="mb-6 text-meta text-limestone">
              Viewing as <span className="font-semibold">{viewer}</span>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new Event(OPEN_WHO))}
                className="ml-3 font-semibold underline decoration-copper-light decoration-1 underline-offset-[5px] hover:text-copper-light"
              >
                Switch
              </button>
            </p>
          )}
          <p className="serif text-[15px] italic text-limestone">BandonTrip</p>
          <p className="mt-2 max-w-md">
            Made by golfers for their own trip. An independent site, not affiliated with or
            endorsed by Bandon Dunes Golf Resort.
          </p>
        </div>
      </div>
    </footer>
  );
}
