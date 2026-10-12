import { test, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import { resetStorage } from './support/fakeFlea.mjs';
import {
  weekStart, periodDates, loadScheduleWeeks, mergeScheduleWeeks, periodSchedule, coversPeriod, gamesLeftByTeam, todaysGamesByTeam,
} from '../src/hockey/collections/scheduleWeeks.js';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
// Matchup period 2 in league 12089: Mon Oct 5 to Sun Oct 11, days 7 to 13
const PERIOD_2 = { ordinal: 2, start: Date.parse('2026-10-05T10:00:00Z'), end: Date.parse('2026-10-12T10:00:00Z'), firstDay: 7, lastDay: 13 };
// The all-star break period: two weeks
const BREAK = { ordinal: 19, start: Date.parse('2027-02-01T11:00:00Z'), end: Date.parse('2027-02-15T11:00:00Z'), firstDay: 120, lastDay: 133 };
// Thursday Oct 8, noon Eastern
const NOW = Date.parse('2026-10-08T16:00:00Z');

const dateAfter = (date, days) => new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);

// The NHL's response for the 7 days from a date, one SEA game a day
const nhlWeek = (start) => ({
  gameWeek: Array.from({ length: 7 }, (_, i) => ({
    date: dateAfter(start, i),
    dayAbbrev: 'MON',
    games: [{ awayTeam: { abbrev: 'SEA' }, homeTeam: { abbrev: 'VAN' }, startTimeUTC: `${dateAfter(start, i)}T23:00:00Z` }],
  })),
});

let requested;

beforeEach(async () => {
  await resetStorage();
  requested = [];
  mock.method(axios, 'get', async (url) => {
    const start = url.split('/').pop();
    requested.push(start);
    return { data: nhlWeek(start) };
  });
});

afterEach(() => mock.restoreAll());

test('weeks start on Monday', () => {
  assert.equal(weekStart('2026-10-05'), '2026-10-05');
  assert.equal(weekStart('2026-10-11'), '2026-10-05');
  assert.equal(weekStart('2026-10-08'), '2026-10-05');
  assert.equal(weekStart('2027-01-03'), '2026-12-28');
});

test("a period's dates, including two week periods", () => {
  assert.deepEqual(periodDates(PERIOD_2), ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11']);
  const dates = periodDates(BREAK);
  assert.equal(dates.length, 14);
  assert.deepEqual([dates[0], dates[13]], ['2027-02-01', '2027-02-14']);
});

test('weeks are loaded once, past ones kept for good and others for 12 hours', async () => {
  const weeks = await loadScheduleWeeks(['2026-10-08', '2026-10-30', '2026-10-31'], { now: NOW });
  assert.deepEqual(weeks.map(week => week.startDate), ['2026-10-05', '2026-10-26']);
  assert.deepEqual(requested, ['2026-10-05', '2026-10-26']);
  assert.equal(weeks[0].days[0].games[0].away, 'SEA');

  requested = [];
  await loadScheduleWeeks(['2026-10-08', '2026-10-30'], { now: NOW + HOUR });
  assert.deepEqual(requested, []);

  // Two weeks later the first week is over: it's read once more for any last changes, then kept
  await loadScheduleWeeks(['2026-10-08', '2026-10-30'], { now: NOW + 14 * DAY });
  assert.deepEqual(requested, ['2026-10-05', '2026-10-26']);
  requested = [];
  await loadScheduleWeeks(['2026-10-08'], { now: NOW + 30 * DAY });
  assert.deepEqual(requested, []);
});

test("weeks that can't be loaded are left out", async () => {
  mock.method(axios, 'get', async () => { throw new Error('Network Error'); });

  assert.deepEqual(await loadScheduleWeeks(['2026-10-08'], { now: NOW }), []);
});

test('weeks are merged by start date, and a period is cut from them', async () => {
  const [first, third] = await loadScheduleWeeks(['2026-10-05', '2026-10-19'], { now: NOW });
  const [second] = await loadScheduleWeeks(['2026-10-12'], { now: NOW });

  const schedule = mergeScheduleWeeks([third, first], [second]);
  assert.deepEqual(schedule.map(week => week.startDate), ['2026-10-05', '2026-10-12', '2026-10-19']);
  assert.equal(mergeScheduleWeeks(schedule, [{ ...second, replaced: true }])[1].replaced, true);

  assert.equal(periodSchedule(schedule, PERIOD_2).days.length, 7);
  assert.equal(coversPeriod(schedule, PERIOD_2), true);
  assert.equal(coversPeriod([third], PERIOD_2), false);
  assert.equal(coversPeriod(schedule, BREAK), false);
});

test("games left count today's until 6am Eastern, to the end of the period", async () => {
  const schedule = await loadScheduleWeeks(['2026-10-05'], { now: NOW });

  // Thursday to Sunday
  assert.deepEqual(gamesLeftByTeam(schedule, { period: PERIOD_2, now: NOW }), { SEA: 4, VAN: 4 });
  // 2am Friday is still Thursday's scoring day
  assert.deepEqual(gamesLeftByTeam(schedule, { period: PERIOD_2, now: Date.parse('2026-10-09T06:00:00Z') }), { SEA: 4, VAN: 4 });
  // Without a league, the week
  assert.deepEqual(gamesLeftByTeam(schedule, { now: NOW }), { SEA: 4, VAN: 4 });
  // Teams without games aren't listed, and a schedule missing days gives nothing
  assert.equal(gamesLeftByTeam(schedule, { period: BREAK, now: BREAK.start }), null);
});

test("today's games, until 6am Eastern", async () => {
  const schedule = await loadScheduleWeeks(['2026-10-05'], { now: NOW });
  const start = Date.parse('2026-10-08T23:00:00Z');

  const games = todaysGamesByTeam(schedule, { now: NOW });
  assert.deepEqual(Object.keys(games), ['SEA', 'VAN']);
  assert.equal(games.SEA.todaysGameStart, start);
  assert.match(games.SEA.todaysGame, /^@VAN /);
  assert.match(games.VAN.todaysGame, /^SEA /);
  // 2am Friday is still Thursday's
  assert.equal(todaysGamesByTeam(schedule, { now: Date.parse('2026-10-09T06:00:00Z') }).SEA.todaysGameStart, start);
  assert.equal(todaysGamesByTeam(schedule, { now: BREAK.start }), null);
});
