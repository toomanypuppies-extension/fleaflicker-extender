import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createFakeFlea, startClock, stopClock, advanceClock, settle, setLeague, resetStorage } from './support/fakeFlea.mjs';
import {
  loadLeagueInfo, loadTeamRosters, summarizeTeam, countAcquisitions, currentPeriod, acquisitionLimit,
} from '../src/hockey/collections/league.js';
import { ACTIVITY_KINDS } from '../src/hockey/collections/activity.js';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const LEAGUE = '100';

// Trimmed responses from a real league: rules, scoreboard, standings, and the roster of a team
// with 19 active players (one over the limit) and one player on IR
const FIXTURES = JSON.parse(readFileSync(new URL('./fixtures/league.json', import.meta.url)));
// 2026-10-11, in the league's second matchup period (Oct 5 - Oct 12, 6am Eastern)
const DURING_PERIOD_2 = Date.parse('2026-10-11T16:00:00Z');

let flea;

beforeEach(async () => {
  await resetStorage();
  setLeague(LEAGUE);
  startClock();
  flea = createFakeFlea();
  flea.standings = FIXTURES.standings;
  flea.rules = FIXTURES.rules;
  flea.scoreboard = FIXTURES.scoreboard;
});

afterEach(stopClock);

const info = (options) => settle(loadLeagueInfo(LEAGUE, { now: Date.now(), ...options }));

test('league info has the name, teams, roster rules and matchup periods', async () => {
  const league = await info();

  assert.equal(league.name, 'Messier - D3');
  assert.deepEqual(league.teams[0], {
    id: 63145,
    name: 'Chicken and Raffls',
    logoUrl: undefined,
    record: '1-0',
    rank: 1,
    waiverPosition: 14,
    owners: ['funkyquasar'],
  });
  assert.deepEqual(league.rules, { maxActive: 18, maxRosterSize: 20, irSlots: 2 });

  const { periods } = league.scoreboard;
  assert.equal(periods.length, 26);
  // A period ends when the next starts, so the two week all-star break period and daylight saving
  // changes need no special handling
  const breakPeriod = periods.find(period => period.ordinal === 19);
  assert.equal(breakPeriod.end - breakPeriod.start, 14 * DAY);
  const last = periods[periods.length - 1];
  assert.equal(last.end, last.lastDayStart + DAY);
});

test('the current period is the one containing now', async () => {
  const league = await info();

  const period = currentPeriod(league.scoreboard, DURING_PERIOD_2);

  assert.equal(period.ordinal, 2);
  assert.equal(period.start, Date.parse('2026-10-05T10:00:00Z'));
  assert.equal(period.end, Date.parse('2026-10-12T10:00:00Z'));
});

test('league info is reused for an hour, roster rules for a day', async () => {
  await info();
  flea.calls = [];

  await info();
  assert.deepEqual(flea.calls, []);

  advanceClock(HOUR);
  await info();
  assert.deepEqual(flea.calls.sort(), ['FetchLeagueScoreboard', 'FetchLeagueStandings']);
});

test('settings from the rules page give the acquisition limit', async () => {
  const league = await info();

  assert.equal(league.settings.waivers.hoursAfterDrop, 24);
  assert.equal(acquisitionLimit(league.settings), 7);
  assert.equal(acquisitionLimit({ transactionLimit: { period: 'season', limit: 50 } }), null);
  assert.equal(acquisitionLimit(undefined), null);
});

test('league info loads without settings, which are tried again after an hour', async () => {
  flea.fail = (endpoint) => (endpoint === 'LeagueSettings' ? 404 : undefined);

  const league = await info();
  assert.equal(league.name, 'Messier - D3');
  assert.equal(league.settings, undefined);

  flea.fail = null;
  flea.calls = [];
  await info();
  assert.deepEqual(flea.calls, []);

  advanceClock(HOUR);
  const later = await info();
  assert.equal(acquisitionLimit(later.settings), 7);
});

