import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HOCKEY_TEAM_ABBR_TO_COLORS } from '../src/hockey/constants.js';
import { teamSeriesColors, passes, oklch, neutralColor, FALLBACK_COLORS } from '../src/hockey/chartColors.js';

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

test("a team's black, white or silver shows as a neutral, not the reference palette", () => {
  for (const mode of ['light', 'dark']) {
    const neutral = neutralColor(mode);
    // Flyers: orange and black
    const flyers = teamSeriesColors({ primary: '#000000', secondary: '#F74902' }, mode);
    assert.ok(hueDifference(flyers[0], '#F74902') < 0.35, String(flyers));
    assert.equal(flyers[1], neutral);
    // Kings: black and silver, two neutrals told apart by lightness
    const kings = teamSeriesColors({ primary: '#111111', secondary: '#A2AAAD' }, mode);
    assert.equal(kings[0], neutral);
    assert.ok(oklch(kings[1]).C < 0.01 && Math.abs(oklch(kings[1]).L - oklch(kings[0]).L) > 0.15, String(kings));
    // Minnesota's green and red can't be told apart with color blindness: the red gives way to a neutral
    assert.deepEqual(teamSeriesColors({ primary: '#154734', secondary: '#A6192E' }, mode)[1], neutral);
  }
  assert.deepEqual(teamSeriesColors(undefined, 'light').length, 2);
});

test('no team needs the reference palette', () => {
  for (const mode of ['light', 'dark']) {
    for (const [team, colors] of TEAMS) {
      const series = teamSeriesColors(colors, mode);
      assert.ok(series.every(hex => !FALLBACK_COLORS[mode].includes(hex)), `${team} ${mode}: ${series}`);
    }
  }
});
