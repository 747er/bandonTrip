"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

/** Submit button that reports its own progress: "Save" → "Saving…" → "Saved". */
export function SubmitButton({
  children = "Save",
  className = "btn btn-primary",
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  const { pending } = useFormStatus();
  const wasPending = useRef(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (wasPending.current && !pending) {
      const show = setTimeout(() => setSaved(true), 0);
      const hide = setTimeout(() => setSaved(false), 1800);
      wasPending.current = false;
      return () => {
        clearTimeout(show);
        clearTimeout(hide);
      };
    }
    wasPending.current = pending;
  }, [pending]);

  return (
    <button type="submit" className={className} disabled={pending} aria-live="polite">
      {pending ? "Saving…" : saved ? "Saved" : children}
    </button>
  );
}

/** Destructive submit that asks first. */
export function ConfirmButton({
  children,
  message,
  className = "btn btn-danger",
}: {
  children: React.ReactNode;
  message: string;
  className?: string;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}

export function AdminTabs({ tripId }: { tripId: string }) {
  const pathname = usePathname();
  const base = `/admin/trips/${tripId}`;
  const tabs = [
    { href: base, label: "Details" },
    { href: `${base}/schedule`, label: "Schedule" },
    { href: `${base}/crew`, label: "Crew" },
    { href: `${base}/scores`, label: "Scores" },
  ];
  return (
    <nav aria-label="Trip sections" className="-mb-px flex gap-1 overflow-x-auto">
      {tabs.map((t) => {
        const active = t.href === base ? pathname === base : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`border-b-2 px-3 py-2.5 text-[13px] font-semibold ${
              active
                ? "border-[#17332b] text-zinc-900"
                : "border-transparent text-zinc-500 hover:text-zinc-900"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Copies the public link; the organizer's most common errand. */
export function CopyLink({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn"
      onClick={async () => {
        await navigator.clipboard.writeText(`${window.location.origin}${path}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }}
    >
      {copied ? "Copied" : "Copy link"}
    </button>
  );
}
