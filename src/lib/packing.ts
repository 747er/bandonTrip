// The packing list, drawn from Bandon Dunes Golf Resort's own published guidance
// (linked in SOURCES and shown on the page). The wording here is ours; the advice is theirs.
// Ids are stable keys for the "packed" ticks saved on each golfer's device: don't rename them.

export type PackingItem = {
  id: string;
  name: string;
  /** "2 pairs", "6", "14 or fewer" */
  quantity?: string;
  note?: string;
};

export type PackingSection = {
  id: string;
  title: string;
  intro?: string;
  items: PackingItem[];
};

export const PACKING: PackingSection[] = [
  {
    id: "feet",
    title: "Shoes and socks",
    intro: "Every course is walking only, so comfort beats style.",
    items: [
      {
        id: "golf-shoes",
        name: "Golf shoes made for walking",
        quantity: "2 pairs",
        note: "Alternate them between rounds. Rooms have shoe dryers, but a dry second pair is easier.",
      },
      {
        id: "socks",
        name: "Extra socks",
        quantity: "A few pairs",
        note: "Change socks between rounds on any day you play 36.",
      },
    ],
  },
  {
    id: "layers",
    title: "Layers",
    intro: "A day on the coast runs through several temperatures. Add a layer, shed a layer.",
    items: [
      {
        id: "base",
        name: "Base layers",
        note: "Synthetic or a blend that moves moisture away. All-cotton holds it.",
      },
      {
        id: "mid",
        name: "Mid layer",
        note: "A vest or wind sweater. One piece with a zipper lets you vent as you warm up.",
      },
      { id: "pants", name: "Long pants" },
      { id: "shorts", name: "Golf shorts", note: "Optional, but the resort says to throw them in." },
      { id: "warm-hat", name: "Stocking cap", note: "For the early tee times." },
    ],
  },
  {
    id: "weather",
    title: "Rain and wind",
    intro: "You may not need any of it. Bring all of it.",
    items: [
      {
        id: "rain-jacket",
        name: "Rain jacket",
        note: "The resort prefers Gore-Tex. Stretchy waterproof knits give up in steady rain.",
      },
      { id: "rain-pants", name: "Waterproof golf pants" },
      { id: "rain-gloves", name: "Rain gloves" },
      { id: "wind-shell", name: "Windproof shell", note: "For when the wind kicks up without the rain." },
    ],
  },
  {
    id: "bag",
    title: "In your golf bag",
    intro:
      "Caddies carry on foot, so every pound counts. The resort asks for a stand bag of about 25 lb or less, and has lighter change-out bags if yours isn't one.",
    items: [
      { id: "clubs", name: "Clubs", quantity: "14 or fewer" },
      { id: "balls", name: "Golf balls", quantity: "6" },
      { id: "water", name: "Water bottle", quantity: "1" },
      { id: "bag-layer", name: "One layering piece", quantity: "1", note: "For weather you didn't see coming." },
      { id: "speaker", name: "Small bluetooth speaker", quantity: "1", note: "Optional." },
    ],
  },
  {
    id: "small",
    title: "Easy to forget",
    items: [
      { id: "lip-balm", name: "Lip balm" },
      { id: "sunblock", name: "Sunblock" },
      {
        id: "duffle",
        name: "Small duffle",
        note: "For spare socks, shoes and layers. Guest services at the course will hold it while you play.",
      },
    ],
  },
];

/** What the resort asks you to take out of the golf bag before a round. */
export const LEAVE_IN_ROOM = [
  "Weighted club",
  "Range finder",
  "Towel",
  "Umbrella",
  "Extra golf shoes",
  "Old bag tags",
];

/** Links-golf club advice from the same guidance: not things to pack, things to consider. */
export const CLUB_NOTES = [
  "High-bounce wedges are hard to hit off Bandon's tight lies. Consider leaving them home.",
  "Bring whatever you hit bump-and-run shots with.",
  "A lower-lofted driver helps keep the ball under the wind and running.",
];

export const SOURCES = [
  {
    label: "From ShipSticks to Packing",
    href: "https://bandondunesgolf.com/blog/from-shipsticks-to-packing-the-right-preparation-goes-a-long-way-at-bandon-dunes/",
  },
  {
    label: "How to prepare for links golf weather",
    href: "https://bandondunesgolf.com/blog/how-to-prepare-for-links-golf-weather/",
  },
  {
    label: "How to pack your golf bag",
    href: "https://bandondunesgolf.com/wp-content/uploads/2024/11/Bag-Illustration.pdf",
  },
];
