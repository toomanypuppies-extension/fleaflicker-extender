import { test } from 'node:test';
import assert from 'node:assert/strict';
import { navFromState, stateFromNav, sameNav, queryWithNav, queryHasNav } from '../src/hockey/navigation.js';

const state = (overrides) => ({ activeTab: 'players', selectedPeriod: null, openMatchupId: null, openTeamId: null, ...overrides });

test("the page is only what the tab shows", () => {
  assert.deepEqual(navFromState(state()), { tab: 'players' });
  // A matchup and week left from the Matchups tab aren't part of the Players page
  assert.deepEqual(navFromState(state({ selectedPeriod: 3, openMatchupId: 3603041 })), { tab: 'players' });
  assert.deepEqual(navFromState(state({ activeTab: 'matchups', selectedPeriod: 3, openMatchupId: '3603041' })),
    { tab: 'matchups', week: '3', matchup: '3603041' });
  assert.deepEqual(navFromState(state({ activeTab: 'rosters', openTeamId: 7, openMatchupId: 1 })), { tab: 'rosters', team: '7' });
  assert.deepEqual(navFromState(state({ activeTab: 'schedule', selectedPeriod: 4 })), { tab: 'schedule', week: '4' });
});

test('a page back to the store, round trip', () => {
  const page = state({ activeTab: 'matchups', selectedPeriod: 3, openMatchupId: '3603041', openTeamId: 7 });
  assert.deepEqual(stateFromNav(navFromState(page)), page);
  // Missing keys close what was open
  assert.deepEqual(stateFromNav({ tab: 'matchups' }), state({ activeTab: 'matchups' }));
  assert.equal(stateFromNav({ tab: 'nope' }), null);
  assert.equal(stateFromNav({}), null);
  assert.equal(stateFromNav({ tab: 'league' }).activeTab, 'matchups');
});

test('comparing pages and updating a URL query', () => {
  assert.ok(sameNav({ tab: 'matchups', week: '3' }, { week: '3', tab: 'matchups' }));
  assert.ok(!sameNav({ tab: 'matchups', week: '3' }, { tab: 'matchups' }));
  assert.deepEqual(queryWithNav({ tab: 'matchups', matchup: '1', other: 'x' }, { tab: 'players' }), { other: 'x', tab: 'players' });
  assert.ok(queryHasNav({ tab: 'players' }));
  assert.ok(!queryHasNav({ other: 'x' }));
});
