import { test } from 'node:test';
import assert from 'node:assert/strict';
import { waiverStatus, latestDrops, WAIVER_STATUS, WAIVER_REASONS } from '../src/hockey/collections/waivers.js';
import { ACTIVITY_KINDS } from '../src/hockey/collections/activity.js';

const HOUR = 60 * 60 * 1000;

// The settings from a real league's rules page
const WAIVERS = {
  gameStartWaivers: true,
  hoursAfterDrop: 24,
  gameStartLockTime: { hour: 5, minute: 0 },
  firstComeFirstServedTime: { hour: 8, minute: 0 },
};

// Saturday Oct 10 2026, 7 PM EDT
const GAME_START = Date.parse('2026-10-10T23:00:00Z');
const PROCESSED = Date.parse('2026-10-11T09:00:00Z'); // 5 AM EDT Sunday
const FCFS_OPENS = Date.parse('2026-10-11T12:00:00Z'); // 8 AM EDT Sunday

const status = (player, now, { waivers = WAIVERS, drops = new Map() } = {}) => (
  waiverStatus({ id: 1, ...player }, { waivers, drops, now })
);

test('owned players', () => {
  assert.deepEqual(status({ owner: 'Team A' }, GAME_START), { status: WAIVER_STATUS.owned });
});

test('without the league settings the status is unknown', () => {
  assert.deepEqual(status({}, GAME_START, { waivers: null }), { status: WAIVER_STATUS.unknown });
});

test('a free agent before their game starts can be added', () => {
  assert.deepEqual(status({ todaysGameStart: GAME_START }, GAME_START - HOUR), { status: WAIVER_STATUS.free });
  assert.deepEqual(status({}, GAME_START), { status: WAIVER_STATUS.free });
});

test('once their game starts, free agents are on waivers until claims are processed', () => {
  assert.deepEqual(status({ todaysGameStart: GAME_START }, GAME_START), {
    status: WAIVER_STATUS.waivers,
    until: PROCESSED,
    reasons: [WAIVER_REASONS.gameStart],
  });
  assert.equal(status({ todaysGameStart: GAME_START }, PROCESSED - 1).until, PROCESSED);
});

test('after claims are processed, they can be added once first come first served opens', () => {
  assert.deepEqual(status({ todaysGameStart: GAME_START }, PROCESSED), { status: WAIVER_STATUS.locked, until: FCFS_OPENS });
  assert.deepEqual(status({ todaysGameStart: GAME_START }, FCFS_OPENS), { status: WAIVER_STATUS.free });
});

test('leagues without game-start waivers only put dropped players on waivers', () => {
  const waivers = { ...WAIVERS, gameStartWaivers: false };
  assert.deepEqual(status({ todaysGameStart: GAME_START }, GAME_START + HOUR, { waivers }), { status: WAIVER_STATUS.free });
});

test('dropped players are on waivers for 24 hours', () => {
  const droppedAt = GAME_START - 2 * HOUR;
  const drops = new Map([[1, droppedAt]]);

  assert.deepEqual(status({}, droppedAt + HOUR, { drops }), {
    status: WAIVER_STATUS.waivers,
    until: droppedAt + 24 * HOUR,
    reasons: [WAIVER_REASONS.drop],
  });
  assert.deepEqual(status({}, droppedAt + 24 * HOUR, { drops }), { status: WAIVER_STATUS.free });
});

test('dropped before their game, the later of the two applies', () => {
  const droppedAt = GAME_START - 2 * HOUR;
  const drops = new Map([[1, droppedAt]]);

  const result = status({ todaysGameStart: GAME_START }, GAME_START + HOUR, { drops });

  assert.equal(result.status, WAIVER_STATUS.waivers);
  assert.equal(result.until, droppedAt + 24 * HOUR);
  assert.deepEqual(result.reasons, [WAIVER_REASONS.drop, WAIVER_REASONS.gameStart]);
});

test('latest drops come from the activity log', () => {
  const drops = latestDrops([
    { kind: ACTIVITY_KINDS.drop, playerId: 1, time: 300 },
    { kind: ACTIVITY_KINDS.add, playerId: 1, time: 400 },
    { kind: ACTIVITY_KINDS.drop, playerId: 1, time: 100 },
    { kind: ACTIVITY_KINDS.drop, playerId: 2, time: 200 },
  ]);

  assert.deepEqual([...drops], [[1, 300], [2, 200]]);
});
