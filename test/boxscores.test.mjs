import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createFakeFlea, startClock, stopClock, settle, setLeague, resetStorage } from './support/fakeFlea.mjs';
import {
  convertBoxscore, dayOrdinalAt, dayDate, periodsInRange, loadTeamDays, pointsByPlayer, pointsByPosition, totalPoints,
} from '../src/hockey/collections/boxscores.js';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const LEAGUE = '100';

// A real box score, trimmed: day 12 of a matchup in league 12089
const BOXSCORE = JSON.parse(readFileSync(new URL('./fixtures/boxscore.json', import.meta.url)));

// Matchup periods like the league's first two: Sep 29 - Oct 4 (days 1-6) and Oct 5 - 11 (days 7-13)
const PERIOD_1 = { ordinal: 1, start: Date.parse('2026-09-29T10:00:00Z'), end: Date.parse('2026-10-05T10:00:00Z'), firstDay: 1, lastDay: 6 };
const PERIOD_2 = { ordinal: 2, start: Date.parse('2026-10-05T10:00:00Z'), end: Date.parse('2026-10-12T10:00:00Z'), firstDay: 7, lastDay: 13 };
// Day 9, Wednesday Oct 7 at noon Eastern
const DAY_9 = Date.parse('2026-10-07T16:00:00Z');

const SCOREBOARD = {
  periods: [PERIOD_1, PERIOD_2],
  currentOrdinal: 2,
  matchups: [
    { gameId: 'g2a', awayId: 1, homeId: 2 },
    { gameId: 'g2b', awayId: 3, homeId: 4 },
  ],
};

const slot = (group, label, playerId, points, { position = 'C', games = 1 } = {}) => ({
  ...(group && { group }),
  slots: [{
    position: { label },
    away: {
      proPlayer: { id: playerId, nameFull: `Player ${playerId}`, position },
      ...(games && { requestedGames: Array.from({ length: games }, () => ({ pointsActual: { value: points / games } })) }),
    },
  }],
});

// A box score where the away team started player 10 (a center) and benched player 11
const fakeBoxscore = (gameId, day, awayId, homeId, points = day) => ({
  game: { id: gameId, away: { id: awayId }, home: { id: homeId } },
  scoringPeriod: { ordinal: day },
  pointsAway: { scoringPeriod: { value: { value: points } } },
  pointsHome: { scoringPeriod: { value: { value: 1 } } },
  lineups: [slot('START', 'C', 10, points), slot(undefined, 'BN', 11, 3)],
});

let flea;

beforeEach(async () => {
  await resetStorage();
  setLeague(LEAGUE);
  startClock();
  flea = createFakeFlea();
  for (let day = 7; day <= 13; day++) {
    flea.boxscores[`g2a:${day}`] = fakeBoxscore('g2a', day, 1, 2);
    flea.boxscores[`g2b:${day}`] = fakeBoxscore('g2b', day, 3, 4);
  }
  flea.scoreboardsByDay[1] = { games: [{ id: 'g1', away: { id: 1 }, home: { id: 3 } }, { id: 'g1b', away: { id: 2 }, home: { id: 4 } }] };
  for (let day = 1; day <= 6; day++) {
    flea.boxscores[`g1:${day}`] = fakeBoxscore('g1', day, 1, 3);
  }
});

afterEach(stopClock);

const load = (options) => settle(loadTeamDays(LEAGUE, { scoreboard: SCOREBOARD, teamIds: [1], now: DAY_9, ...options }));

test("a box score's starters add up to the points fleaflicker counted", () => {
  const box = convertBoxscore(BOXSCORE);

  assert.equal(box.day, 12);
  for (const side of ['away', 'home']) {
    const started = box[side].filter(s => s.group === 'START').reduce((total, s) => total + s.points, 0);
    assert.equal(Math.round(started * 100) / 100, Math.round(box[`${side}Points`] * 100) / 100);
  }
  // The bench has no group in fleaflicker's response
  assert.ok(box.away.some(s => s.group === 'BENCH'));
  assert.ok(box.away.every(s => s.playerId && s.name && s.position));
});

test('days are counted from 6am Eastern', () => {
  assert.equal(dayOrdinalAt(PERIOD_2, Date.parse('2026-10-05T10:00:00Z')), 7);
  assert.equal(dayOrdinalAt(PERIOD_2, Date.parse('2026-10-06T09:59:00Z')), 7);
  assert.equal(dayOrdinalAt(PERIOD_2, Date.parse('2026-10-06T10:00:00Z')), 8);
  assert.equal(dayOrdinalAt(PERIOD_2, Date.parse('2026-10-11T16:00:00Z')), 13);
  // Clamped to the period
  assert.equal(dayOrdinalAt(PERIOD_2, Date.parse('2026-10-20T16:00:00Z')), 13);
  assert.equal(dayDate(PERIOD_2, 13), '2026-10-11');
  assert.equal(dayDate(PERIOD_2, 7), '2026-10-05');
});