test('stored league info is returned when fleaflicker is unreachable', async () => {
  await info();
  advanceClock(2 * HOUR);
  flea.fail = () => 'network';

  const league = await info();

  assert.equal(league.name, 'Messier - D3');
  assert.equal(league.error, true);
});

test('nothing stored and fleaflicker unreachable', async () => {
  flea.fail = () => 'network';
  assert.equal(await info(), null);
});

const TEAM = 63133;
const OTHER_TEAM = 63145;

const rosters = (activityItems = []) => settle(loadTeamRosters(LEAGUE, [TEAM, OTHER_TEAM], activityItems, { now: Date.now() }));

test('rosters are fetched once, then only for teams with new activity', async () => {
  flea.rosters = { [TEAM]: FIXTURES.roster, [OTHER_TEAM]: { groups: [] } };

  const first = await rosters();
  assert.equal(flea.callsTo('FetchRoster'), 2);
  assert.equal(first[TEAM].groups.length, 3);
  flea.calls = [];

  advanceClock(MINUTE);
  await rosters();
  assert.deepEqual(flea.calls, []);

  const activity = [{ teamId: TEAM, time: Date.now() - 10 * 1000, kind: ACTIVITY_KINDS.add }];
  await rosters(activity);
  assert.deepEqual(flea.calls, ['FetchRoster']);
  flea.calls = [];

  // The same activity doesn't fetch it again
  await rosters(activity);
  assert.deepEqual(flea.calls, []);
});

test('rosters are fetched again on a new day, injuries change without activity', async () => {
  flea.rosters = { [TEAM]: FIXTURES.roster, [OTHER_TEAM]: { groups: [] } };
  await rosters();
  flea.calls = [];

  advanceClock(DAY);
  await rosters();

  assert.equal(flea.callsTo('FetchRoster'), 2);
});

test('a team summary has open roster and IR spots and IR eligible players', async () => {
  flea.rosters = { [TEAM]: FIXTURES.roster, [OTHER_TEAM]: { groups: [] } };
  const league = await info();
  const teamRosters = await rosters();

  const summary = summarizeTeam({
    team: { id: TEAM, name: 'Lock Monsters' },
    roster: teamRosters[TEAM],
    rules: league.rules,
    period: currentPeriod(league.scoreboard, DURING_PERIOD_2),
    activityItems: [],
    acquisitionLimit: 7,
  });

  assert.equal(summary.activeCount, 19);
  assert.equal(summary.openActiveSpots, -1);
  assert.equal(summary.irCount, 1);
  assert.equal(summary.openIrSpots, 1);
  assert.deepEqual(summary.irEligible.map(player => player.name), ['William Eklund']);
  assert.equal(summary.acquisitionsLeft, 7);
});

test('a team without a roster yet has unknown spots', () => {
  const summary = summarizeTeam({ team: { id: TEAM }, rules: { maxActive: 18, irSlots: 2 } });

  assert.equal(summary.openActiveSpots, null);
  assert.equal(summary.openIrSpots, null);
  assert.equal(summary.acquisitionsLeft, null);
  assert.equal(summary.hasRoster, false);
});

test('adds and claims in the matchup period count as acquisitions', () => {
  const period = { start: 1000, end: 2000 };
  const items = [
    { teamId: 1, kind: ACTIVITY_KINDS.add, time: 1000 },
    { teamId: 1, kind: ACTIVITY_KINDS.claim, time: 1500 },
    { teamId: 1, kind: ACTIVITY_KINDS.drop, time: 1500 },
    { teamId: 1, kind: ACTIVITY_KINDS.irOn, time: 1500 },
    { teamId: 2, kind: ACTIVITY_KINDS.add, time: 1500 },
    { teamId: 1, kind: ACTIVITY_KINDS.add, time: 999 },
    { teamId: 1, kind: ACTIVITY_KINDS.add, time: 2000 },
  ];

  assert.equal(countAcquisitions(items, 1, period), 2);
  assert.equal(countAcquisitions(items, 1, undefined), 0);
});
