import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interpolate, interpolateDirection, timelineLocal, timelineLabel } from '../src/lib/windMath.ts';

const times = Array.from({length: 48}, (_, i) => `2026-11-${19 + Math.floor(i / 24)}T${String(i % 24).padStart(2, '0')}:00`);

test('fractional forecast times preserve tee-time minutes and cross midnight correctly', () => {
  assert.equal(timelineLocal(times, 10 + 20 / 60), '2026-11-19T10:20');
  assert.equal(timelineLocal(times, 16.25), '2026-11-19T16:15');
  assert.equal(timelineLocal(times, 23 + 59 / 60), '2026-11-19T23:59');
  assert.equal(timelineLocal(times, 24), '2026-11-20T00:00');
  assert.match(timelineLabel(times, 16.25), /Thursday.*4:15 PM/);
});

test('out-of-range playback times stay on the forecast bounds', () => {
  assert.equal(timelineLocal(times, -1), times[0]);
  assert.equal(timelineLocal(times, 90), times.at(-1));
  assert.equal(interpolate([10, 20], -1), 10);
  assert.equal(interpolate([10, 20], 4), 20);
});

test('wind speed uses the same fractional hour as the particle field', () => {
  assert.equal(interpolate([4, 12], .25), 6);
  assert.equal(interpolate([4, 12], .75), 10);
});

test('wind direction takes the shortest path through north in either direction', () => {
  assert.equal(interpolateDirection([350, 10], .5), 0);
  assert.equal(interpolateDirection([10, 350], .5), 0);
  assert.equal(interpolateDirection([90, 180], .5), 135);
  assert.equal(interpolateDirection([350, 10], 1), 10);
});


test("course and schedule briefings sample the exact tee-time minute", async () => {
  const { forecastSummary } = await import("../src/lib/windMath.ts");
  const point = { temp: [46, 50], speed: [6, 10], gust: [8, 12], direction: [350, 10] };
  assert.equal(forecastSummary(point, 0.5), "48°, wind 8 mph from the N, gusts 10");
  assert.equal(forecastSummary({ ...point, gust: [6, 10] }, 0.5), "48°, wind 8 mph from the N");
});

test('a hole reads the wind the way a golfer would', async () => {
  const { heading, windOnHole } = await import('../src/lib/windMath.ts');
  // Old Macdonald's 4th plays almost due south.
  const south = [[-124.3872, 43.2059], [-124.3879, 43.2017]];
  assert.ok(Math.abs(heading(south) - 187) < 3);
  assert.equal(windOnHole(south, 0), 'Downwind'); // from the north, behind the player
  assert.equal(windOnHole(south, 180), 'Into the wind');
  // Facing south, east is on the player's left: an east wind blows left to right.
  assert.equal(windOnHole(south, 90), 'Left to right');
  assert.equal(windOnHole(south, 270), 'Right to left');
  assert.equal(windOnHole(south, 45), 'Helping, left to right');
  assert.equal(windOnHole(south, 135), 'Into, left to right');
});
