// Leaderboard rules, in one place:
//
// Round standings   Lowest gross wins. Equal scores share a position ("T2").
// Cumulative board  Total strokes relative to par across counting rounds.
//                   Players who have posted every round that has any scores are ranked
//                   first. Anyone missing a round is listed below them, unranked, with
//                   their running total, so a missed round never looks like a lead.

type RoundLike = { id: string; par: number; countsTowardTotal: boolean };
type ScoreLike = { roundId: string; participantId: string; gross: number };

export type RoundRow = { participantId: string; gross: number; toPar: number; position: string };

export type BoardRow = {
  participantId: string;
  /** Gross by round id, for rounds the player has posted. */
  byRound: Record<string, number>;
  played: number;
  gross: number;
  toPar: number;
  /** "1", "T2", or "" when the player hasn't posted every scored round. */
  position: string;
};

function positions<T>(sorted: T[], key: (row: T) => number): string[] {
  return sorted.map((row, i) => {
    const value = key(row);
    const first = sorted.findIndex((r) => key(r) === value);
    const tied = sorted.filter((r) => key(r) === value).length > 1;
    void i;
    return `${tied ? "T" : ""}${first + 1}`;
  });
}

export function roundStandings(round: RoundLike, scores: ScoreLike[]): RoundRow[] {
  const rows = scores
    .filter((s) => s.roundId === round.id)
    .sort((a, b) => a.gross - b.gross);
  const pos = positions(rows, (r) => r.gross);
  return rows.map((r, i) => ({
    participantId: r.participantId,
    gross: r.gross,
    toPar: r.gross - round.par,
    position: pos[i],
  }));
}

export function cumulativeBoard(rounds: RoundLike[], scores: ScoreLike[]): BoardRow[] {
  const counting = rounds.filter((r) => r.countsTowardTotal);
  const parOf = new Map(counting.map((r) => [r.id, r.par]));
  const scoredRounds = new Set(
    scores.filter((s) => parOf.has(s.roundId)).map((s) => s.roundId),
  ).size;

  const byPlayer = new Map<string, BoardRow>();
  for (const s of scores) {
    const par = parOf.get(s.roundId);
    if (par === undefined) continue;
    const row =
      byPlayer.get(s.participantId) ??
      ({ participantId: s.participantId, byRound: {}, played: 0, gross: 0, toPar: 0, position: "" } as BoardRow);
    row.byRound[s.roundId] = s.gross;
    row.played += 1;
    row.gross += s.gross;
    row.toPar += s.gross - par;
    byPlayer.set(s.participantId, row);
  }

  const all = [...byPlayer.values()];
  const complete = all.filter((r) => r.played === scoredRounds).sort((a, b) => a.toPar - b.toPar);
  const partial = all
    .filter((r) => r.played < scoredRounds)
    .sort((a, b) => b.played - a.played || a.toPar - b.toPar);

  const pos = positions(complete, (r) => r.toPar);
  complete.forEach((r, i) => (r.position = pos[i]));
  return [...complete, ...partial];
}

/** "E", "+4", "−2" (true minus sign). */
export function toParLabel(n: number): string {
  if (n === 0) return "E";
  return n > 0 ? `+${n}` : `−${Math.abs(n)}`;
}
