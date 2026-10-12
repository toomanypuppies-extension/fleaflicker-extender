import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { storage } from './support/fakeFlea.mjs';
import { getRecentLeagues, recordLeagueVisit, forgetRecentLeague } from '../src/utils/recentLeagues.js';

beforeEach(() => storage.reset());

test('visits are listed most recent first, once per league', () => {
  recordLeagueVisit({ id: 12089, name: 'Messier - D3' }, 1);
  recordLeagueVisit({ id: '12086', name: 'Gretzky - D1' }, 2);
  recordLeagueVisit({ id: '12089', name: 'Messier - D3' }, 3);

  assert.deepEqual(getRecentLeagues(), [
    { id: '12089', name: 'Messier - D3', sport: 'nhl', lastVisited: 3 },
    { id: '12086', name: 'Gretzky - D1', sport: 'nhl', lastVisited: 2 },
  ]);
});

test('a visit without a name keeps the name from before', () => {
  recordLeagueVisit({ id: '1', name: 'League' }, 1);
  recordLeagueVisit({ id: '1' }, 2);

  assert.equal(getRecentLeagues()[0].name, 'League');
});

test('only the 10 most recent leagues are kept', () => {
  for (let i = 1; i <= 12; i++) {
    recordLeagueVisit({ id: i }, i);
  }

  const leagues = getRecentLeagues();
  assert.equal(leagues.length, 10);
  assert.equal(leagues[0].id, '12');
  assert.equal(leagues[9].id, '3');
});

test('a league can be forgotten', () => {
  recordLeagueVisit({ id: '1' }, 1);
  recordLeagueVisit({ id: '2' }, 2);

  forgetRecentLeague(1);

  assert.deepEqual(getRecentLeagues().map(league => league.id), ['2']);
});

test('unreadable stored data is ignored', () => {
  storage.setItem('ff-extender-recentLeagues', '{nope');
  assert.deepEqual(getRecentLeagues(), []);
});