test('ranges count back from the current matchup', () => {
  assert.deepEqual(periodsInRange(SCOREBOARD, 'matchup', DAY_9).map(p => p.ordinal), [2]);
  assert.deepEqual(periodsInRange(SCOREBOARD, 'season', DAY_9).map(p => p.ordinal), [1, 2]);
  assert.deepEqual(periodsInRange(SCOREBOARD, 'last4', DAY_9).map(p => p.ordinal), [1, 2]);
});

test("a team's days so far in this matchup", async () => {
  const { days, failed } = await load();

  assert.equal(failed, 0);
  assert.deepEqual(days[1].map(d => [d.period, d.day, d.opponentId, d.points]), [[2, 7, 2, 7], [2, 8, 2, 8], [2, 9, 2, 9]]);
  assert.equal(flea.callsTo('FetchLeagueBoxscore'), 3);
});

test("past days are kept, today's are refetched after a few minutes", async () => {
  await load();
  flea.calls = [];

  await load({ now: DAY_9 + MINUTE });
  assert.equal(flea.callsTo('FetchLeagueBoxscore'), 0);

  await load({ now: DAY_9 + 10 * MINUTE });
  assert.equal(flea.callsTo('FetchLeagueBoxscore'), 1);

  // Next day: day 9 is fetched once more now that it's over, and day 10 is new
  flea.calls = [];
  await load({ now: DAY_9 + DAY });
  assert.equal(flea.callsTo('FetchLeagueBoxscore'), 2);
  flea.calls = [];
  await load({ now: DAY_9 + DAY + 10 * MINUTE });
  assert.equal(flea.callsTo('FetchLeagueBoxscore'), 1);
});

test('the season includes earlier matchups against other opponents', async () => {
  const { days } = await load({ range: 'season' });

  assert.equal(days[1].length, 6 + 3);
  assert.deepEqual([...new Set(days[1].map(d => d.opponentId))], [3, 2]);
  assert.equal(flea.callsTo('FetchLeagueScoreboard'), 1);

  // Earlier matchups are stored too
  flea.calls = [];
  await load({ range: 'season', now: DAY_9 + 10 * MINUTE });
  assert.deepEqual(flea.calls, ['FetchLeagueBoxscore']);
});

test('two teams in the same matchup share box scores', async () => {
  const { days } = await load({ teamIds: [1, 2] });

  assert.equal(days[1].length, 3);
  assert.equal(days[2].length, 3);
  assert.equal(days[2][0].opponentId, 1);
  assert.equal(flea.callsTo('FetchLeagueBoxscore'), 3);
});

test("box scores that can't be loaded are counted, and the rest still are", async () => {
  flea.fail = (endpoint, params) => endpoint === 'FetchLeagueBoxscore' && params.scoring_period === 8 ? 'network' : undefined;
  const progress = [];

  const { days, failed } = await load({ onProgress: (done, total) => progress.push([done, total]) });

  assert.equal(failed, 1);
  assert.deepEqual(days[1].map(d => d.day), [7, 9]);
  assert.deepEqual(progress.at(-1), [3, 3]);
});

test('only starters with a game count, by player and by main position', () => {
  const day = (lineup, points) => ({ lineup, points });
  const days = [
    day([
      { group: 'START', playerId: 1, name: 'A', position: 'C/LW', games: 1, points: 5 },
      { group: 'START', playerId: 2, name: 'B', position: 'D', games: 0, points: 0 },
      { group: 'BENCH', playerId: 3, name: 'C', position: 'RW', games: 1, points: 9 },
      { group: 'START', playerId: 4, name: 'G', position: 'G', games: 1, points: -2 },
    ], 3),
    day([
      { group: 'START', playerId: 1, name: 'A', position: 'C/LW', games: 1, points: 2.5 },
      { group: 'START', playerId: 2, name: 'B', position: 'D', games: 1, points: 4 },
      // Fleaflicker lists some forwards as F or W
      { group: 'START', playerId: 5, name: 'F', position: 'F', eligibility: ['C', 'LW', 'RW'], games: 1, points: 1 },
      { group: 'START', playerId: 6, name: 'W', position: 'W', eligibility: ['LW', 'RW'], games: 1, points: 2 },
    ], 9.5),
  ];

  assert.deepEqual(pointsByPlayer(days).map(p => [p.playerId, p.points, p.games]), [[1, 7.5, 2], [2, 4, 1], [6, 2, 1], [5, 1, 1], [4, -2, 1]]);
  assert.deepEqual(pointsByPosition(days).map(p => [p.position, p.points]), [['C', 8.5], ['LW', 2], ['RW', 0], ['D', 4], ['G', -2]]);
  assert.equal(totalPoints(days), 12.5);
});
