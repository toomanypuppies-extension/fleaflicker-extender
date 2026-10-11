import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeFlea, startClock, stopClock, settle, storage, setLeague } from './support/fakeFlea.mjs';
import { fleaClient } from '../src/utils/fleaClient.js';
import { getActivityToTimeEpochMilli, getLeagueStandings } from '../src/utils/flea.js';

let flea;
let start;

beforeEach(() => {
  storage.reset();
  setLeague('100');
  start = startClock();
  flea = createFakeFlea();
});

afterEach(stopClock);

test('activity is paged back to the target time, newer items only', async () => {
  for (let i = 1; i <= 70; i++) {
    flea.addTransaction(start + i * 1000, 1, 'Team A');
  }

  const items = await settle(getActivityToTimeEpochMilli('NHL', '100', start + 20 * 1000));

  // Newest first: items 70..21, which span pages 1 and 2
  assert.equal(items.length, 50);
  assert.equal(flea.callsTo('FetchLeagueActivity'), 2);
});

test('activity gives up past maxPages', async () => {
  for (let i = 1; i <= 70; i++) {
    flea.addTransaction(start + i * 1000, 1, 'Team A');
  }

  assert.equal(await settle(getActivityToTimeEpochMilli('NHL', '100', start, 2)), null);
});

test('throttled calls are retried after a backoff', async () => {
  let throttled = 2;
  flea.fail = () => (throttled-- > 0 ? 403 : undefined);

  const standings = await settle(getLeagueStandings('100'));

  assert.deepEqual(standings.divisions[0].teams.map(team => team.name), ['Team A', 'Team B']);
  assert.equal(flea.callsTo('FetchLeagueStandings'), 3);
  // Waited ~5s then ~15s
  assert.ok(Date.now() - start >= 20 * 1000);
});

test('throttled calls give up after 3 retries', async () => {
  flea.fail = () => 403;

  await assert.rejects(settle(fleaClient.get('https://www.fleaflicker.com/api/FetchLeagueStandings')));

  assert.equal(flea.callsTo('FetchLeagueStandings'), 4);
});

test('calls are spaced out', async () => {
  const times = [];
  const adapter = fleaClient.defaults.adapter;
  fleaClient.defaults.adapter = (config) => {
    times.push(Date.now());
    return adapter(config);
  };

  await settle(Promise.all([1, 2, 3].map(() => getLeagueStandings('100'))));

  assert.equal(times.length, 3);
  assert.ok(times[1] - times[0] >= 300);
  assert.ok(times[2] - times[1] >= 300);
});
