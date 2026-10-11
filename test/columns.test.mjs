import { test } from 'node:test';
import assert from 'node:assert/strict';
import { visibleColumns, cellText, COLUMNS_BY_KEY, DEFAULT_COLUMN_KEYS, usesLastSeason, STAT_FILTER_COLUMNS } from '../src/hockey/collections/columns.js';
import { availabilityLabel, availabilityOrder } from '../src/hockey/collections/waivers.js';

const keys = (columns) => columns.map(column => column.key);

test('default columns until some are chosen, name is always shown', () => {
  assert.deepEqual(keys(visibleColumns([])), DEFAULT_COLUMN_KEYS);
  assert.deepEqual(keys(visibleColumns(['avg', 'lastSeasonAvg', 'unknown'])), ['name', 'avg', 'lastSeasonAvg']);
});

test('columns are shown in table order, not the order they were picked', () => {
  assert.deepEqual(keys(visibleColumns(['lastSeasonAvg', 'team'])), ['name', 'team', 'lastSeasonAvg']);
});

test('last season stats are only needed for last season columns', () => {
  assert.equal(usesLastSeason(['avg', 'points']), false);
  assert.equal(usesLastSeason(['avg', 'lastSeasonRank']), true);
});

test('formatted cells', () => {
  assert.equal(cellText(COLUMNS_BY_KEY.savePct, { savePct: 0.91234 }), '.912');
  assert.equal(cellText(COLUMNS_BY_KEY.savePct, {}), '');
  assert.equal(cellText(COLUMNS_BY_KEY.positionRank, { positionRank: 4, positionRankLabel: 'C' }), 'C4');
  assert.equal(cellText(COLUMNS_BY_KEY.consistency, { consistency: 4.75803 }), '4.76');
  assert.equal(cellText(COLUMNS_BY_KEY.owner, {}), '');
  assert.equal(cellText(COLUMNS_BY_KEY.avg, { avg: 0 }), 0);
});

test('stat filters only offer numeric columns', () => {
  assert.ok(STAT_FILTER_COLUMNS.every(column => column.sortType && !['name', 'team'].includes(column.key)));
  assert.ok(STAT_FILTER_COLUMNS.some(column => column.key === 'lastSeasonAvg'));
});

test('availability text and order', () => {
  const now = Date.parse('2026-10-11T14:00:00');
  const later = Date.parse('2026-10-11T19:00:00');
  assert.equal(availabilityLabel({ status: 'free' }, now), 'Free agent');
  assert.match(availabilityLabel({ status: 'waivers', until: later }, now), /^Waivers until 7:00/);
  assert.match(availabilityLabel({ status: 'locked', until: later }, now), /^Addable 7:00/);
  assert.equal(availabilityLabel({ status: 'owned' }, now), '');
  assert.equal(availabilityLabel(undefined, now), '');

  assert.equal(availabilityOrder({ status: 'free' }), 0);
  assert.equal(availabilityOrder({ status: 'waivers', until: later }), later);
  assert.equal(availabilityOrder({ status: 'owned' }), undefined);
});
