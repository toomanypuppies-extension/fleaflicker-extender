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

test("a team projection uses each day's set lineup, and calls out bench points", () => {
  const rosterPlayer = (id, team, position = 'C') => ({ id, name: `P${id}`, team, position });
  const p1 = rosterPlayer(1, 'SEA');
  const p2 = rosterPlayer(2, 'EDM');
  const p3 = rosterPlayer(3, 'SEA');
  const p4 = rosterPlayer(4, 'SEA');
  const p5 = rosterPlayer(5, 'SEA', 'G');
  const lineup = (starters, bench) => [
    { group: 'START', slots: starters.map(([label, player]) => ({ label, player })) },
    { group: 'BENCH', slots: bench.map(player => ({ label: 'BN', player })) },
    { group: 'INJURED', slots: [{ label: 'IR', player: rosterPlayer(6, 'SEA') }] },
  ];
  const today = lineup([['C', p1], ['C', p2], ['G', p5]], [p3, p4]);
  const tomorrow = lineup([['C', p3], ['C', p2], ['G', p5]], [p1, p4]);
  const lineups = { 9: today, 10: tomorrow, 11: tomorrow, 12: tomorrow };

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

  const options = {
    lineupFor: day => lineups[day] || null,
    playersById,
    startSlots: [{ label: 'C', eligibility: ['C'], count: 2 }, { label: 'G', eligibility: ['G'], count: 1 }],
    schedule,
    period: PERIOD_2,
    method: 'season',
    teamGames: { SEA: 10, EDM: 10 },
    scoreAsOf: DAY_9,
  };
  const projection = projectTeam({ ...options, lineup: 'set' });

  // Today: P1 (3) and the goalie (5 at a 50% start rate) start, P3 (2) sits. P2's game has begun.
  // Tomorrow the owner started P3 over P1: the best lineup would score 1 more.
  // Day 13's lineup isn't known.
  assert.deepEqual(projection.days.map(day => [day.date, day.expected, day.bench, day.best, day.hasLineup]), [
    ['2026-10-07', 5.5, 2, 5.5, true],
    ['2026-10-08', 8.5, 3, 9.5, true],
    ['2026-10-09', 0, 0, 0, true],
    ['2026-10-10', 0, 0, 0, true],
    ['2026-10-11', 0, 0, 0, false],
  ]);
  assert.deepEqual([projection.expected, projection.bench, projection.best], [14, 5, 15]);
  const byId = Object.fromEntries(projection.players.map(player => [player.id, player]));
  assert.deepEqual([byId[1].games, byId[1].benchGames, byId[1].expected, byId[1].benchExpected], [1, 1, 3, 3]);
  // Injured players, DTD included, aren't expected to play. Players on IR aren't counted at all.
  assert.equal(byId[4].injured, true);
  assert.equal(byId[4].benchExpected, 0);
  assert.equal(byId[6], undefined);
  assert.ok(projection.variance > 0);
  assert.ok(projection.bestVariance > projection.variance);

  // The best lineup instead: tomorrow P1 starts over P3
  const best = projectTeam({ ...options, lineup: 'best' });
  assert.deepEqual(best.days.slice(0, 2).map(day => [day.expected, day.bench]), [[5.5, 2], [9.5, 2]]);
  assert.deepEqual([best.expected, best.bench, best.best], [15, 4, 15]);
  const bestById = Object.fromEntries(best.players.map(player => [player.id, player]));
  assert.deepEqual([bestById[1].games, bestById[1].benchGames, bestById[3].games, bestById[3].benchGames], [2, 0, 0, 2]);
  assert.equal(best.variance, projection.bestVariance);
  // Starts are recorded by the slot they fill
  assert.deepEqual(bestById[1].slots, { C: { games: 2, expected: 6 } });
  assert.deepEqual(bestById[5].slots, { G: { games: 2, expected: 5 } });

  // Each day's slots for the planner: P2's game began so he's locked in a C slot, days without
  // games leave every slot open
  const slotsOn = (day) => day.slots.map(slot => [slot.label, slot.player?.id ?? null, slot.locked]);
  assert.deepEqual(slotsOn(best.days[0]), [['C', 2, true], ['C', 1, false], ['G', 5, false]]);
  assert.deepEqual(best.days[0].sitting.map(player => player.id), [3]);
  assert.deepEqual(slotsOn(best.days[2]), [['C', null, false], ['C', null, false], ['G', null, false]]);
  assert.deepEqual(best.days[4].slots, []);
  // As set, tomorrow P3 is in P1's place
  assert.deepEqual(slotsOn(projection.days[1]), [['C', 3, false], ['C', 2, false], ['G', 5, false]]);
  assert.deepEqual(projection.days[1].sitting.map(player => player.id), [1]);
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
