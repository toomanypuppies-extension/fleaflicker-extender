import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterPlayers } from '../src/hockey/collections/filtering.js';

const player = (overrides) => ({
  id: 1,
  name: 'Some Player',
  team: 'SEA',
  owner: undefined,
  positions: ['C'],
  injury: undefined,
  ...overrides,
});

const PLAYERS = [
  player({ id: 1, name: 'Jared McCann', team: 'SEA', owner: 'Team A', positions: ['C', 'LW', 'F', 'W'] }),
  player({ id: 2, name: 'Vince Dunn', team: 'SEA', positions: ['D'], injury: 'DTD' }),
  player({ id: 3, name: 'Quinn Hughes', team: 'VAN', owner: 'Team B', positions: ['D'] }),
  player({ id: 4, name: 'Elias Pettersson', team: 'VAN', positions: ['C', 'F'], injury: 'IR' }),
];

const GAMES_BY_TEAM = { SEA: ['Mo', 'We'], VAN: ['Mo', 'Th'] };

const ids = (players) => players.map(p => p.id);
const filter = (filters) => ids(filterPlayers(PLAYERS, filters, GAMES_BY_TEAM));

test('no filters keeps every player', () => {
  assert.deepEqual(filter({}), [1, 2, 3, 4]);
});

test('search matches part of a name, ignoring case and surrounding spaces', () => {
  assert.deepEqual(filter({ filter: '  hug ' }), [3]);
});

test('ownership filters free agents, owned players, all players, or one owner', () => {
  assert.deepEqual(filter({ ownership: 'Free Agent' }), [2, 4]);
  assert.deepEqual(filter({ ownership: 'Owned' }), [1, 3]);
  assert.deepEqual(filter({ ownership: 'All' }), [1, 2, 3, 4]);
  assert.deepEqual(filter({ ownership: 'Team B' }), [3]);
  // Cleared selects can come back as null
  assert.deepEqual(filter({ ownership: null }), [1, 2, 3, 4]);
});

test('team selections are full team names', () => {
  assert.deepEqual(filter({ teamSelections: ['Vancouver Canucks'] }), [3, 4]);
});

test('injury selections match the injury, and HEALTHY matches players without one', () => {
  assert.deepEqual(filter({ injurySelections: ['HEALTHY'] }), [1, 3]);
  assert.deepEqual(filter({ injurySelections: ['HEALTHY', 'IR'] }), [1, 3, 4]);
});

test('a player matches if they have any selected position', () => {
  assert.deepEqual(filter({ positionSelections: ['W'] }), [1]);
  assert.deepEqual(filter({ positionSelections: ['W', 'D'] }), [1, 2, 3]);
});

test('game days keep teams playing on every selected day', () => {
  assert.deepEqual(filter({ gameDaysSelections: ['Mo'] }), [1, 2, 3, 4]);
  assert.deepEqual(filter({ gameDaysSelections: ['Mo', 'We'] }), [1, 2]);
  assert.deepEqual(filter({ gameDaysSelections: ['Tu'] }), []);
});

test('game days filter out everyone until the schedule has loaded', () => {
  assert.deepEqual(ids(filterPlayers(PLAYERS, { gameDaysSelections: ['Mo'] }, {})), []);
});

test('filters combine', () => {
  assert.deepEqual(filter({ ownership: 'Free Agent', teamSelections: ['Seattle Kraken'] }), [2]);
});
