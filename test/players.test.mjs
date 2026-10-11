import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeFlea, startClock, stopClock, advanceClock, settle, storage, setLeague, resetStorage, withoutIndexedDb } from './support/fakeFlea.mjs';
import { loadHockeyPlayers, LOAD_ERRORS } from '../src/hockey/collections/players.js';
import { getLocalStorage, setLocalStorage } from '../src/utils/storage.js';
import { getStored, setStored } from '../src/utils/db.js';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const LEAGUE = '100';

let flea;
let start;

beforeEach(async () => {
  await resetStorage();
  setLeague(LEAGUE);
  start = startClock();
  flea = createFakeFlea();
});

afterEach(stopClock);

const load = (options = {}) => settle(loadHockeyPlayers(
  options.leagueId === undefined ? LEAGUE : options.leagueId,
  options.stopIfNoPoints ?? true,
  options.forceRefresh ?? false,
));

const playerById = (result, id) => result.players.find(player => player.id === id);

// A schedule with games at these times, as getGamesThisWeek stores it
const storeSchedule = (gameStartTimes) => setLocalStorage('gamesThisWeek', { gameStartTimes });

test('first load fetches every page of players with points', async () => {
  const result = await load();

  // Pages of 30: the third page is the first ending in a player without points
  assert.equal(flea.callsTo('FetchPlayerListing'), 3);
  assert.equal(result.players.length, 90);
  assert.equal(result.error, undefined);
  // When the fetch started. Waiting on storage moves the test clock on a little first.
  assert.ok(result.savedAt >= start && result.savedAt < start + MINUTE);
  assert.equal(result.savedAt, (await getStored('hockey_playersMeta')).statsEpoch);
  assert.equal((await getStored('hockey_players')).length, 90);
});

test('reloading soon after makes no calls, then checks activity after 5 minutes', async () => {
  await load();
  flea.calls = [];

  await load();
  assert.deepEqual(flea.calls, []);

  advanceClock(5 * MINUTE);
  await load();
  assert.deepEqual(flea.calls, ['FetchLeagueActivity']);
});

test('refresh applies ownership changes from league activity', async () => {
  await load();
  flea.addTransaction(start + MINUTE, 1, 'Team A');
  flea.addTransaction(start + 2 * MINUTE, 2, 'Team B');
  flea.addTransaction(start + 3 * MINUTE, 1, undefined);
  advanceClock(4 * MINUTE);
  flea.calls = [];

  const result = await load({ forceRefresh: true });

  assert.deepEqual(flea.calls, ['FetchLeagueActivity']);
  // Player 1 was added then dropped, the current owner wins
  assert.equal(playerById(result, 1).owner, undefined);
  assert.equal(playerById(result, 2).owner, 'Team B');
  assert.equal((await getStored('hockey_players')).find(player => player.id === 2).owner, 'Team B');
});

test('activity already applied is not fetched again', async () => {
  await load();
  flea.addTransaction(start + MINUTE, 2, 'Team B');
  advanceClock(2 * MINUTE);
  await load({ forceRefresh: true });

  // Next check only needs the newest page and finds nothing new
  const before = (await getStored('hockey_playersMeta')).activityEpoch;
  await load({ forceRefresh: true });
  assert.equal((await getStored('hockey_playersMeta')).activityEpoch, before);
  assert.equal(before, start + MINUTE);
});

test('trades fall back to a full fetch', async () => {
  await load();
  flea.activity.unshift({ timeEpochMilli: String(start + MINUTE), trade: { description: 'A trade' } });
  advanceClock(2 * MINUTE);
  flea.calls = [];

  await load({ forceRefresh: true });

  assert.equal(flea.callsTo('FetchLeagueActivity'), 1);
  assert.equal(flea.callsTo('FetchPlayerListing'), 3);
});

test('membership changes clear the cached league info, which has the team names', async () => {
  await load();
  await setStored('hockey_league', { name: 'League', teams: [{ name: 'Old Team' }] });
  flea.activity.unshift({ timeEpochMilli: String(start + MINUTE), membership: {} });
  advanceClock(2 * MINUTE);

  await load({ forceRefresh: true });

  assert.equal(await getStored('hockey_league'), null);
});

