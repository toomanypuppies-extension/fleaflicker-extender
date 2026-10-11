import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pairSwaps, buildTimeline } from '../src/hockey/collections/timeline.js';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
// Sunday Oct 11 2026, noon Eastern
const NOON = Date.parse('2026-10-11T16:00:00Z');

let count = 0;
const item = (kind, time, teamId = 1, playerId = ++count) => ({
  key: `${time}|${kind}|${playerId}|${teamId}`, kind, time, teamId, teamName: `Team ${teamId}`, playerId, playerName: `Player ${playerId}`,
});

test('an add and a drop by the same team at the same time are one swap', () => {
  const added = item('add', NOON);
  const dropped = item('drop', NOON - 10 * 1000);
  const otherTeamDrop = item('drop', NOON, 2);

  const rows = pairSwaps([added, otherTeamDrop, dropped]);

  assert.equal(rows.length, 2);
  assert.equal(rows[0].kind, 'swap');
  assert.equal(rows[0].added, added);
  assert.equal(rows[0].dropped, dropped);
  assert.equal(rows[0].time, NOON);
  assert.equal(rows[1], otherTeamDrop);
});

test('claims pair with drops too, and moves far apart stay separate', () => {
  const claim = item('claim', NOON);
  const drop = item('drop', NOON - 30 * MINUTE);

  assert.deepEqual(pairSwaps([claim, drop]).map(row => row.kind), ['claim', 'drop']);
  assert.deepEqual(pairSwaps([item('claim', NOON), item('drop', NOON - MINUTE)]).map(row => row.kind), ['swap']);
});

test('each drop pairs with only one add', () => {
  const rows = pairSwaps([item('add', NOON), item('add', NOON), item('drop', NOON)]);
  assert.deepEqual(rows.map(row => row.kind), ['swap', 'add']);
});

test('the timeline is grouped by Eastern day, newest first', () => {
  const items = [
    item('add', NOON),
    item('irOn', NOON - 2 * HOUR),
    // 11 PM Eastern Saturday, already Sunday in UTC
    item('drop', Date.parse('2026-10-11T03:00:00Z')),
    item('add', NOON - 20 * 24 * HOUR),
  ];

  const days = buildTimeline(items, { since: NOON - 14 * 24 * HOUR });

  assert.deepEqual(days.map(day => [day.date, day.rows.map(row => row.kind)]), [
    ['2026-10-11', ['add', 'irOn']],
    ['2026-10-10', ['drop']],
  ]);
});

test('the timeline filters by team and kind, and marks the current matchup', () => {
  const items = [
    item('add', NOON, 1),
    item('drop', NOON, 1),
    item('irOn', NOON - HOUR, 1),
    item('add', NOON - 2 * HOUR, 2),
    item('drop', NOON - 3 * 24 * HOUR, 1),
  ];
  const kinds = (options) => buildTimeline(items, { since: 0, ...options }).flatMap(day => day.rows.map(row => row.kind));

  assert.deepEqual(kinds({ teamId: 1 }), ['swap', 'irOn', 'drop']);
  assert.deepEqual(kinds({ filters: ['adds'] }), ['swap', 'add']);
  assert.deepEqual(kinds({ filters: ['ir', 'drops'] }), ['swap', 'irOn', 'drop']);

  const rows = buildTimeline(items, { since: 0, period: { start: NOON - 24 * HOUR } }).flatMap(day => day.rows);
  assert.deepEqual(rows.map(row => row.inPeriod), [true, true, true, false]);
});
