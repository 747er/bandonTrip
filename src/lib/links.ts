/** A maps search for an event's venue. Safe to use on the client. */
export function directionsUrl(e: { venue: string; address: string; title: string }): string {
  const query = [e.venue || e.title, e.address].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
