import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Leaderboard } from "@/components/public/Leaderboard";
import { roundStandings, toParLabel } from "@/lib/standings";
import { monthDay, weekday } from "@/lib/time";
import { getTrip } from "@/lib/trip";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Scores" };

export default async function ScoresPage({ params }: PageProps<"/t/[slug]/scores">) {
  const { slug } = await params;
  const data = await getTrip(slug);
  if (!data) notFound();
  const { rounds, scores, people } = data;
  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? "Golfer";
  const counting = rounds.filter((r) => r.countsTowardTotal);
  const hasScores = scores.length > 0;
  const firstRound = rounds[0];

  return (
    <>
      <div className="mx-auto max-w-2xl px-5 pb-9 pt-24 md:px-8 md:pt-36">
        <h1 className="display text-[clamp(3.25rem,16vw,6rem)]">Scores</h1>
      </div>

      <section aria-labelledby="board" className="bg-forest-deep">
        <div className="mx-auto max-w-2xl px-5 py-10 md:px-8 md:py-12">
          <h2 id="board" className="display text-[34px] text-limestone">
            The board
          </h2>
          {hasScores ? (
            <>
              <div className="mt-2">
                <Leaderboard rounds={rounds} scores={scores} people={people} />
              </div>
              <p className="mt-6 max-w-prose text-[12.5px] leading-relaxed text-mist/75">
                Gross strokes against par, all rounds combined. Golfers who have missed a round
                are listed below the rest without a position.
              </p>
            </>
          ) : (
            <p className="serif mt-3 max-w-prose text-[18px] italic leading-relaxed text-mist">
              No scores yet.
              {firstRound &&
                ` The board opens after ${weekday(firstRound.date)}'s round at ${firstRound.courseName}.`}
            </p>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-2xl px-5 pb-16 md:px-8">
        {rounds.map((round) => {
          const rows = roundStandings(round, scores);
          const number = counting.indexOf(round) + 1;
          return (
            <section key={round.id} aria-labelledby={`round-${round.id}`} className="mt-14">
              <header className="flex items-end justify-between border-b border-pine pb-3">
                <h2 id={`round-${round.id}`} className="display text-[34px] md:text-[40px]">
                  {round.courseName}
                </h2>
                <p className="figures pb-1 text-right text-[13.5px] leading-snug text-moss">
                  {number > 0 ? `Round ${number}` : "Not counted"}
                  <span className="block">
                    {monthDay(round.date)}, par {round.par}
                  </span>
                </p>
              </header>
              {rows.length === 0 ? (
                <p className="serif py-5 text-[16px] italic text-moss">Not played yet.</p>
              ) : (
                <table className="tabular w-full border-collapse">
                  <thead className="sr-only">
                    <tr>
                      <th scope="col">Position</th>
                      <th scope="col">Golfer</th>
                      <th scope="col">Gross</th>
                      <th scope="col">To par</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rule border-b border-rule">
                    {rows.map((row) => (
                      <tr key={row.participantId}>
                        <td className="w-9 py-3 text-[13px] text-moss">{row.position}</td>
                        <th scope="row" className="serif py-3 text-left text-[18px] font-normal">
                          {nameOf(row.participantId)}
                        </th>
                        <td className="w-12 py-3 text-right text-[17px] font-medium">{row.gross}</td>
                        <td
                          className={`w-14 py-3 text-right text-[14px] ${
                            row.toPar < 0 ? "font-semibold text-copper" : "text-moss"
                          }`}
                        >
                          {toParLabel(row.toPar)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
