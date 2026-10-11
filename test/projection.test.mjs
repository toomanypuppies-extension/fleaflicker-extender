import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  pointsPerGame, teamGamesPlayed, startRate, bestLineup, projectTeam, winChance,
} from '../src/hockey/collections/projection.js';

const HOUR = 60 * 60 * 1000;
const PERIOD_2 = { ordinal: 2, start: Date.parse('2026-10-05T10:00:00Z'), end: Date.parse('2026-10-12T10:00:00Z'), firstDay: 7, lastDay: 13 };
// Noon Eastern on Wednesday Oct 7, day 9
const DAY_9 = Date.parse('2026-10-07T16:00:00Z');

test('points per game by method, with fallbacks', () => {
  const player = { gamesPlayed: 10, avg: 4, last5: 6, lastSeasonAvg: 2 };

  assert.equal(pointsPerGame(player, 'season'), 4);
  assert.equal(pointsPerGame(player, 'last5'), 6);
  assert.equal(pointsPerGame(player, 'lastSeason'), 2);
  // Season average weighted with last season's as 10 games: (4*10 + 2*10) / 20 = 3, then 70/30 with last 5
  assert.equal(pointsPerGame(player, 'mix'), 3 * 0.7 + 6 * 0.3);

  const rookie = { gamesPlayed: 2, avg: 5, last5: 5 };
  assert.equal(pointsPerGame(rookie, 'lastSeason'), 5);
  assert.equal(pointsPerGame(rookie, 'mix'), 5);

  const notPlayedYet = { gamesPlayed: 0, avg: 0, last5: 0, lastSeasonAvg: 3 };
  assert.equal(pointsPerGame(notPlayedYet, 'season'), 3);
  assert.equal(pointsPerGame(notPlayedYet, 'last5'), 3);
  assert.equal(pointsPerGame(notPlayedYet, 'mix'), 3);
  assert.equal(pointsPerGame({ gamesPlayed: 0 }, 'mix'), 0);
});

test("goalies are expected to play their share of the team's games", () => {
  const players = [
    { team: 'SEA', gamesPlayed: 10 },
    { team: 'SEA', gamesPlayed: 7, positions: ['G'] },
    { team: 'VAN', gamesPlayed: 0, positions: ['G'], lastSeasonGamesPlayed: 41 },
  ];
  const games = teamGamesPlayed(players);

  assert.deepEqual(games, { SEA: 10, VAN: 0 });
  assert.equal(startRate(players[0], games), 1);
  assert.equal(startRate(players[1], games), 0.7);
  assert.equal(startRate(players[2], games), 0.5);
});

test('the best lineup beats filling slots in order', () => {
  const players = [
    { value: 10, positions: ['C', 'LW'] },
    { value: 8, positions: ['LW'] },
    { value: 1, positions: ['D'] },
  ];
  const slots = [{ label: 'LW', eligibility: ['LW'] }, { label: 'C', eligibility: ['C'] }, { label: 'G', eligibility: ['G'] }];

  assert.deepEqual(bestLineup(players, slots), [1, 0, null]);
  assert.deepEqual(bestLineup([], slots), [null, null, null]);
});

test('a team projection starts the best lineup each remaining day', () => {
  const rosterPlayer = (id, team, position = 'C') => ({ id, name: `P${id}`, team, position });
  const roster = {
    groups: [
      {
        group: 'START',
        slots: [
          { label: 'C', player: rosterPlayer(1, 'SEA') },
          { label: 'C', player: rosterPlayer(2, 'EDM') },
          { label: 'G', player: rosterPlayer(5, 'SEA', 'G') },
        ],
      },
      { group: 'BENCH', slots: [{ label: 'BN', player: rosterPlayer(3, 'SEA') }, { label: 'BN', player: rosterPlayer(4, 'SEA') }] },
      { group: 'INJURED', slots: [{ label: 'IR', player: rosterPlayer(6, 'SEA') }] },
    ],
  };
  const stats = (id, avg, more = {}) => [id, { id, avg, gamesPlayed: 10, positions: ['C'], ...more }];
  const playersById = new Map([
    stats(1, 3),
    stats(2, 4),
    stats(3, 2),
    stats(4, 10, { injury: 'DTD' }),
    stats(5, 5, { gamesPlayed: 5, positions: ['G'] }),
    stats(6, 9),
  ]);
  const schedule = [{
    days: [
      {
        date: '2026-10-07',
        games: [
          // Started before the score was read, its points are already counted
          { away: 'EDM', home: 'CGY', start: DAY_9 - HOUR },
          { away: 'SEA', home: 'VAN', start: DAY_9 + 7 * HOUR },
        ],
      },
      { date: '2026-10-08', games: [{ away: 'EDM', home: 'SEA', start: DAY_9 + 31 * HOUR }] },
    ],
  }];

  const projection = projectTeam({
    roster,
    playersById,
    startSlots: [{ label: 'C', eligibility: ['C'], count: 2 }, { label: 'G', eligibility: ['G'], count: 1 }],
    schedule,
    period: PERIOD_2,
    method: 'season',
    teamGames: { SEA: 10, EDM: 10 },
    scoreAsOf: DAY_9,
  });

  // Today P2 is locked into a C slot, so only one is open: P1 (3) plus the goalie (5 at a 50% start rate).
  // Tomorrow both C slots are open: P2 (4) and P1 (3), plus the goalie.
  assert.deepEqual(projection.days.map(day => [day.date, day.expected]), [
    ['2026-10-07', 5.5], ['2026-10-08', 9.5], ['2026-10-09', 0], ['2026-10-10', 0], ['2026-10-11', 0],
  ]);
  assert.equal(projection.expected, 15);
  const byId = Object.fromEntries(projection.players.map(player => [player.id, player]));
  assert.equal(byId[1].games, 2);
  assert.equal(byId[3].games, 0);
  // Injured players, DTD included, aren't expected to play. Players on IR aren't counted at all.
  assert.equal(byId[4].injured, true);
  assert.equal(byId[4].expected, 0);
  assert.equal(byId[6], undefined);
  assert.ok(projection.variance > 0);
});

test('win chance', () => {
  const projection = (expected, variance) => ({ expected, variance });

  // The normal approximation is accurate to about 1e-7
  assert.ok(Math.abs(winChance(100, projection(20, 50), 100, projection(20, 50)) - 0.5) < 1e-6);
  assert.equal(winChance(100, projection(0, 0), 90, projection(0, 0)), 1);
  assert.equal(winChance(90, projection(0, 0), 100, projection(0, 0)), 0);
  const ahead = winChance(110, projection(30, 100), 100, projection(30, 100));
  assert.ok(ahead > 0.7 && ahead < 0.8, String(ahead));
});
