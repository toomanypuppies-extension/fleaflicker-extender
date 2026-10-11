import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convertSchedule } from '../src/hockey/api/nhlv2.js';
import { weekGrid, easternDate, NHL_TEAMS } from '../src/hockey/collections/schedule.js';

const game = (away, home, startTimeUTC = '2026-10-12T23:00:00Z') => ({ awayTeam: { abbrev: away }, homeTeam: { abbrev: home }, startTimeUTC });

// One week in the NHL API's shape: Monday has 8 games (16 teams), Tuesday 2, the rest none
const API_WEEK = {
  gameWeek: [
    { date: '2026-10-12', dayAbbrev: 'MON', games: [
      game('VAN', 'SEA'), game('TOR', 'MTL'), game('BOS', 'NYR'), game('EDM', 'CGY'),
      game('COL', 'DAL'), game('TBL', 'FLA'), game('CHI', 'STL'), game('WPG', 'MIN'),
    ] },
    { date: '2026-10-13', dayAbbrev: 'TUE', games: [game('SEA', 'LAK', '2026-10-14T02:00:00Z'), game('NJD', 'PHI')] },
    ...['WED', 'THU', 'FRI', 'SAT', 'SUN'].map((dayAbbrev, i) => ({ date: `2026-10-1${4 + i}`, dayAbbrev, games: [] })),
  ],
};

test('the schedule is converted to fleaflicker team abbreviations', () => {
  const [week] = convertSchedule([API_WEEK]);

  assert.equal(week.startDate, '2026-10-12');
  assert.equal(week.days.length, 7);
  assert.deepEqual(week.days[1].games[0], { away: 'SEA', home: 'LA', start: Date.parse('2026-10-14T02:00:00Z') });
  assert.ok(week.days[0].games.some(g => g.away === 'TB' && g.home === 'FLA'));
});

test('games the app has no team for are left out', () => {
  const [week] = convertSchedule([{ gameWeek: [{ date: '2026-02-10', dayAbbrev: 'TUE', games: [game('CAN', 'USA')] }] }]);
  assert.deepEqual(week.days[0].games, []);
});

test('the week grid has each day and every team', () => {
  const [week] = convertSchedule([API_WEEK]);
  // Tuesday afternoon Eastern
  const grid = weekGrid(week, { now: Date.parse('2026-10-13T18:00:00Z') });

  assert.deepEqual(grid.days.slice(0, 2), [
    { date: '2026-10-12', dayAbbrev: 'MON', gameCount: 8, light: false, past: true },
    { date: '2026-10-13', dayAbbrev: 'TUE', gameCount: 2, light: true, past: false },
  ]);
  assert.equal(grid.days[2].light, false, 'no games is not a light night');
  assert.equal(grid.teams.length, NHL_TEAMS.length);

  const seattle = grid.teams.find(row => row.team === 'SEA');
  assert.deepEqual(seattle.cells[0], { opponent: 'VAN', home: true, start: Date.parse('2026-10-12T23:00:00Z') });
  assert.deepEqual(seattle.cells[1], { opponent: 'LA', home: false, start: Date.parse('2026-10-14T02:00:00Z') });
  assert.equal(seattle.cells[2], null);
  assert.equal(seattle.games, 2);
  assert.equal(seattle.lightGames, 1);
  assert.equal(seattle.gamesLeft, 1);

  const buffalo = grid.teams.find(row => row.team === 'BUF');
  assert.equal(buffalo.games, 0);
});

test('dates are Eastern', () => {
  // 11 PM Eastern on the 12th is the 13th in UTC
  assert.equal(easternDate(Date.parse('2026-10-13T03:00:00Z')), '2026-10-12');
});

test('a missing schedule gives an empty grid', () => {
  const grid = weekGrid(undefined);
  assert.deepEqual(grid.days, []);
  assert.equal(grid.teams[0].games, 0);
});
