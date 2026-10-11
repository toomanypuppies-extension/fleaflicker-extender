import { test } from 'node:test';
import assert from 'node:assert/strict';
import { storage, setLeague } from './support/fakeFlea.mjs';

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

test('each league keeps its own filters when switching leagues without a reload', async () => {
  storage.reset();
  setLeague('100');
  const { store } = await import('../src/store.js');
  store.commit('loadLeagueState');
  store.commit('setKeyValue', { key: 'filter', value: 'McDavid' });
  store.commit('setKeyValue', { key: 'teamSelections', value: ['Seattle Kraken'] });
  // Saving is debounced
  await wait(300);

  // Another league opened from the home page
  setLeague('200');
  store.commit('loadLeagueState');
  assert.equal(store.state.leagueId, '200');
  assert.equal(store.state.filter, '');
  assert.deepEqual(store.state.teamSelections, []);
  store.commit('setKeyValue', { key: 'filter', value: 'Hughes' });
  await wait(300);

  setLeague('100');
  store.commit('loadLeagueState');
  assert.equal(store.state.filter, 'McDavid');
  assert.deepEqual(store.state.teamSelections, ['Seattle Kraken']);

  setLeague('200');
  store.commit('loadLeagueState');
  assert.equal(store.state.filter, 'Hughes');
  assert.deepEqual(store.state.teamSelections, []);
});

test('open dialogs and the open player card are not restored', async () => {
  storage.reset();
  setLeague('300');
  const { store } = await import('../src/store.js');
  store.commit('loadLeagueState');
  store.commit('setKeyValue', { key: 'selectedPlayer', value: { id: 1, name: 'Player' } });
  store.commit('setKeyValue', { key: 'openSettings', value: true });
  await wait(300);

  store.commit('loadLeagueState');

  assert.equal(store.state.selectedPlayer, null);
  assert.equal(store.state.openSettings, false);
});
