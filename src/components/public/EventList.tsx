import { clock } from "@/lib/time";
import type { PublicEvent } from "@/lib/trip";

const TYPE_LABEL: Record<PublicEvent["type"], string> = {
  golf: "Golf",
  dining: "Dining",
  activity: "Activity",
  lodging: "Lodging",
  custom: "",
};

/** One plain line describing who and what: "Golf, tee times until 11:10 AM". */
export function eventSummary(e: PublicEvent): string {
  const bits: string[] = [];
  if (e.type === "golf") {
    bits.push(e.endTime && e.endTime !== e.startTime ? `Tee times until ${clock(e.endTime)}` : "Golf");
  } else if (TYPE_LABEL[e.type]) {
    bits.push(TYPE_LABEL[e.type]);
  }
  if (e.partySize) bits.push(`party of ${e.partySize}`);
  if (e.audience.kind === "group") bits.push(e.audience.name);
  if (e.audience.kind === "people") {
    bits.push(`${e.audience.ids.length} ${e.audience.ids.length === 1 ? "golfer" : "golfers"}`);
  }
  const line = bits.join(", ");
  return line.charAt(0).toUpperCase() + line.slice(1);
}
