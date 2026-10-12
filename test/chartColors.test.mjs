import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HOCKEY_TEAM_ABBR_TO_COLORS } from '../src/hockey/constants.js';
import { teamSeriesColors, passes, oklch, FALLBACK_COLORS } from '../src/hockey/chartColors.js';

const TEAMS = Object.entries(HOCKEY_TEAM_ABBR_TO_COLORS);
const hueDifference = (a, b) => {
  const difference = Math.abs(oklch(a).h - oklch(b).h) % (2 * Math.PI);
  return Math.min(difference, 2 * Math.PI - difference);
};

test("every team's chart colors pass the checks in both themes", () => {
  for (const mode of ['light', 'dark']) {
    for (const [team, colors] of TEAMS) {
      const series = teamSeriesColors(colors, mode);
      assert.equal(series.length, 2);
      assert.ok(passes(series, mode), `${team} ${mode}: ${series}`);
    }
  }
});

test("colors keep the team's hue when it has one", () => {
  // Seattle: deep sea navy and ice blue, both blue, so the second is separated by lightness
  const seattle = teamSeriesColors({ primary: '#001628', secondary: '#99D9D9' }, 'dark');
  assert.ok(hueDifference(seattle[0], '#001628') < 0.35, String(seattle));
  // Edmonton: blue and orange stay blue and orange
  const edmonton = teamSeriesColors({ primary: '#041E42', secondary: '#FF4C00' }, 'light');
  assert.ok(hueDifference(edmonton[0], '#041E42') < 0.35, String(edmonton));
  assert.ok(hueDifference(edmonton[1], '#FF4C00') < 0.35, String(edmonton));
});

test('colors without a hue fall back to the reference palette', () => {
  assert.deepEqual(teamSeriesColors({ primary: '#000000', secondary: '#FFFFFF' }, 'dark'), FALLBACK_COLORS.dark);
  assert.deepEqual(teamSeriesColors(undefined, 'light'), FALLBACK_COLORS.light);
  // One usable color is kept, the other comes from the reference palette
  const [first, second] = teamSeriesColors({ primary: '#000000', secondary: '#C8102E' }, 'light');
  assert.ok(hueDifference(first, '#C8102E') < 0.35);
  assert.ok(FALLBACK_COLORS.light.includes(second));
});
