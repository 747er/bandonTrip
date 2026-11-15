import "server-only";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import generated from "./photos.generated.json";

// Photos live under public/images, one folder per kind, named after what they show
// (see the README there). In production the list comes from a manifest written at build
// time; in development the folders are read on each request so a dropped-in file appears
// on refresh. Nothing here needs a code change to replace a photo.

export type Photo = {
  src: string;
  credit: string | null;
  /** CSS object-position: which part of the photo survives cropping */
  position: string;
};

type Meta = Record<string, { credit?: string; position?: string }>;
/** `files` are paths under public/images with a version suffix: "courses/x.jpg?v=abc" */
type Manifest = { files: string[]; meta: Meta };

export const HERO_SLOT = "hero/bandon-coast";

/** Where the eye should stay when a photo is cropped, unless images.json says otherwise. */
const DEFAULT_POSITION: Record<string, string> = {
  hero: "50% 60%", // keep the coastline, let the sky go first
  courses: "50% 62%", // favour the ground over the sky
  dining: "50% 50%",
  activities: "50% 50%",
  lodging: "50% 50%",
};

function manifest(): Manifest {
  if (process.env.NODE_ENV === "development") {
    const dir = path.join(process.cwd(), "public", "images");
    try {
      const files = existsSync(dir)
        ? (readdirSync(dir, { recursive: true }) as string[])
            .map((f) => f.replaceAll("\\", "/"))
            .filter((f) => /\.(jpe?g|png|webp|avif)$/i.test(f))
            .map((f) => {
              // Version by size and modified time, so a replaced file shows up on refresh.
              const { size, mtimeMs } = statSync(path.join(dir, f));
              return `${f}?v=${size.toString(36)}${Math.round(mtimeMs).toString(36)}`;
            })
        : [];
      let meta: Meta = {};
      try {
        meta = JSON.parse(readFileSync(path.join(dir, "images.json"), "utf8"));
      } catch {}
      return { files, meta };
    } catch {}
  }
  return generated as Manifest;
}

/** "Shorty's" → "shortys", "Old Macdonald" → "old-macdonald" */
export function slotName(title: string): string {
  return title
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** The folder and file name an event's photo is expected at, e.g. "courses/pacific-dunes". */
export function slotFor(event: { type: string; title: string }): string {
  const folder = event.type === "golf" ? "courses" : event.type === "dining" ? "dining" : "activities";
  return `${folder}/${slotName(event.title)}`;
}

export function photoFor(slot: string): Photo | null {
  const { files, meta } = manifest();
  const file = files.find((f) => f.replace(/\.[^.?]+(\?.*)?$/, "").toLowerCase() === slot);
  if (!file) return null;
  return {
    src: `/images/${file}`,
    credit: meta[slot]?.credit ?? null,
    position: meta[slot]?.position ?? DEFAULT_POSITION[slot.split("/")[0]] ?? "50% 50%",
  };
}

/** Photos for a list of events, keyed by event id. */
export function photosForEvents(
  events: { id: string; type: string; title: string }[],
): Record<string, Photo | null> {
  return Object.fromEntries(events.map((e) => [e.id, photoFor(slotFor(e))]));
}
