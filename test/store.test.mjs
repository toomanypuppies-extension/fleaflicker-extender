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
  // The app's own colors to start with
  assert.equal(store.state.settings.colorTheme, 'default');
  store.commit('setKeyValue', { key: 'settings.colorTheme', value: 'team' });
  const teamColors = [store.getters.teamMainColor, store.getters.teamSecondaryColor];

  store.commit('setKeyValue', { key: 'settings.colorTheme', value: 'default' });
  assert.deepEqual([store.getters.teamMainColor, store.getters.teamSecondaryColor], [DEFAULT_THEME_COLORS.primary, DEFAULT_THEME_COLORS.secondary]);
  assert.deepEqual(store.getters.chartColors, FALLBACK_COLORS.dark);

  store.commit('setKeyValue', { key: 'settings.colorTheme', value: 'team' });
  assert.deepEqual([store.getters.teamMainColor, store.getters.teamSecondaryColor], teamColors);
  // Your opponent wears the second chart color, the one they have in your matchup's charts
  assert.equal(store.getters.opponentColors.background, store.getters.chartColors[1]);
});

test('filters start on healthy free agents, saved filters get that once, and Clear goes back to it', async () => {
  storage.reset();
  const { store } = await import('../src/store.js');
  const load = (leagueId, saved) => {
    if (saved) storage.setItem(`ff-extender-${leagueId}-vuex-state`, JSON.stringify(saved));
    setLeague(leagueId);
    store.commit('loadLeagueState');
    return [store.state.ownership, store.state.injurySelections];
  };

  assert.deepEqual(load('600'), ['Free Agent', ['HEALTHY']]);
  // Saved before the defaults: unpicked filters take them
  assert.deepEqual(load('601', { ownership: '', injurySelections: [] }), ['Free Agent', ['HEALTHY']]);
  // Saved since: any injury (empty) and All stay
  assert.deepEqual(load('602', { ownership: 'All', injurySelections: [], filterDefaultsVersion: 1 }), ['All', []]);
  assert.deepEqual(load('603', { injurySelections: ['DTD'], filterDefaultsVersion: 1 }), ['Free Agent', ['DTD']]);
  // Team colors saved before the app's own became the default switch once, after that they stay
  load('604', { settings: { colorTheme: 'team' }, filterDefaultsVersion: 1 });
  assert.equal(store.state.settings.colorTheme, 'default');
  load('605', { settings: { colorTheme: 'team' }, filterDefaultsVersion: 2 });
  assert.equal(store.state.settings.colorTheme, 'team');
  // Every player is loaded unless Settings says otherwise: saved settings switch once, then stay
  assert.equal(load('606') && store.state.excludeIfNoPoints, false);
  load('607', { excludeIfNoPoints: true, filterDefaultsVersion: 2 });
  assert.equal(store.state.excludeIfNoPoints, false);
  load('608', { excludeIfNoPoints: true, filterDefaultsVersion: 3 });
  assert.equal(store.state.excludeIfNoPoints, true);

  store.commit('clearFilters');
  assert.deepEqual([store.state.ownership, store.state.injurySelections], ['Free Agent', ['HEALTHY']]);
});

test("fleaflicker links open in split screen's frame, and only close the panel over fleaflicker's page", async () => {
  storage.reset();
  setLeague('100');
  const { store, FLEA_FRAME_NAME } = await import('../src/store.js');
  store.commit('loadLeagueState');
  const set = (key, value) => store.commit('setKeyValue', { key, value });

  // The extension: links open in this tab, under the panel
  set('drawerExpanded', true);
  assert.equal(store.getters.fleaTarget, '_self');
  store.commit('leavingForFleaflicker');
  assert.equal(store.state.drawerExpanded, false);

  // Split screen side by side: the frame, beside the panel
  set('fleaFramed', true);
  set('splitActive', true);
  set('drawerExpanded', true);
  assert.equal(store.getters.fleaTarget, FLEA_FRAME_NAME);
  store.commit('leavingForFleaflicker');
  assert.equal(store.state.drawerExpanded, true);

  // Split screen in a narrow window: the frame, under the panel
  set('splitActive', false);
  assert.equal(store.getters.fleaTarget, FLEA_FRAME_NAME);
  store.commit('leavingForFleaflicker');
  assert.equal(store.state.drawerExpanded, false);

  // Whether it's showing isn't saved, Extension works it out again
  await wait(300);
  store.commit('loadLeagueState');
  assert.equal(store.state.fleaFramed, false);
  assert.equal(store.state.splitActive, false);
});
