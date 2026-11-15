import Image from "next/image";

export type PhotoData = { src: string; credit: string | null; position?: string } | null;

const TONES = [
  ["#1f4034", "#5d7f6c", "#c3d0cd"], // pine into mist
  ["#6f8f8e", "#b9c7c1", "#e3ddcd"], // sea haze
  ["#8c7d56", "#cbbb97", "#e9e7e0"], // dune
  ["#0d211b", "#2c5644", "#8fa9a6"], // forest dusk
];

/**
 * A photo slot. With a photo it fills its (positioned) parent, cropped around the photo's
 * `position`. Without one it shows a quiet tonal field, so layouts hold until photos arrive.
 */
export function Photo({
  photo,
  slot,
  alt = "",
  sizes = "100vw",
  priority = false,
  className = "",
}: {
  photo: PhotoData;
  /** Path under public/images this slot reads from, e.g. "courses/pacific-dunes" */
  slot: string;
  alt?: string;
  sizes?: string;
  priority?: boolean;
  className?: string;
}) {
  if (photo) {
    const style = { objectPosition: photo.position ?? "50% 50%" };
    const remote = /^https?:\/\//.test(photo.src);
    return remote ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photo.src}
        alt={alt}
        style={style}
        className={`absolute inset-0 h-full w-full object-cover ${className}`}
      />
    ) : (
      <Image
        src={photo.src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        style={style}
        className={`object-cover ${className}`}
      />
    );
  }

  const tone = TONES[[...slot].reduce((n, c) => n + c.charCodeAt(0), 0) % TONES.length];
  const id = `ph-${slot.replace(/[^a-z0-9]+/gi, "-")}`;
  return (
    <div className={`absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      <svg className="h-full w-full" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id={id} x1="0" y1="1" x2="0.4" y2="0">
            <stop offset="0" stopColor={tone[0]} />
            <stop offset="0.6" stopColor={tone[1]} />
            <stop offset="1" stopColor={tone[2]} />
          </linearGradient>
          <filter id={`${id}-grain`}>
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="4" />
            <feColorMatrix values="0 0 0 0 0.05  0 0 0 0 0.13  0 0 0 0 0.1  0 0 0 0.5 0" />
          </filter>
        </defs>
        <rect width="400" height="300" fill={`url(#${id})`} />
        <rect width="400" height="300" filter={`url(#${id}-grain)`} opacity="0.25" />
      </svg>
    </div>
  );
}

export function PhotoCredit({ photo, className = "" }: { photo: PhotoData; className?: string }) {
  if (!photo?.credit) return null;
  return <span className={`text-fine text-paper/80 ${className}`}>Photo: {photo.credit}</span>;
}
