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

test('game days can match teams playing on any of the selected days', () => {
  assert.deepEqual(ids(filterPlayers(PLAYERS, { gameDaysSelections: ['We', 'Th'], gameDaysMode: 'any' }, GAMES_BY_TEAM)), [1, 2, 3, 4]);
  assert.deepEqual(ids(filterPlayers(PLAYERS, { gameDaysSelections: ['We', 'Th'], gameDaysMode: 'all' }, GAMES_BY_TEAM)), []);
});

test('stat filters keep players within the range, and leave out players without the stat', () => {
  const players = [
    player({ id: 1, avg: 1.5, gamesPlayed: 10 }),
    player({ id: 2, avg: 3, gamesPlayed: 2 }),
    player({ id: 3, avg: 4.5, gamesPlayed: 12 }),
    player({ id: 4, gamesPlayed: 12 }),
  ];
  const statFilter = (statFilters) => ids(filterPlayers(players, { statFilters }, {}));

  assert.deepEqual(statFilter([{ key: 'avg', min: 2, max: null }]), [2, 3]);
  assert.deepEqual(statFilter([{ key: 'avg', min: null, max: 3 }]), [1, 2]);
  assert.deepEqual(statFilter([{ key: 'avg', min: 2, max: 4 }]), [2]);
  assert.deepEqual(statFilter([{ key: 'avg', min: 2 }, { key: 'gamesPlayed', min: 5 }]), [3]);
});

test('addable now keeps free agents who are not on waivers', () => {
  const players = [
    player({ id: 1, availability: { status: 'free' } }),
    player({ id: 2, availability: { status: 'waivers', until: 1 } }),
    player({ id: 3, owner: 'Team A', availability: { status: 'owned' } }),
    player({ id: 4 }),
  ];
  assert.deepEqual(ids(filterPlayers(players, { ownership: 'Addable now' }, {})), [1]);
});

test('on waivers keeps free agents who can only be claimed', () => {
  const players = [
    player({ id: 1, availability: { status: 'free' } }),
    player({ id: 2, availability: { status: 'waivers', until: 1 } }),
    // Waivers processed, first come first served not open yet
    player({ id: 3, availability: { status: 'locked', until: 1 } }),
    player({ id: 4, owner: 'Team A', availability: { status: 'owned' } }),
    player({ id: 5 }),
  ];
  assert.deepEqual(ids(filterPlayers(players, { ownership: 'On waivers' }, {})), [2]);
});

test('lineup spots keep players who can fill every one, with their team playing that day', () => {
  const teamsByDate = { '2026-10-12': ['SEA', 'VAN'], '2026-10-13': ['SEA'] };
  const spots = (...list) => ids(filterPlayers(PLAYERS, { spotFilters: list }, GAMES_BY_TEAM, teamsByDate));
  const C = { label: 'C', eligibility: ['C'] };
  const F = { label: 'F', eligibility: ['C', 'LW', 'RW'] };
  const D = { label: 'D', eligibility: ['D'] };

  assert.deepEqual(spots({ date: '2026-10-12', ...C }), [1, 4]);
  // A flex slot takes any forward
  assert.deepEqual(spots({ date: '2026-10-13', ...F }), [1]);
  // Every spot has to fit: a C on Monday and a D on Tuesday leaves no one
  assert.deepEqual(spots({ date: '2026-10-12', ...C }, { date: '2026-10-13', ...D }), []);
  assert.deepEqual(spots({ date: '2026-10-12', ...D }, { date: '2026-10-13', ...D }), [2]);
  // Days the schedule doesn't have yet match no one
  assert.deepEqual(spots({ date: '2026-10-20', ...D }), []);
});

test("goalie starts keep today's starters with any of the picked statuses", () => {
  const players = [
    player({ id: 1, positions: ['G'], goalieStartLabel: 'Confirmed' }),
    player({ id: 2, positions: ['G'], goalieStartLabel: 'Unconfirmed' }),
    // Backups and goalies without news have no label
    player({ id: 3, positions: ['G'], goalieStartLabel: '' }),
    player({ id: 4, positions: ['G'] }),
    player({ id: 5, positions: ['C'] }),
    player({ id: 6, positions: ['G'], goalieStartLabel: 'Likely' }),
  ];
  const goalies = (...goalieStartSelections) => ids(filterPlayers(players, { goalieStartSelections }, GAMES_BY_TEAM));

  assert.deepEqual(goalies(), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(goalies('Confirmed'), [1]);
  assert.deepEqual(goalies('Confirmed', 'Likely'), [1, 6]);
  assert.deepEqual(goalies('Unconfirmed'), [2]);
});
