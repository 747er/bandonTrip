import Link from "next/link";

export default function NotFound() {
  return (
    <div className="pub flex min-h-[100svh] flex-col justify-center px-5 md:px-16">
      <h1 className="display text-[clamp(3.25rem,14vw,7rem)]">Out of bounds</h1>
      <p className="serif mt-5 max-w-sm text-[18px] italic leading-snug text-moss">
        There&rsquo;s no trip at this address. Check the link with your organizer.
      </p>
      <p className="mt-4">
        <Link className="action" href="/">
          Go to the front page
        </Link>
      </p>
    </div>
  );
}
