import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { storage, setLeague, resetStorage, withoutIndexedDb } from './support/fakeFlea.mjs';
import { getStored, setStored, setStoredEntries, removeStored, clearAllStored } from '../src/utils/db.js';
import { getLocalStorage } from '../src/utils/storage.js';

beforeEach(async () => {
  await resetStorage();
  setLeague('100');
});

test('stores and reads values per league', async () => {
  assert.equal(await setStored('thing', { a: 1 }), true);
  assert.deepEqual(await getStored('thing'), { a: 1 });
  assert.equal(await getStored('thing', '200'), null);
  // Not in localStorage
  assert.equal(storage.getItem('ff-extender-100-thing'), null);
});

test('values from older versions are moved out of localStorage on first read', async () => {
  storage.setItem('ff-extender-100-hockey_players', JSON.stringify([{ id: 1 }]));

  assert.deepEqual(await getStored('hockey_players'), [{ id: 1 }]);
  assert.equal(storage.getItem('ff-extender-100-hockey_players'), null);
  assert.deepEqual(await getStored('hockey_players'), [{ id: 1 }]);
});

test('entries are stored together', async () => {
  await setStoredEntries({ hockey_players: [1, 2], hockey_playersMeta: { statsEpoch: 5 } });

  assert.deepEqual(await getStored('hockey_players'), [1, 2]);
  assert.deepEqual(await getStored('hockey_playersMeta'), { statsEpoch: 5 });
});

test('values that cannot be cloned are stored as plain copies', async () => {
  assert.equal(await setStored('thing', { a: 1, fn: () => {} }), true);
  assert.deepEqual(await getStored('thing'), { a: 1 });
});

test('removing a value removes it from both stores', async () => {
  await setStored('thing', 1);
  storage.setItem('ff-extender-100-thing', '1');

  await removeStored('thing');

  assert.equal(await getStored('thing'), null);
  assert.equal(storage.getItem('ff-extender-100-thing'), null);
});

test('clearing removes only this app\'s data', async () => {
  await setStored('thing', 1);
  await setStored('thing', 2, '200');
  storage.setItem('ff-extender-100-vuex-state', '{}');
  storage.setItem('fleaflicker-setting', 'keep');

  await clearAllStored();

  assert.equal(await getStored('thing'), null);
  assert.equal(await getStored('thing', '200'), null);
  assert.deepEqual(Object.keys(storage), ['fleaflicker-setting']);
});

test('without IndexedDB, values are kept in localStorage', async () => {
  await withoutIndexedDb(async () => {
    assert.equal(await setStoredEntries({ a: 1, b: { c: 2 } }), true);
    assert.equal(getLocalStorage('a'), 1);
    assert.deepEqual(await getStored('b'), { c: 2 });

    storage.setQuota(storage.used());
    assert.equal(await setStored('big', 'x'.repeat(100)), false);
  });
});
