import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sortPlayers, toggleSort } from '../src/hockey/collections/sorting.js';

const SORT_TYPES = { name: 'string', team: 'string', todaysGame: 'string', points: 'number' };

const PLAYERS = [
  { id: 1, name: 'Bo', team: 'SEA', points: 10, todaysGame: 'VAN 7:00 PM' },
  { id: 2, name: 'Al', team: 'VAN', points: 30 },
  { id: 3, name: 'Cy', team: 'SEA', points: 20, todaysGame: '@EDM 9:00 PM' },
  { id: 4, name: 'Di', team: 'VAN', points: 20, todaysGame: '' },
];

const ids = (players) => players.map(p => p.id);
const sort = (sorts) => ids(sortPlayers(PLAYERS, sorts, SORT_TYPES));

test('desc sorts numbers highest first and text A to Z', () => {
  assert.deepEqual(sort([{ key: 'points', direction: 'desc' }]), [2, 3, 4, 1]);
  assert.deepEqual(sort([{ key: 'name', direction: 'desc' }]), [2, 1, 3, 4]);
});

test('asc reverses the order', () => {
  assert.deepEqual(sort([{ key: 'points', direction: 'asc' }]), [1, 3, 4, 2]);
  assert.deepEqual(sort([{ key: 'name', direction: 'asc' }]), [4, 3, 1, 2]);
});

test('the second sort breaks ties in the first', () => {
  assert.deepEqual(sort([
    { key: 'team', direction: 'desc' },
    { key: 'points', direction: 'desc' },
  ]), [3, 1, 2, 4]);
});

test('players without a value go last in either direction', () => {
  assert.deepEqual(sort([{ key: 'todaysGame', direction: 'desc' }]), [3, 1, 2, 4]);
  assert.deepEqual(sort([{ key: 'todaysGame', direction: 'asc' }]), [1, 3, 2, 4]);
});

test('sorts on columns without a sort type are ignored', () => {
  assert.deepEqual(sort([{ key: 'gameDays', direction: 'desc' }]), [1, 2, 3, 4]);
});

test('sorting does not change the original list', () => {
  sortPlayers(PLAYERS, [{ key: 'points', direction: 'desc' }], SORT_TYPES);
  assert.deepEqual(ids(PLAYERS), [1, 2, 3, 4]);
});

test('clicking a column cycles it through desc, asc and unsorted', () => {
  let sorts = toggleSort([], 'points');
  assert.deepEqual(sorts, [{ key: 'points', direction: 'desc' }]);
  sorts = toggleSort(sorts, 'points');
  assert.deepEqual(sorts, [{ key: 'points', direction: 'asc' }]);
  sorts = toggleSort(sorts, 'points');
  assert.deepEqual(sorts, []);
});

test('clicking a new column replaces the sort', () => {
  const sorts = toggleSort([{ key: 'points', direction: 'asc' }], 'name');
  assert.deepEqual(sorts, [{ key: 'name', direction: 'desc' }]);
});

test('shift-clicking adds a second sort, then replaces the second one', () => {
  let sorts = toggleSort([{ key: 'team', direction: 'desc' }], 'points', true);
  assert.deepEqual(sorts, [{ key: 'team', direction: 'desc' }, { key: 'points', direction: 'desc' }]);
  sorts = toggleSort(sorts, 'name', true);
  assert.deepEqual(sorts, [{ key: 'team', direction: 'desc' }, { key: 'name', direction: 'desc' }]);
});

test('clicking a sorted column keeps the other sort', () => {
  const sorts = [{ key: 'team', direction: 'desc' }, { key: 'points', direction: 'desc' }];
  assert.deepEqual(toggleSort(sorts, 'team'), [{ key: 'team', direction: 'asc' }, { key: 'points', direction: 'desc' }]);
  assert.deepEqual(toggleSort(toggleSort(sorts, 'team'), 'team'), [{ key: 'points', direction: 'desc' }]);
});