test('more than 5 pages of activity falls back to a full fetch', async () => {
  await load();
  for (let i = 1; i <= 200; i++) {
    flea.addTransaction(start + i * 1000, (i % 50) + 1, 'Team A');
  }
  advanceClock(5 * MINUTE);
  flea.calls = [];

  await load({ forceRefresh: true });

  assert.equal(flea.callsTo('FetchLeagueActivity'), 5);
  assert.equal(flea.callsTo('FetchPlayerListing'), 3);
});

test('stats are refetched on a new day (Eastern)', async () => {
  await load();
  storeSchedule([]);
  // start is noon Eastern, so 12 hours later is the next day there
  advanceClock(12 * HOUR);
  flea.calls = [];

  await load();

  assert.equal(flea.callsTo('FetchPlayerListing'), 3);
});

test('stats are not refetched when no game was played since', async () => {
  await load();
  storeSchedule([start + 8 * HOUR]);
  advanceClock(2 * HOUR);
  flea.calls = [];

  await load();

  assert.equal(flea.callsTo('FetchPlayerListing'), 0);
});

test('stats are refetched while a game is being played, at most every 30 minutes', async () => {
  await load();
  storeSchedule([start + HOUR]);
  advanceClock(HOUR + 20 * MINUTE);
  flea.calls = [];

  await load();
  assert.equal(flea.callsTo('FetchPlayerListing'), 3);

  advanceClock(10 * MINUTE);
  flea.calls = [];
  await load();
  assert.equal(flea.callsTo('FetchPlayerListing'), 0);

  // The refresh button allows it every 5 minutes
  await load({ forceRefresh: true });
  assert.equal(flea.callsTo('FetchPlayerListing'), 3);
});

test('without a stored schedule stats are refetched after 30 minutes', async () => {
  await load();
  advanceClock(31 * MINUTE);
  flea.calls = [];

  await load();

  assert.equal(flea.callsTo('FetchPlayerListing'), 3);
});

test('players stored by an older version are refetched', async () => {
  await load();
  const meta = await getStored('hockey_playersMeta');
  delete meta.format;
  await setStored('hockey_playersMeta', meta);
  flea.calls = [];

  await load();

  assert.equal(flea.callsTo('FetchPlayerListing'), 3);
});

test('changing the points setting refetches everything', async () => {
  await load();
  flea.calls = [];

  const result = await load({ stopIfNoPoints: false });

  assert.equal(flea.callsTo('FetchPlayerListing'), 4);
  assert.equal(result.players.length, 120);
});

test('overlapping loads run one at a time and share the full fetch', async () => {
  const [first, second] = await settle(Promise.all([
    loadHockeyPlayers(LEAGUE, true, false),
    loadHockeyPlayers(LEAGUE, true, true),
  ]));

  assert.equal(flea.callsTo('FetchPlayerListing'), 3);
  assert.equal(first.players.length, 90);
  assert.equal(second.players.length, 90);
});

test('no league id', async () => {
  const result = await load({ leagueId: null });

  assert.deepEqual(result, { players: [], error: LOAD_ERRORS.noLeague });
  assert.deepEqual(flea.calls, []);
});

test('a league that does not exist', async () => {
  flea.fail = () => 404;

  const result = await load();

  assert.equal(result.error, LOAD_ERRORS.leagueNotFound);
  assert.deepEqual(result.players, []);
});

test('fleaflicker unreachable shows stored players', async () => {
  const { savedAt } = await load();
  advanceClock(31 * MINUTE);
  flea.fail = () => 'network';

  const result = await load();

  assert.equal(result.error, LOAD_ERRORS.unavailable);
  assert.equal(result.players.length, 90);
  assert.equal(result.savedAt, savedAt);
});

test('fleaflicker unreachable with nothing stored', async () => {
  flea.fail = () => 'network';

  const result = await load();

  assert.deepEqual(result, { players: [], error: LOAD_ERRORS.unavailable });
});

test('stored players from a different points setting are not shown', async () => {
  await load();
  flea.fail = () => 'network';

  const result = await load({ stopIfNoPoints: false });

  assert.deepEqual(result, { players: [], error: LOAD_ERRORS.unavailable });
});

test('players are shown even when they cannot be stored', async () => {
  await withoutIndexedDb(async () => {
    storage.setQuota(1000);

    const result = await load();

    assert.equal(result.players.length, 90);
    assert.equal(result.error, undefined);
    assert.equal(getLocalStorage('hockey_players'), null);
  });
});
