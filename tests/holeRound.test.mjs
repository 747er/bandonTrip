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
