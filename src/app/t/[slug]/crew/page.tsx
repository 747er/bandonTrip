import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { clock, monthDay, weekday } from "@/lib/time";
import { getTrip } from "@/lib/trip";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Crew" };

export default async function CrewPage({ params }: PageProps<"/t/[slug]/crew">) {
  const { slug } = await params;
  const data = await getTrip(slug);
  if (!data) notFound();
  const { people, lodgings, groups, events } = data;
  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? "";
  const lodgingOf = (id: string | null) => lodgings.find((l) => l.id === id);
  const groupsOf = (id: string) => groups.filter((g) => g.memberIds.includes(id)).map((g) => g.name);
  const rooms = lodgings
    .map((l) => ({ ...l, occupants: people.filter((p) => p.lodgingId === l.id) }))
    .filter((l) => l.occupants.length > 0 || l.detail);
  const filledGroups = groups.filter((g) => g.memberIds.length > 0);
  const pairings = events
    .filter((e) => e.type === "golf")
    .map((e) => ({ ...e, teeTimes: e.teeTimes.filter((t) => t.playerIds.length > 0) }))
    .filter((e) => e.teeTimes.length > 0);

  return (
    <div className="mx-auto max-w-2xl px-5 pb-16 pt-24 md:px-8 md:pt-36">
      <h1 className="display text-[clamp(3.25rem,16vw,6rem)]">The crew</h1>

      {people.length === 0 ? (
        <p className="serif mt-8 max-w-prose text-[18px] italic leading-relaxed text-moss">
          The roster hasn&rsquo;t been posted yet. Names, rooms and caddies will show up here.
        </p>
      ) : (
        <>
          <p className="mt-4 text-[14.5px] text-moss">
            {people.length} {people.length === 1 ? "golfer" : "golfers"}
            {rooms.length > 0 && `, ${rooms.length} ${rooms.length === 1 ? "room" : "rooms"}`}
          </p>

          <ul className="mt-8 divide-y divide-rule border-y border-pine/80">
            {people.map((p) => {
              const room = lodgingOf(p.lodgingId);
              const meta = [p.hometown, ...groupsOf(p.id)].filter(Boolean).join(", ");
              return (
                <li key={p.id} className="grid grid-cols-[1fr_auto] gap-x-4 py-4">
                  <div className="min-w-0">
                    <div className="serif text-[21px] leading-tight">{p.name}</div>
                    {meta && <div className="mt-1 text-[13.5px] text-moss">{meta}</div>}
                  </div>
                  <div className="text-right text-[13.5px] leading-snug">
                    {room && <div>{room.name}</div>}
                    {p.caddie && <div className="text-moss">Caddie: {p.caddie}</div>}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {rooms.length > 0 && (
        <section aria-labelledby="rooms" className="mt-16">
          <h2 id="rooms" className="display text-[40px]">
            Rooms
          </h2>
          <dl className="mt-5 divide-y divide-rule border-y border-rule">
            {rooms.map((room) => (
              <div key={room.id} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-x-5 py-4">
                <dt>
                  <div className="text-[15.5px] font-medium">{room.name}</div>
                  {room.detail && <div className="mt-0.5 text-[13px] text-moss">{room.detail}</div>}
                </dt>
                <dd className="serif text-[17px] leading-snug">
                  {room.occupants.map((p) => (
                    <div key={p.id}>{p.name}</div>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {pairings.length > 0 && (
        <section aria-labelledby="pairings" className="mt-16">
          <h2 id="pairings" className="display text-[40px]">
            Pairings
          </h2>
          {pairings.map((e) => (
            <div key={e.id} className="mt-7">
              <h3 className="flex items-baseline justify-between border-b border-pine pb-2">
                <span className="serif text-[21px]">{e.title}</span>
                <span className="text-[13.5px] text-moss">
                  {weekday(e.date)}, {monthDay(e.date)}
                </span>
              </h3>
              <table className="w-full text-[15px]">
                <tbody className="divide-y divide-rule border-b border-rule">
                  {e.teeTimes.map((t) => (
                    <tr key={t.id}>
                      <th scope="row" className="figures w-24 py-3 text-left align-top font-medium">
                        {clock(t.time)}
                      </th>
                      <td className="py-3">
                        {t.playerIds.map(nameOf).filter(Boolean).join(", ")}
                        {t.note && <span className="block text-[13px] text-moss">{t.note}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </section>
      )}

      {filledGroups.length > 0 && (
        <section aria-labelledby="groups" className="mt-16">
          <h2 id="groups" className="display text-[40px]">
            Groups
          </h2>
          <dl className="mt-5 divide-y divide-rule border-y border-rule">
            {filledGroups.map((g) => (
              <div key={g.id} className="py-4">
                <dt className="text-[15.5px] font-medium">
                  {g.name}
                  {g.description && (
                    <span className="ml-2 font-normal text-moss">{g.description}</span>
                  )}
                </dt>
                <dd className="serif mt-1.5 text-[17px] leading-relaxed">
                  {g.memberIds.map(nameOf).join(", ")}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </div>
  );
}
