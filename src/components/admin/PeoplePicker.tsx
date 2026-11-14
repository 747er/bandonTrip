import Link from "next/link";

/** A checkbox grid of the trip's golfers. */
export function PeoplePicker({
  name,
  people,
  selected,
  tripId,
}: {
  name: string;
  people: { id: string; name: string }[];
  selected: Set<string>;
  tripId: string;
}) {
  if (people.length === 0) {
    return (
      <p className="text-[13px] text-zinc-500">
        Add golfers on the{" "}
        <Link href={`/admin/trips/${tripId}/crew`} className="underline">
          Crew tab
        </Link>{" "}
        first.
      </p>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
      {people.map((p) => (
        <label
          key={p.id}
          className="!mb-0 flex items-center gap-2 !text-[13px] !font-normal !text-zinc-800"
        >
          <input type="checkbox" name={name} value={p.id} defaultChecked={selected.has(p.id)} />
          {p.name}
        </label>
      ))}
    </div>
  );
}
