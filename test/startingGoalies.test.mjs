import { test, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import { resetStorage } from './support/fakeFlea.mjs';
import { loadStartingGoalies, goalieStarts, goalieStartLabel } from '../src/hockey/collections/startingGoalies.js';

const MINUTE = 60 * 1000;
const NOW = Date.parse('2026-10-12T14:00:00Z');

const side = (team, goalie, status = null) => ({ team, goalie, status, details: status ? `${goalie} starts.` : null, source: null, sourceUrl: null });
const DAY = {
  date: '2026-10-12',
  games: [
    { start: '2026-10-12T23:00:00.000Z', away: side('St Louis Blues', 'Jordan Binnington', 'Confirmed'), home: side('Ottawa Senators', 'Linus Ullmark') },
    { start: '2026-10-13T00:00:00.000Z', away: side('Montreal Canadiens', 'Samuel Montembeault'), home: side('Unknown Team', 'Nobody') },
  ],
  complete: false,
};

let responses;
let requested;

beforeEach(async () => {
  await resetStorage();
  requested = [];
  responses = [];
  mock.method(axios, 'get', async (url) => {
    requested.push(url.split('/').pop());
    const next = responses.shift();
    if (next instanceof Error) throw next;
    return { data: next };
  });
});

afterEach(() => mock.restoreAll());

test("a day's starters are kept, fetched again while unsettled, and never once all are confirmed", async () => {
  responses = [DAY, DAY, { ...DAY, complete: true }];

  const first = await loadStartingGoalies('2026-10-12', { now: NOW });
  assert.equal(first.fetchedAt, NOW);
  assert.equal(first.games.length, 2);

  await loadStartingGoalies('2026-10-12', { now: NOW + 5 * MINUTE });
  assert.equal(requested.length, 1);
  // Refresh asks again
  await loadStartingGoalies('2026-10-12', { now: NOW + 6 * MINUTE, forceRefresh: true });
  assert.equal(requested.length, 2);

  const settled = await loadStartingGoalies('2026-10-12', { now: NOW + 30 * MINUTE });
  assert.equal(settled.complete, true);
  await loadStartingGoalies('2026-10-12', { now: NOW + 300 * MINUTE, forceRefresh: true });
  assert.equal(requested.length, 3);
});

test("what's stored is used when the proxy can't be reached", async () => {
  responses = [DAY, new Error('offline'), new Error('offline')];
  await loadStartingGoalies('2026-10-12', { now: NOW });

  const day = await loadStartingGoalies('2026-10-12', { now: NOW + 20 * MINUTE });
  assert.equal(day.fetchedAt, NOW);
  assert.equal(await loadStartingGoalies('2026-10-13', { now: NOW }), null);
});

test('goalies are matched by team and name, and their teammates are backups', () => {
  const players = [
    { id: 1, name: 'Jordan Binnington', team: 'STL', position: 'G' },
    { id: 2, name: 'Joel Hofer', team: 'STL', position: 'G' },
    // Accents, and a name written differently: matched by last name, the only one on the team
    { id: 3, name: 'Linus Ullmark', team: 'OTT', position: 'G' },
    { id: 4, name: 'Sam Montembeault', team: 'MTL', position: 'G' },
    { id: 5, name: 'Jordan Kyrou', team: 'STL', position: 'RW' },
    // A team without a game
    { id: 6, name: 'Joey Daccord', team: 'SEA', position: 'G' },
  ];
  const starts = goalieStarts({ ...DAY, fetchedAt: NOW }, players);

  assert.deepEqual([...starts.keys()].sort(), [1, 2, 3, 4]);
  assert.deepEqual(starts.get(1), {
    starting: true, status: 'Confirmed', starter: 'Jordan Binnington', details: 'Jordan Binnington starts.', source: null, sourceUrl: null,
    date: '2026-10-12', fetchedAt: NOW,
  });
  assert.equal(starts.get(2).starting, false);
  assert.equal(starts.get(2).starter, 'Jordan Binnington');
  assert.equal(starts.get(4).starting, true);
  assert.deepEqual([1, 2, 3].map(id => goalieStartLabel(starts.get(id))), ['Confirmed', '', 'Unconfirmed']);
  assert.equal(goalieStartLabel({ starting: true, status: 'Likely' }), 'Likely');
  assert.equal(goalieStartLabel(starts.get(6)), '');
});
