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

test('the old League tab opens on its new tab', async () => {
  storage.reset();
  const { store } = await import('../src/store.js');
  for (const [leagueId, section, tab] of [['500', 'matchups', 'matchups'], ['501', 'activity', 'rosters'], ['502', 'rosters', 'rosters']]) {
    storage.setItem(`ff-extender-${leagueId}-vuex-state`, JSON.stringify({ activeTab: 'league', leagueSection: section }));
    setLeague(leagueId);
    store.commit('loadLeagueState');
    assert.equal(store.state.activeTab, tab);
    assert.equal(store.state.leagueSection, undefined);
  }
});

test('the default theme replaces the favorite team colors, charts included', async () => {
  storage.reset();
  setLeague('600');
  const { store, DEFAULT_THEME_COLORS } = await import('../src/store.js');
  const { FALLBACK_COLORS } = await import('../src/hockey/chartColors.js');
  store.commit('loadLeagueState');
  const teamColors = [store.getters.teamMainColor, store.getters.teamSecondaryColor];

  store.commit('setKeyValue', { key: 'settings.colorTheme', value: 'default' });
  assert.deepEqual([store.getters.teamMainColor, store.getters.teamSecondaryColor], [DEFAULT_THEME_COLORS.primary, DEFAULT_THEME_COLORS.secondary]);
  assert.deepEqual(store.getters.chartColors, FALLBACK_COLORS.dark);

  store.commit('setKeyValue', { key: 'settings.colorTheme', value: 'team' });
  assert.deepEqual([store.getters.teamMainColor, store.getters.teamSecondaryColor], teamColors);
  // Your opponent wears the second chart color, the one they have in your matchup's charts
  assert.equal(store.getters.opponentColors.background, store.getters.chartColors[1]);
});
