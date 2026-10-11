import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createFakeFlea, startClock, stopClock, advanceClock, settle, setLeague, resetStorage } from './support/fakeFlea.mjs';
import { convertActivityItem, syncActivity, getActivityLog, ACTIVITY_KINDS } from '../src/hockey/collections/activity.js';
import { loadHockeyPlayers } from '../src/hockey/collections/players.js';

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
const LEAGUE = '100';

// Trimmed FetchLeagueActivity items from a real league
const SAMPLES = JSON.parse(readFileSync(new URL('./fixtures/activityItems.json', import.meta.url)));

let flea;
let start;

beforeEach(async () => {
  await resetStorage();
  setLeague(LEAGUE);
  start = startClock();
  flea = createFakeFlea();
});

afterEach(stopClock);

// An add of player `playerId` by Team A at `time`, newest first like fleaflicker
const pushAdd = (time, playerId = 1) => {
  flea.activity.unshift({
    timeEpochMilli: String(time),
    transaction: {
      player: { proPlayer: { id: playerId, nameFull: `Player ${playerId}` }, owner: { name: 'Team A' } },
      team: { id: 1, name: 'Team A' },
    },
  });
};

const sync = (options) => settle(syncActivity(LEAGUE, { now: Date.now(), ...options }));

test('converts each kind of activity item', () => {
  const add = convertActivityItem(SAMPLES.add);
  assert.equal(add.kind, ACTIVITY_KINDS.add);
  assert.equal(add.time, 1791720242000);
  assert.equal(add.playerName, 'Jonathan Lekkerimäki');
  assert.equal(add.playerTeam, 'VAN');
  assert.equal(add.teamName, "Rob Blake's Boys Club");
  assert.equal(add.owner, "Rob Blake's Boys Club");
  assert.equal(add.unknownOwnership, false);

  const claim = convertActivityItem(SAMPLES.claim);
  assert.equal(claim.kind, ACTIVITY_KINDS.claim);
  assert.equal(claim.claimTeams, 1);

  const drop = convertActivityItem(SAMPLES.drop);
  assert.equal(drop.kind, ACTIVITY_KINDS.drop);
  assert.equal(drop.injury, 'IR');

  assert.equal(convertActivityItem(SAMPLES.irOn).kind, ACTIVITY_KINDS.irOn);
  assert.equal(convertActivityItem(SAMPLES.irOff).kind, ACTIVITY_KINDS.irOff);
});

test('trades and commissioner moves are marked as not saying who owns whom', () => {
  assert.equal(convertActivityItem({ timeEpochMilli: '1', trade: {} }).unknownOwnership, true);
  assert.equal(convertActivityItem({ timeEpochMilli: '1', transaction: { commishPowers: true } }).unknownOwnership, true);
  assert.equal(convertActivityItem({ timeEpochMilli: '1', membership: {} }).kind, ACTIVITY_KINDS.membership);
});

test('first sync reads back to since, later syncs only read new items', async () => {
  for (let i = 0; i < 70; i++) {
    pushAdd(start - (70 - i) * 60 * MINUTE, i + 1);
  }

  const first = await sync({ since: start - 14 * DAY });
  assert.equal(flea.callsTo('FetchLeagueActivity'), 3);
  assert.equal(first.items.length, 70);
  assert.equal(first.items[0].playerId, 70, 'newest first');

  pushAdd(start + MINUTE, 99);
  advanceClock(2 * MINUTE);
  flea.calls = [];

  const second = await sync({ since: start - 14 * DAY });
  assert.deepEqual(flea.calls, ['FetchLeagueActivity']);
  assert.equal(second.items.length, 71);
  assert.equal(second.items[0].playerId, 99);
});

test('items read again are not duplicated', async () => {
  pushAdd(start - MINUTE);
  await sync({ since: start - DAY });
  advanceClock(MINUTE);

  const log = await sync({ since: start - DAY });

  assert.equal(log.items.length, 1);
});

test('reaching further back than stored reads older pages', async () => {
  for (let i = 0; i < 40; i++) {
    pushAdd(start - (40 - i) * 12 * 60 * MINUTE, i + 1);
  }
  await sync({ since: start - 2 * DAY });
  const shortLog = await getActivityLog(LEAGUE);
  assert.equal(shortLog.items.length, 3);

  const log = await sync({ since: start - 14 * DAY });

  assert.equal(log.items.length, 27);
  assert.equal(log.coveredFrom, start - 14 * DAY);
});

test('returns null when more pages would be needed than allowed', async () => {
  for (let i = 0; i < 100; i++) {
    pushAdd(start - (100 - i) * MINUTE, i + 1);
  }

  assert.equal(await sync({ since: start - DAY, maxPages: 2 }), null);
});

test('items older than four weeks are dropped', async () => {
  pushAdd(start - 30 * DAY, 1);
  pushAdd(start - DAY, 2);
  await sync({ since: start - 40 * DAY });
  advanceClock(DAY);

  const log = await sync({ since: start - DAY });

  assert.deepEqual(log.items.map(item => item.playerId), [2]);
});

test('player ownership uses activity the timeline already read', async () => {
  await settle(loadHockeyPlayers(LEAGUE));
  flea.addTransaction(start + MINUTE, 5, 'Team B');
  advanceClock(2 * MINUTE);
  // The League tab reads the new activity first
  await sync({ since: start - 14 * DAY });
  advanceClock(4 * MINUTE);

  const result = await settle(loadHockeyPlayers(LEAGUE, true, true));

  assert.equal(result.players.find(player => player.id === 5).owner, 'Team B');
});
