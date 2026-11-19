import { test } from 'node:test';
import assert from 'node:assert/strict';
import { holeYards, holeTimes } from '../src/lib/holeRound.ts';
import data from '../src/lib/holes.json' with { type: 'json' };

test('hole lengths from the line of play land near the card', () => {
  // Pacific Dunes from the resort's card: 4 is 463, 11 is 148, 18 is 591 from the back.
  const holes = data['pacific-dunes'].holes;
  const near = (n, card) => Math.abs(holeYards(holes.find((h) => h.n === n).line) - card) / card < 0.06;
  assert.ok(near(4, 463));
  assert.ok(near(11, 148));
  assert.ok(near(18, 591));
});

test('a round of 72 takes about four hours, in playing order', () => {
  const holes = data['pacific-dunes'].holes;
  const times = holeTimes(holes);
  assert.equal(times[0].at, 0);
  assert.deepEqual(times.map((t) => t.n), holes.map((h) => h.n));
  for (let i = 1; i < times.length; i++) assert.equal(times[i].at, times[i - 1].until);
  assert.ok(times.at(-1).until > 225 && times.at(-1).until < 255);
});

test('a hole with no par is paced as a par 4', () => {
  assert.deepEqual(holeTimes([{ n: 1, par: null }, { n: 2, par: 3 }]), [{ n: 1, at: 0, until: 14 }, { n: 2, at: 14, until: 25 }]);
});

test('a player on a fairway is found on that hole, and nowhere off the course', async () => {
  const { holeAtPoint, greenCenter, yardsBetween } = await import('../src/lib/holeRound.ts');
  const holes = data['pacific-dunes'].holes;
  for (const n of [1, 4, 11, 18]) {
    const h = holes.find((x) => x.n === n);
    const mid = h.line[Math.floor(h.line.length / 2)];
    const tee = h.line[0];
    // Halfway along the line of play, a little toward the green from the tee.
    const p = [tee[0] + (h.line.at(-1)[0] - tee[0]) * 0.4, tee[1] + (h.line.at(-1)[1] - tee[1]) * 0.4];
    assert.equal(holeAtPoint(h.line.length > 2 ? mid : p, holes), n);
  }
  // The Main Lodge is on no hole.
  assert.equal(holeAtPoint([-124.39017, 43.18792], holes), null);
  // The middle of a green is a few yards from the end of the line of play, which OpenStreetMap draws to it.
  const h4 = holes.find((x) => x.n === 4);
  assert.ok(yardsBetween(greenCenter(h4), h4.line.at(-1)) < 25);
});

test('distances in yards', async () => {
  const { yardsBetween } = await import('../src/lib/holeRound.ts');
  // 0.001° of latitude is about 111 m, or 122 yards.
  assert.equal(yardsBetween([-124.39, 43.18], [-124.39, 43.181]), 122);
});
