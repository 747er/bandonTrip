// A small catalog of the resort's courses, matched by name. Published facts only:
// who designed the course and when it opened. Unknown venues simply get no entry.

export type CourseFacts = { designer: string; opened: number; note?: string };

const COURSES: Record<string, CourseFacts> = {
  "bandon dunes": { designer: "David McLay Kidd", opened: 1999 },
  "pacific dunes": { designer: "Tom Doak", opened: 2001 },
  "bandon trails": { designer: "Bill Coore and Ben Crenshaw", opened: 2005 },
  "old macdonald": { designer: "Tom Doak and Jim Urbina", opened: 2010 },
};

export function courseFacts(name: string): CourseFacts | null {
  return COURSES[name.trim().toLowerCase()] ?? null;
}
