import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eligiblePositions, rosterPlayers, positionDepth, changeFromLastSeason } from '../src/hockey/collections/rosterStats.js';

const roster = {
  groups: [
    { group: 'START', slots: [{ label: 'C', player: { id: 1, name: 'A', position: 'C/LW' } }, { label: 'D', player: null }] },
    { group: 'BENCH', slots: [{ label: 'BN', player: { id: 2, name: 'B', position: 'W' } }, { label: 'BN', player: { id: 3, name: 'G1', position: 'G' } }] },
    { group: 'INJURED', slots: [{ label: 'IR', player: { id: 4, name: 'C', position: 'C', injury: 'IR' } }] },
  ],
};
const playersById = new Map([
  [1, { id: 1, positions: ['C', 'LW'], points: 40, avg: 4, gamesPlayed: 10, lastSeasonAvg: 3.25 }],
  [2, { id: 2, positions: ['LW', 'RW'], points: 30, avg: 3, gamesPlayed: 10 }],
  [4, { id: 4, positions: ['C'], points: 50, avg: 5, gamesPlayed: 10, lastSeasonAvg: 6, injury: 'IR' }],
]);

test('eligible positions from eligibility or listings like W and F', () => {
  assert.deepEqual(eligiblePositions({ position: 'C/LW' }), ['C', 'LW']);
  assert.deepEqual(eligiblePositions({ position: 'W' }), ['LW', 'RW']);
  assert.deepEqual(eligiblePositions({ position: 'F' }), ['C', 'LW', 'RW']);
  assert.deepEqual(eligiblePositions({ position: 'C', positions: ['C', 'F'] }), ['C', 'LW', 'RW']);
  assert.deepEqual(eligiblePositions({ position: 'G' }), ['G']);
});

test("a roster's players with their stats, IR included", () => {
  const players = rosterPlayers(roster, playersById);

  assert.deepEqual(players.map(p => [p.id, p.onIr, p.hurt, p.hasStats]), [[1, false, false, true], [2, false, false, true], [3, false, false, false], [4, true, true, true]]);
});

test('depth counts players at every position they can play, best first', () => {
  const depth = positionDepth(rosterPlayers(roster, playersById));

  assert.deepEqual(depth.map(d => [d.position, d.players.map(p => p.id), d.healthy]), [
    ['C', [4, 1], 1],
    ['LW', [1, 2], 2],
    ['RW', [2], 1],
    ['D', [], 0],
    ['G', [3], 1],
  ]);
});

test('change from last season', () => {
  assert.equal(changeFromLastSeason({ gamesPlayed: 10, avg: 4, lastSeasonAvg: 3.25 }), 0.75);
  assert.equal(changeFromLastSeason({ gamesPlayed: 10, avg: 5, lastSeasonAvg: 6 }), -1);
  assert.equal(changeFromLastSeason({ gamesPlayed: 10, avg: 3 }), null);
  assert.equal(changeFromLastSeason({ gamesPlayed: 0, avg: 0, lastSeasonAvg: 3 }), null);
});
