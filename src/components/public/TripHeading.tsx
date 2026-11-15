import type { ReactNode } from "react";

/** A consistent opening for the trip's practical tools. */
export function TripHeading({ title, dates, children }: { title: string; dates: string; children?: ReactNode }) {
  return (
    <header className="trip-heading">
      <div className="trip-heading-title"><h1 className="display">{title}</h1><p className="figures">{dates}</p></div>
      {children && <div className="trip-heading-description">{children}</div>}
    </header>
  );
}
