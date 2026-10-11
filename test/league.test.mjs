import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createFakeFlea, startClock, stopClock, advanceClock, settle, setLeague, resetStorage } from './support/fakeFlea.mjs';
import {
  loadLeagueInfo, loadTeamRosters, loadPeriodMatchups, loadDayRosters, summarizeTeam, countAcquisitions, currentPeriod, acquisitionLimit, currentMatchup, groupByMatchup,
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
  assert.deepEqual(league.rules, {
    maxActive: 18,
    maxRosterSize: 20,
    irSlots: 2,
    startSlots: [
      { label: 'C', eligibility: ['C'], count: 2 },
      { label: 'LW', eligibility: ['LW'], count: 2 },
      { label: 'RW', eligibility: ['RW'], count: 2 },
      { label: 'F', eligibility: ['C', 'LW', 'RW'], count: 1 },
      { label: 'D', eligibility: ['D'], count: 4 },
      { label: 'F/D', eligibility: ['C', 'LW', 'RW', 'D'], count: 1 },
      { label: 'G', eligibility: ['G'], count: 2 },
    ],
  });

  const { periods } = league.scoreboard;
  assert.equal(periods.length, 26);
  // A period ends when the next starts, so the two week all-star break period and daylight saving
  // changes need no special handling
  const breakPeriod = periods.find(period => period.ordinal === 19);
  assert.equal(breakPeriod.end - breakPeriod.start, 14 * DAY);
  const last = periods[periods.length - 1];
  assert.equal(last.end, last.lastDayStart + DAY);
  // Box scores are fetched by day
  assert.deepEqual([periods[1].firstDay, periods[1].lastDay], [7, 13]);
  assert.ok(league.scoreboard.matchups.every(matchup => matchup.gameId));
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

test('the current matchup from either team', async () => {
  const league = await info();

  assert.deepEqual(currentMatchup(league.scoreboard, 63145), { opponentId: 63134, score: '217', opponentScore: '117', inProgress: true });
  assert.deepEqual(currentMatchup(league.scoreboard, 63134), { opponentId: 63145, score: '117', opponentScore: '217', inProgress: true });
  assert.equal(currentMatchup(league.scoreboard, 1), null);
});

test("teams are grouped by matchup, the user's matchup first with their team first", () => {
  const scoreboard = {
    matchups: [
      { awayId: 1, homeId: 2, awayScore: '10', homeScore: '20' },
      { awayId: 3, homeId: 4, awayScore: '30', homeScore: '40' },
    ],
  };
  const summaries = [1, 2, 3, 4, 5].map(teamId => ({ teamId }));
  const ids = (groups) => groups.map(group => group.teams.map(team => team.teamId));

  assert.deepEqual(ids(groupByMatchup(summaries, scoreboard)), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(ids(groupByMatchup(summaries, scoreboard, 4)), [[4, 3], [1, 2], [5]]);
  assert.equal(groupByMatchup(summaries, scoreboard, 4)[0].matchup.homeScore, '40');
  assert.equal(groupByMatchup(summaries, scoreboard)[2].matchup, null);
  assert.deepEqual(ids(groupByMatchup(summaries, undefined)), [[1, 2, 3, 4, 5]]);
});

test("other weeks' matchups: final ones are kept, others are refetched hourly", async () => {
  const league = await info();
  const game = (id, away, home, final) => ({ id, away: { id: away }, home: { id: home }, isFinalScore: final, awayScore: { score: { formatted: '10' } } });
  flea.scoreboardsByDay[1] = { games: [game('p1', 1, 2, true)] };
  flea.scoreboardsByDay[14] = { games: [game('p3', 1, 3, false)] };
  flea.calls = [];

  // The current week is the scoreboard's
  assert.equal(await settle(loadPeriodMatchups(LEAGUE, league.scoreboard, 2)), league.scoreboard.matchups);
  assert.deepEqual(flea.calls, []);

  const past = await settle(loadPeriodMatchups(LEAGUE, league.scoreboard, 1, { now: Date.now() }));
  assert.deepEqual(past.map(m => [m.gameId, m.awayId, m.homeId, m.awayScore, m.final]), [['p1', 1, 2, '10', true]]);
  const future = await settle(loadPeriodMatchups(LEAGUE, league.scoreboard, 3, { now: Date.now() }));
  assert.equal(future[0].gameId, 'p3');
  assert.equal(flea.callsTo('FetchLeagueScoreboard'), 2);

  flea.calls = [];
  await settle(loadPeriodMatchups(LEAGUE, league.scoreboard, 1, { now: Date.now() + 2 * HOUR }));
  await settle(loadPeriodMatchups(LEAGUE, league.scoreboard, 3, { now: Date.now() + 2 * HOUR }));
  assert.equal(flea.callsTo('FetchLeagueScoreboard'), 1);
});

test("the lineups teams set for each day are kept for a few minutes", async () => {
  flea.dayRosters['1:9'] = FIXTURES.roster;
  flea.dayRosters['1:10'] = FIXTURES.roster;
  const now = Date.now();

  const lineups = await settle(loadDayRosters(LEAGUE, [1], [9, 10, 11], { now }));
  assert.deepEqual(Object.keys(lineups[1]), ['9', '10']);
  assert.ok(lineups[1][9].some(group => group.group === 'START'));
  assert.equal(flea.callsTo('FetchRoster'), 3);

  flea.calls = [];
  await settle(loadDayRosters(LEAGUE, [1], [9, 10, 11], { now: now + 5 * MINUTE }));
  // Only the day that couldn't be loaded is tried again
  assert.equal(flea.callsTo('FetchRoster'), 1);

  // Without fetching, only lineups that are still fresh
  flea.calls = [];
  const stored = await settle(loadDayRosters(LEAGUE, [1, 2], [9, 10, 11], { now: now + 5 * MINUTE, fetch: false }));
  assert.deepEqual(Object.keys(stored[1]), ['9', '10']);
  assert.deepEqual(stored[2], {});
  assert.deepEqual(flea.calls, []);
  const expired = await settle(loadDayRosters(LEAGUE, [1], [9, 10], { now: now + 20 * MINUTE, fetch: false }));
  assert.deepEqual(expired[1], {});

  flea.calls = [];
  await settle(loadDayRosters(LEAGUE, [1], [10, 11], { now: now + 20 * MINUTE }));
  assert.equal(flea.callsTo('FetchRoster'), 2);
});
