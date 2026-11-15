"use client";

import { useEffect, useState } from "react";
import type { PackingSection } from "@/lib/packing";

/**
 * The checklist. Ticks are kept on this device only (no account, nothing sent anywhere),
 * so each golfer has their own list.
 */
export function PackingList({ sections, storageKey }: { sections: PackingSection[]; storageKey: string }) {
  const [packed, setPacked] = useState<Set<string>>(new Set());
  const [undo, setUndo] = useState<Set<string> | null>(null);
  const [ready, setReady] = useState(false);
  const [remainingOnly, setRemainingOnly] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  useEffect(() => {
    const load = setTimeout(() => {
      try {
        const saved = JSON.parse(window.localStorage.getItem(storageKey) ?? "[]");
        if (Array.isArray(saved)) setPacked(new Set(saved.filter((x) => typeof x === "string")));
      } catch { setSaveFailed(true); }
      setReady(true);
    }, 0);
    return () => clearTimeout(load);
  }, [storageKey]);

  const save = (next: Set<string>) => {
    setPacked(next);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify([...next]));
      setSaveFailed(false);
    } catch { setSaveFailed(true); }
  };
  const toggle = (id: string) => {
    const next = new Set(packed);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setUndo(null);
    save(next);
    if (remainingOnly && next.has(id)) {
      const inputs = [...document.querySelectorAll<HTMLInputElement>(".packing-row input")];
      const index = inputs.findIndex(input => input.id === `item-${id}`);
      const nextId = inputs[index + 1]?.id ?? inputs[index - 1]?.id;
      requestAnimationFrame(() => nextId ? document.getElementById(nextId)?.focus() : document.getElementById("packing-filter-remaining")?.focus());
    }
  };

  const all = sections.flatMap((s) => s.items);
  const done = all.filter((i) => packed.has(i.id)).length;
  const finished = done === all.length;

  return (
    <div className="packing-workspace">
      <div className="packing-toolbar">
        <div className="packing-progress-heading">
          <p className="figures" aria-live="polite"><strong>{ready ? done : "–"}</strong><span> / {all.length}<span className="block text-meta">{finished ? "All packed. Ready for Bandon." : "items packed"}</span></span></p>
          <button type="button" className="action disabled:opacity-40" disabled={!ready || done === 0} onClick={() => { setUndo(new Set(packed)); save(new Set()); }}>Start over</button>
        </div>
        <div className="packing-progress" role="progressbar" aria-label="Packing progress" aria-valuemin={0} aria-valuemax={all.length} aria-valuenow={done}>
          {sections.map(section => <span key={section.id} style={{ flex: section.items.length }}><i style={{ width: `${section.items.filter(item => packed.has(item.id)).length / section.items.length * 100}%` }} /></span>)}
        </div>
        <div className="packing-filter" role="group" aria-label="Show checklist items">
          <button type="button" aria-pressed={!remainingOnly} onClick={() => setRemainingOnly(false)}>All items <span>{all.length}</span></button>
          <button id="packing-filter-remaining" type="button" aria-pressed={remainingOnly} onClick={() => setRemainingOnly(true)}>Still to pack <span>{all.length - done}</span></button>
          <span className="packing-save-state">{!ready ? "Loading checks…" : saveFailed ? "Not saved" : "Saved on this device"}</span>
        </div>
      </div>
      {saveFailed && <p className="py-3 text-meta" role="status">Your browser couldn’t save these changes. Keep this page open to retain your checks.</p>}
      <nav className="packing-index" aria-label="Packing categories">
        {sections.filter(section => !remainingOnly || section.items.some(item => !packed.has(item.id))).map(section => <a href={`#pack-${section.id}`} key={section.id}>{section.title}<span>{section.items.filter(i => packed.has(i.id)).length}/{section.items.length}</span></a>)}
      </nav>
      {remainingOnly && finished && <div className="packing-complete"><h2 className="display">You’re all packed.</h2><p>Every item is checked. You can review everything in All items.</p><button type="button" className="action" onClick={() => setRemainingOnly(false)}>Review all items</button></div>}
      {undo && <div className="flex items-center justify-between border-b border-rule py-2 text-meta" role="status"><span>Checklist cleared.</span><button type="button" className="action" onClick={() => { save(undo); setUndo(null); }}>Undo</button></div>}
      <div className="mt-6 space-y-12">
        {sections.map((section) => {
          const left = section.items.filter((i) => !packed.has(i.id)).length;
          if (remainingOnly && left === 0) return null;
          return (
            <section className="packing-section" key={section.id} aria-labelledby={`pack-${section.id}`}>
              <div className="flex items-baseline justify-between gap-4">
                <h2 id={`pack-${section.id}`} className="display text-[34px] md:text-[40px]">
                  {section.title}
                </h2>
                <p className="figures shrink-0 text-meta text-moss">{left === 0 ? "Done" : `${left} to go`}</p>
              </div>
              {section.intro && <p className="mt-2 max-w-prose text-meta text-moss">{section.intro}</p>}
              <ul className="mt-4 divide-y divide-rule border-y border-rule">
                {section.items.filter(item => !remainingOnly || !packed.has(item.id)).map((item) => {
                  const on = packed.has(item.id);
                  return (
                    <li key={item.id}>
                      <label className="packing-row flex min-h-[4rem] cursor-pointer items-start gap-4 py-4">
                        <input
                          id={`item-${item.id}`}
                          type="checkbox"
                          disabled={!ready}
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
                        <span className={`min-w-0 flex-1 transition-opacity ${on ? "text-moss" : ""}`}>
                          <span className={`serif block text-[21px] leading-tight ${on ? "line-through decoration-1" : ""}`}>
                            {item.name}
                          </span>
                          {item.note && <span className="mt-1 block text-meta text-moss">{item.note}</span>}
                        </span>
                        {item.quantity && (
                          <span className={`figures max-w-[7.5rem] shrink-0 text-right text-ui font-semibold ${on ? "text-moss" : ""}`}>
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
