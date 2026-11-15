// The four courses we play. Designer, opening year, par and yardage come from Bandon
// Dunes Golf Resort's own course pages (linked as `source`); par and yardage are the
// totals of the hole-by-hole listing there. The descriptions are ours, written from
// what those pages say. `id` matches the round's title in src/data/trip.ts.

export type Course = {
  id: string;
  name: string;
  designer: string;
  opened: number;
  par: number;
  /** Total of the yardages the resort lists hole by hole */
  yards: number;
  par3s: number;
  par5s: number;
  /** One paragraph: what the course is */
  intro: string;
  /** Short, practical: what to expect out there */
  expect: string[];
  /** What is at or beside the clubhouse */
  clubhouse: string;
  source: string;
};

export const COURSES: Course[] = [
  {
    id: "old-macdonald",
    name: "Old Macdonald",
    designer: "Tom Doak and Jim Urbina",
    opened: 2010,
    par: 71,
    yards: 6944,
    par3s: 4,
    par5s: 3,
    intro:
      "The resort's fourth course is a tribute to the course architect Charles Blair Macdonald. Doak and Urbina asked what Macdonald would have built had the Oregon coast been his canvas, and answered with his classic hole templates laid over open linksland.",
    expect: [
      "Enormous greens. Finding the putting surface is the easy part; being on the right section of it is the round.",
      "Wide fairways with many ways to play each hole. The best angle depends on where the flag is.",
      "Deep, fierce bunkers, and holes named for the templates they borrow: Double Plateau, Eden, Sahara, Biarritz, Cape.",
    ],
    clubhouse: "The Old Macdonald clubhouse sits beside Ghost Tree Grill.",
    source: "https://bandondunesgolf.com/golf/golf-courses/old-macdonald-golf-course/",
  },
  {
    id: "pacific-dunes",
    name: "Pacific Dunes",
    designer: "Tom Doak",
    opened: 2001,
    par: 71,
    yards: 6633,
    par3s: 5,
    par5s: 4,
    intro:
      "The resort says Pacific Dunes feels less built than discovered. Its rippling fairways were left as they were found and its bunkers are natural, on a routing that comes out of the shore pines onto 60-foot sand dunes.",
    expect: [
      "Short enough to give you hope, rugged enough to test everything. Yardage matters less here than the wind.",
      "When it blows, precise approach shots are the whole game.",
      "An unusual card: five par 3s and four par 5s.",
    ],
    clubhouse: "Pacific Grill and the Punchbowl putting course are at the Pacific Dunes clubhouse.",
    source: "https://bandondunesgolf.com/golf/golf-courses/pacific-dunes-golf-course/",
  },
  {
    id: "bandon-trails",
    name: "Bandon Trails",
    designer: "Bill Coore and Ben Crenshaw",
    opened: 2005,
    par: 71,
    yards: 6788,
    par3s: 4,
    par5s: 3,
    intro:
      "The third course, and the inland one. Coore and Crenshaw start it on top of a massive sand dune, open it into a sprawling meadow, climb into the coastal forest, and bring it back to the dunes to finish.",
    expect: [
      "Three landscapes in one walk: dunes, meadow, then forest.",
      "The middle of the round plays up in the coastal forest, away from the open ground of the other three.",
      "A good walk. The resort calls it enjoyable on foot, and the routing keeps changing the view.",
    ],
    clubhouse: "Trails End is in the Bandon Trails clubhouse, which it shares with Bandon Preserve.",
    source: "https://bandondunesgolf.com/golf/golf-courses/bandon-trails-golf-course/",
  },
  {
    id: "bandon-dunes",
    name: "Bandon Dunes",
    designer: "David McLay Kidd",
    opened: 1999,
    par: 72,
    yards: 7212,
    par3s: 4,
    par5s: 4,
    intro:
      "Where it all began. The original course sits on a bluff high above the Pacific, on a routing that heads out along native dunes, opens to the ocean again and again, and turns for home at the centre of the resort.",
    expect: [
      "Ocean views that keep arriving through the round.",
      "The resort calls it a thinker's course. The wind is always there, and it is a different course each time you play it.",
      "The longest of our four on the card.",
    ],
    clubhouse: "The course starts and finishes by the Main Lodge, with McKee's Pub close by.",
    source: "https://bandondunesgolf.com/golf/golf-courses/bandon-dunes/",
  },
];

export const courseById = (id: string) => COURSES.find((c) => c.id === id) ?? null;
