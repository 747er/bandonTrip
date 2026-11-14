import type { Round } from "@/db/schema";
import { cumulativeBoard, toParLabel } from "@/lib/standings";
import type { PublicPerson } from "@/lib/trip";

type ScoreLike = { roundId: string; participantId: string; gross: number };

/**
 * The cumulative board, set like a hand-lettered tournament scoreboard: dark field,
 * pale figures, under-par totals picked out in copper.
 */
export function Leaderboard({
  rounds,
  scores,
  people,
  limit,
}: {
  rounds: Round[];
  scores: ScoreLike[];
  people: PublicPerson[];
  limit?: number;
}) {
  // Columns appear as rounds are played, so names keep their room on a phone.
  const allCounting = rounds.filter((r) => r.countsTowardTotal);
  const counting = allCounting.filter((r) => scores.some((s) => s.roundId === r.id));
  const roundNumber = (id: string) => allCounting.findIndex((r) => r.id === id) + 1;
  const board = cumulativeBoard(rounds, scores);
  const rows = limit ? board.slice(0, limit) : board;
  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? "Golfer";

  return (
    <table className="tabular w-full border-collapse text-limestone">
      <thead>
        <tr className="border-b border-rule-light text-[12px] font-medium text-mist/80">
          <th scope="col" className="w-9 py-3 text-left font-medium">
            <span className="sr-only">Position</span>
          </th>
          <th scope="col" className="py-3 text-left font-medium">
            Golfer
          </th>
          {counting.map((r) => (
            <th key={r.id} scope="col" className="w-8 py-3 text-right font-medium sm:w-12">
              <abbr title={r.courseName} className="no-underline">
                R{roundNumber(r.id)}
              </abbr>
            </th>
          ))}
          <th scope="col" className="w-14 py-3 text-right font-medium sm:w-16">
            Total
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.participantId} className="border-b border-rule-light last:border-b-0">
            <td className="py-3.5 text-[13px] text-mist/80">{row.position || "–"}</td>
            <th scope="row" className="serif py-3.5 pr-2 text-left text-[18px] font-normal leading-tight">
              {nameOf(row.participantId)}
            </th>
            {counting.map((r) => (
              <td key={r.id} className="py-3.5 text-right text-[14px] text-mist">
                {row.byRound[r.id] ?? <span className="text-mist/40">·</span>}
              </td>
            ))}
            <td
              className={`py-3.5 text-right text-[18px] font-medium ${
                row.toPar < 0 ? "text-copper-light" : ""
              }`}
            >
              {toParLabel(row.toPar)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
