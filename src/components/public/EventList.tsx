import type { PublicEvent } from "@/lib/trip";

const TYPE_LABEL: Record<PublicEvent["type"], string> = {
  golf: "Golf",
  dining: "Dining",
  activity: "Activity",
  lodging: "Lodging",
  custom: "",
};

/** One plain line describing who and what: "Golf" or "Dining, party of 6". */
export function eventSummary(e: PublicEvent): string {
  const bits: string[] = [];
  if (e.type === "golf") {
    bits.push("Golf");
  } else if (TYPE_LABEL[e.type]) {
    bits.push(TYPE_LABEL[e.type]);
  }
  if (e.partySize) bits.push(`party of ${e.partySize}`);
  if (e.group) bits.push(e.group);
  const line = bits.join(", ");
  return line.charAt(0).toUpperCase() + line.slice(1);
}
