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
  weather: (
    <>
      <path d="M3 8.5h9.5a2.5 2.5 0 10-2.4-3.2" />
      <path d="M3 12h13.5a2.5 2.5 0 11-2.4 3.2" />
      <path d="M3 15.5h6" />
    </>
  ),
  packing: (
    <>
      <path d="M5 8.5h12v9.5a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 015 18z" />
      <path d="M8.5 8.5V6a2.5 2.5 0 015 0v2.5M5 13h12" />
    </>
  ),
};

export function TabNav({
  title,
}: {
  title: string;
}) {
  const pathname = usePathname();
  const base = "/";
  const tabs = [
    { href: base, label: "Home", icon: icons.home },
    { href: "/schedule", label: "Schedule", icon: icons.schedule },
    { href: "/wind", label: "Wind", icon: icons.weather },
    { href: "/packing", label: "Packing", icon: icons.packing },
  ];
  const isActive = (href: string) => (href === base ? pathname === base : pathname.startsWith(href));
  // The home page opens on a photograph, so its masthead is set in light type.
  const onCover = pathname === base || pathname === "/wind" || pathname.startsWith("/courses/");
  const ink = onCover ? "text-paper" : "text-forest-deep";

  return (
    <>
      {/* The wind map wants the whole phone screen: there the bottom bar is the only navigation. */}
      <div
        className={`trip-masthead h-14 items-center justify-between gap-8 px-5 md:flex md:h-20 md:justify-start md:px-10 ${
          // On phones the wind map wants the whole screen, and Home sets the trip's
          // name at the top of its photograph instead.
          pathname === "/wind" || pathname === base ? "hidden" : "flex"
        }`}
      >
        <Link href={base} className={`serif text-[17px] italic ${ink}`}>
          {onCover ? "BandonTrip" : title}
        </Link>

        <nav aria-label="Trip" className="trip-desktop-nav hidden md:block">
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

      </div>

      {/* Phones: a thumb-reach bar. */}
      <nav
        aria-label="Trip"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-rule bg-paper/88 backdrop-blur-lg md:hidden"
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
                  className={`relative flex h-[66px] flex-col items-center justify-center gap-1 text-[12.5px] transition-colors ${
                    active ? "font-semibold text-forest-deep" : "font-medium text-moss"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`absolute top-0 h-[2px] w-7 bg-copper transition-transform duration-300 ${
                      active ? "scale-x-100" : "scale-x-0"
                    }`}
                  />
                  <svg
                    width="24"
                    height="24"
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
