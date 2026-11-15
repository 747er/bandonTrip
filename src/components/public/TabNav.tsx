"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const icons = {
  home: (
    <>
      <path d="M11 19V4.5" />
      <path d="M11 5l7 2.6L11 10.5" />
      <path d="M4 19.5c2.4-1.4 4.6-2 7-2s4.6.6 7 2" />
    </>
  ),
  schedule: <path d="M4 6.5h14M4 11.5h14M4 16.5h9" />,
  scores: <path d="M5 18V11M11 18V5M17 18v-9" />,
  crew: (
    <>
      <circle cx="8" cy="8" r="3" />
      <path d="M2.5 18c.6-3 2.7-4.6 5.5-4.6s4.9 1.6 5.5 4.6" />
      <path d="M14.5 5.2a3 3 0 010 5.6M16.5 13.8c1.6.6 2.7 2 3.1 4.2" />
    </>
  ),
};

export function TabNav({
  slug,
  title,
  canEdit,
}: {
  slug: string;
  title: string;
  canEdit: boolean;
}) {
  const pathname = usePathname();
  const base = `/t/${slug}`;
  const tabs = [
    { href: base, label: "Home", icon: icons.home },
    { href: `${base}/schedule`, label: "Schedule", icon: icons.schedule },
    { href: `${base}/scores`, label: "Scores", icon: icons.scores },
    { href: `${base}/crew`, label: "Crew", icon: icons.crew },
  ];
  const isActive = (href: string) => (href === base ? pathname === base : pathname.startsWith(href));
  // The home page opens on a photograph, so its masthead is set in light type.
  const onCover = pathname === base;
  const ink = onCover ? "text-paper" : "text-forest-deep";

  return (
    <>
      <div className="flex h-14 items-center justify-between gap-8 px-5 md:h-20 md:justify-start md:px-10">
        <Link href={base} className={`serif text-[17px] italic ${ink}`}>
          {onCover ? "BandonTrip" : title}
        </Link>

        <nav aria-label="Trip" className="hidden md:block">
          <ul className="flex gap-8">
            {tabs.map((tab) => {
              const active = isActive(tab.href);
              return (
                <li key={tab.href}>
                  <Link
                    href={tab.href}
                    aria-current={active ? "page" : undefined}
                    className={`inline-flex h-11 items-center border-b text-[15px] font-medium transition-colors ${ink} ${
                      active
                        ? onCover
                          ? "border-copper-light"
                          : "border-copper"
                        : "border-transparent opacity-75 hover:opacity-100"
                    }`}
                  >
                    {tab.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {canEdit && (
          <Link
            href="/admin"
            className={`text-[13px] font-medium underline underline-offset-4 md:ml-auto ${ink} ${
              onCover ? "decoration-copper-light" : "decoration-copper"
            }`}
          >
            Edit trip
          </Link>
        )}
      </div>

      {/* Phones: a thumb-reach bar. */}
      <nav
        aria-label="Trip"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-rule bg-paper/92 backdrop-blur-md md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="mx-auto grid max-w-md grid-cols-4">
          {tabs.map((tab) => {
            const active = isActive(tab.href);
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex h-[60px] flex-col items-center justify-center gap-1 text-[11.5px] font-medium tracking-[0.01em] transition-colors ${
                    active ? "text-forest" : "text-moss"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`absolute top-0 h-[2px] w-8 bg-copper transition-transform duration-300 ${
                      active ? "scale-x-100" : "scale-x-0"
                    }`}
                  />
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 22 22"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={active ? 1.7 : 1.35}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    {tab.icon}
                  </svg>
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
