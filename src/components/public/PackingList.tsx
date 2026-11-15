"use client";

import { useEffect, useState } from "react";
import type { PackingSection } from "@/lib/packing";

/**
 * The checklist. Ticks are kept on this device only (no account, nothing sent anywhere),
 * so each golfer has their own list.
 */
export function PackingList({ sections, storageKey }: { sections: PackingSection[]; storageKey: string }) {
  const [packed, setPacked] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const load = setTimeout(() => {
      try {
        const saved = JSON.parse(window.localStorage.getItem(storageKey) ?? "[]");
        if (Array.isArray(saved)) setPacked(new Set(saved.filter((x) => typeof x === "string")));
      } catch {}
      setReady(true);
    }, 0);
    return () => clearTimeout(load);
  }, [storageKey]);

  const save = (next: Set<string>) => {
    setPacked(next);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify([...next]));
    } catch {}
  };
  const toggle = (id: string) => {
    const next = new Set(packed);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    save(next);
  };

  const all = sections.flatMap((s) => s.items);
  const done = all.filter((i) => packed.has(i.id)).length;
  const finished = done === all.length;

  return (
    <div>
      <div className="sticky top-0 z-10 -mx-5 flex items-center justify-between gap-4 bg-limestone/95 px-5 py-3 backdrop-blur-sm md:mx-0 md:px-0">
        <div className="min-w-0 flex-1">
          <p className="figures text-ui font-semibold" aria-live="polite">
            {finished ? "All packed" : `${done} of ${all.length} packed`}
          </p>
          <div className="mt-2 h-1.5 overflow-hidden bg-pine/12" aria-hidden="true">
            <div
              className="h-full bg-forest transition-[width] duration-300 ease-settle"
              style={{ width: `${ready ? (done / all.length) * 100 : 0}%` }}
            />
          </div>
        </div>
        <button
          type="button"
          className="action shrink-0 disabled:opacity-40"
          disabled={done === 0}
          onClick={() => save(new Set())}
        >
          Start over
        </button>
      </div>

      <div className="mt-6 space-y-12">
        {sections.map((section) => {
          const left = section.items.filter((i) => !packed.has(i.id)).length;
          return (
            <section key={section.id} aria-labelledby={`pack-${section.id}`}>
              <div className="flex items-baseline justify-between gap-4">
                <h2 id={`pack-${section.id}`} className="display text-[34px] md:text-[40px]">
                  {section.title}
                </h2>
                <p className="figures shrink-0 text-meta text-moss">{left === 0 ? "Done" : `${left} to go`}</p>
              </div>
              {section.intro && <p className="mt-2 max-w-prose text-meta text-moss">{section.intro}</p>}
              <ul className="mt-4 divide-y divide-rule border-y border-rule">
                {section.items.map((item) => {
                  const on = packed.has(item.id);
                  return (
                    <li key={item.id}>
                      <label className="flex min-h-[4rem] cursor-pointer items-start gap-4 py-4">
                        <input
                          type="checkbox"
                          className="peer sr-only"
                          checked={on}
                          onChange={() => toggle(item.id)}
                        />
                        <span
                          aria-hidden="true"
                          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center border-[1.5px] transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-copper ${
                            on ? "border-forest bg-forest text-limestone" : "border-pine/50 bg-paper"
                          }`}
                        >
                          {on && (
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 8.5l3.2 3.2L13 4.8" />
                            </svg>
                          )}
                        </span>
                        <span className={`min-w-0 flex-1 transition-opacity ${on ? "opacity-55" : ""}`}>
                          <span className={`serif block text-[21px] leading-tight ${on ? "line-through decoration-1" : ""}`}>
                            {item.name}
                          </span>
                          {item.note && <span className="mt-1 block text-meta text-moss">{item.note}</span>}
                        </span>
                        {item.quantity && (
                          <span className={`figures max-w-[7.5rem] shrink-0 text-right text-ui font-semibold ${on ? "opacity-55" : ""}`}>
                            {item.quantity}
                          </span>
                        )}
                      </label>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
