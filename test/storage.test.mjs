import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { storage, setLeague } from './support/fakeFlea.mjs';
import { setLocalStorage, getLocalStorage, clearAllLocalStorage } from '../src/utils/storage.js';

beforeEach(() => {
  storage.reset();
  setLeague('100');
});

const storeLeaguePlayers = (leagueId, fetchedAt, size) => {
  storage.setItem(`ff-extender-${leagueId}-hockey_players`, 'x'.repeat(size));
  storage.setItem(`ff-extender-${leagueId}-hockey_playersMeta`, JSON.stringify({ statsEpoch: fetchedAt }));
};

const storedLeagues = () => Object.keys(storage)
  .filter(key => key.endsWith('-hockey_players'))
  .map(key => key.split('-')[2])
  .sort();

test('stores and reads values per league', () => {
  assert.equal(setLocalStorage('thing', { a: 1 }), true);
  assert.deepEqual(getLocalStorage('thing'), { a: 1 });
  assert.equal(getLocalStorage('thing', '200'), null);
});

test('when full, removes other leagues\' players, least recently fetched first', () => {
  storeLeaguePlayers('1', 3000, 1000);
  storeLeaguePlayers('2', 1000, 1000);
  storeLeaguePlayers('3', 2000, 1000);
  storage.setQuota(storage.used() + 500);

  assert.equal(setLocalStorage('hockey_players', 'y'.repeat(800)), true);

  // League 2 was the oldest, removing it was enough
  assert.deepEqual(storedLeagues(), ['1', '100', '3']);
  assert.equal(storage.getItem('ff-extender-2-hockey_playersMeta'), null);
});

test('returns false when there is no room even after removing other leagues', () => {
  storeLeaguePlayers('1', 1000, 100);
  storage.setQuota(storage.used() + 100);

  assert.equal(setLocalStorage('hockey_players', 'y'.repeat(1000)), false);
  assert.equal(getLocalStorage('hockey_players'), null);
});

test('never removes the current league\'s other data', () => {
  setLocalStorage('vuex-state', { favoriteTeam: 'Seattle Kraken' });
  storage.setQuota(storage.used() + 10);

  assert.equal(setLocalStorage('hockey_players', 'y'.repeat(100)), false);
  assert.deepEqual(getLocalStorage('vuex-state'), { favoriteTeam: 'Seattle Kraken' });
});

test('reset only clears this app\'s keys', () => {
  setLocalStorage('hockey_players', []);
  setLocalStorage('vuex-state', {}, '200');
  storage.setItem('fleaflicker-setting', 'keep');

  clearAllLocalStorage();

  assert.deepEqual(Object.keys(storage), ['fleaflicker-setting']);
});
