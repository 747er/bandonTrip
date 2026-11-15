"use client";

import { Children, useRef, useState } from "react";

/**
 * A swipeable row for phones that says where you are in it ("02 / 04"). From `md` up the
 * same children lay out as whatever grid `className` gives the track, and the counter
 * goes away.
 */
export function Carousel({
  children,
  className = "",
  label,
}: {
  children: React.ReactNode;
  /** Classes for the scrolling track */
  className?: string;
  label: string;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const count = Children.count(children);
  const two = (n: number) => String(n).padStart(2, "0");

  const onScroll = () => {
    const el = track.current;
    if (!el) return;
    // Whichever card's centre is nearest the middle of the track is the current one.
    const middle = el.scrollLeft + el.clientWidth / 2;
    let best = 0;
    let distance = Infinity;
    Array.from(el.children).forEach((child, i) => {
      const c = child as HTMLElement;
      if (c.offsetWidth === 0) return; // hidden at this width
      const d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - middle);
      if (d < distance) {
        distance = d;
        best = i;
      }
    });
    // Count only the cards that are showing.
    const shown = Array.from(el.children).filter((c) => (c as HTMLElement).offsetWidth > 0);
    setIndex(Math.max(0, shown.indexOf(el.children[best])));
  };

  const go = (by: number) => {
    const el = track.current;
    if (!el) return;
    const shown = Array.from(el.children).filter(c => (c as HTMLElement).offsetWidth > 0) as HTMLElement[];
    const next = shown[Math.max(0, Math.min(shown.length - 1, index + by))];
    if (next) el.scrollTo({left: next.offsetLeft - el.offsetLeft - (el.clientWidth - next.offsetWidth) / 2,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth"});
  };

  return (
    <div>
      <div ref={track} onScroll={onScroll} role="group" aria-label={label} className={className}>
        {children}
      </div>
      <div className="mt-3 flex items-center gap-4 px-5 md:hidden">
        <p className="figures text-label font-semibold">
          {two(index + 1)} <span className="font-normal text-moss">/ {two(count)}</span>
        </p>
        <div className="h-px flex-1 bg-rule">
          <div
            className="h-[2px] -translate-y-px bg-forest transition-[width] duration-300 ease-settle"
            style={{ width: `${((index + 1) / count) * 100}%` }}
          />
        </div>
        <div className="flex gap-1">
          {[-1, 1].map(by => <button key={by} type="button" aria-label={by < 0 ? "Previous course" : "Next course"}
            disabled={by < 0 ? index === 0 : index >= count - 1} onClick={() => go(by)}
            className="flex h-11 w-11 items-center justify-center border border-rule transition-colors enabled:hover:bg-paper disabled:opacity-30">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d={by < 0 ? "M10 3L5 8l5 5" : "M6 3l5 5-5 5"} /></svg>
          </button>)}
        </div>
      </div>
    </div>
  );
}
