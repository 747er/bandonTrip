// The resort map and where things sit on it. Positions are pixels on
// public/images/map/resort.jpg (the resort's own printed map, cropped to the map area),
// read off its clubhouse stars and numbered dots.

export const RESORT_MAP = { src: "/images/map/resort.jpg", width: 1483, height: 1668 };

export type MapPlace = { id: string; name: string; x: number; y: number };

const place = (id: string, name: string, x: number, y: number): MapPlace => ({ id, name, x, y });

export const PLACES: Record<string, MapPlace> = {
  "sheep-ranch": place("sheep-ranch", "Sheep Ranch clubhouse", 713, 177),
  "old-macdonald": place("old-macdonald", "Old Macdonald clubhouse", 804, 690),
  "ghost-tree": place("ghost-tree", "Ghost Tree Grill", 841, 642),
  "practice-center": place("practice-center", "Practice Center", 810, 866),
  "pacific-dunes": place("pacific-dunes", "Pacific Dunes clubhouse", 731, 960),
  "bandon-dunes": place("bandon-dunes", "Bandon Dunes clubhouse", 657, 1101),
  "main-lodge": place("main-lodge", "Main Lodge", 662, 1140),
  "the-inn": place("the-inn", "The Inn", 697, 1161),
  "lily-pond": place("lily-pond", "Lily Pond Cottages", 721, 1185),
  "round-lake": place("round-lake", "Round Lake", 741, 1245),
  "grove-cottages": place("grove-cottages", "Grove Cottages", 855, 1190),
  "chrome-lake": place("chrome-lake", "Chrome Lake Cottages", 878, 1133),
  "bandon-trails": place("bandon-trails", "Bandon Trails clubhouse", 645, 1236),
  shortys: place("shortys", "Shorty's", 626, 1524),
};

/** Names a schedule or lodging entry might use, and the place each one is at. */
const ALIASES: [RegExp, string][] = [
  [/sheep ranch/, "sheep-ranch"],
  [/ghost tree/, "ghost-tree"],
  [/old mac/, "old-macdonald"],
  [/punchbowl|pacific grill|pacific dunes/, "pacific-dunes"],
  [/trails end|bandon trails|preserve/, "bandon-trails"],
  [/shortys/, "shortys"],
  [/charlottes|practice cent/, "practice-center"],
  [/mckees|bandon dunes|bunker bar|forge|puffin/, "bandon-dunes"],
  [/grove/, "grove-cottages"],
  [/chrome lake/, "chrome-lake"],
  [/lily pond/, "lily-pond"],
  [/round lake/, "round-lake"],
  [/\binn\b/, "the-inn"],
  [/lodge/, "main-lodge"],
];

const plain = (text: string) => text.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

/** The place a name refers to, or null when it isn't on the map. */
export function placeFor(...names: (string | null | undefined)[]): string | null {
  for (const name of names) {
    if (!name) continue;
    const text = plain(name);
    // "Bandon Dunes Golf Resort" is the whole property, not the Bandon Dunes clubhouse.
    if (/golf resort/.test(text)) continue;
    const hit = ALIASES.find(([pattern]) => pattern.test(text));
    if (hit) return hit[1];
  }
  return null;
}
