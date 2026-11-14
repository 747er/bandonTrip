# Trip photos

Drop image files into these folders and they appear on the site. No code changes: the
folder and file name decide where a photo shows. `.jpg`, `.jpeg`, `.png`, `.webp` and
`.avif` all work. Until a file exists, its slot shows a quiet tonal gradient.

| Path | Where it shows | Shape it is cropped to | Suggested size |
| --- | --- | --- | --- |
| `hero/bandon-coast.jpg` | Home page cover | Wide on desktop, near square on phones | 2800 px wide or more |
| `courses/old-macdonald.jpg` | Home course feature, Schedule (Thursday) | Landscape, roughly 3:2 | 2000 px wide or more |
| `courses/pacific-dunes.jpg` | Home course card, Schedule (Friday) | Landscape; portrait on phones | 2000 px |
| `courses/bandon-trails.jpg` | Home course card, Schedule (Saturday) | Landscape; portrait on phones | 2000 px |
| `courses/bandon-dunes.jpg` | Home panorama, Schedule (Sunday) | Very wide, roughly 3:1 | 2400 px |
| `dining/trails-end.jpg` | Dining rows, Schedule | Small square thumbnail | 800 px |
| `dining/pacific-grill.jpg` | Dining rows, Schedule | Small square thumbnail | 800 px |
| `dining/ghost-tree.jpg` | Dining rows, Schedule | Small square thumbnail | 800 px |
| `activities/shortys.jpg` | Between-rounds row, Schedule | Small square thumbnail | 800 px |
| `activities/punchbowl.jpg` | Between-rounds row, Schedule | Small square thumbnail | 800 px |

Events added later follow the same rule: golf goes in `courses/`, meals in `dining/`,
everything else in `activities/`, named after the event title in lowercase with dashes
("Sheep Ranch" becomes `courses/sheep-ranch.jpg`).

Every photo is cropped to fill its frame, and text sits over the lower left of the hero
and the course photos, so pictures with a calm lower third work best.

## Framing and credits (optional)

Add `images.json` in this folder to choose which part of a photo survives cropping, or
to show a photographer credit:

```json
{
  "hero/bandon-coast": { "position": "50% 70%", "credit": "Jane Doe" },
  "courses/pacific-dunes": { "position": "30% 50%" }
}
```

`position` is a CSS `object-position` value: the first number moves the crop left (0%)
to right (100%), the second top (0%) to bottom (100%). Without it the hero and courses
favour the ground over the sky, and thumbnails are centred.

New and replaced photos show up on refresh in development. A deploy picks up whatever
is committed here.

Only use photographs you have the right to publish.
