import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeFlea, startClock, stopClock, settle, setLeague, resetStorage, leaguePlayer } from './support/fakeFlea.mjs';
import { loadHockeyPlayers } from '../src/hockey/collections/players.js';
import { loadLastSeasonStats, withLastSeasonStats } from '../src/hockey/collections/lastSeason.js';

const LEAGUE = '100';

let flea;

beforeEach(async () => {
  await resetStorage();
  setLeague(LEAGUE);
  startClock();
  flea = createFakeFlea();
  flea.seasonPlayers[2025] = [
    leaguePlayer(1, { points: 500, avg: 6.25 }),
    leaguePlayer(2, { points: 80, avg: 2 }),
    leaguePlayer(300),
  ];
});

afterEach(stopClock);

const lastSeason = () => settle(loadLastSeasonStats(LEAGUE));

test('last season is fetched once, then read from storage', async () => {
  await settle(loadHockeyPlayers(LEAGUE));
  flea.calls = [];

  const stats = await lastSeason();
  assert.deepEqual(stats[1], { points: 500, avg: 6.25, gamesPlayed: 80, rank: undefined });
  assert.equal(stats[2].gamesPlayed, 40);
  assert.equal(flea.callsTo('FetchPlayerListing'), 1);

  flea.calls = [];
  assert.deepEqual(await lastSeason(), stats);
  assert.deepEqual(flea.calls, []);
});

test('nothing to load before the players have been fetched, or without an earlier season', async () => {
  assert.equal(await lastSeason(), null);

  flea.sortSeasons = { eligibleValues: [2026], selectedValue: 2026 };
  await settle(loadHockeyPlayers(LEAGUE));
  assert.equal(await lastSeason(), null);
});

test('last season can not be fetched', async () => {
  await settle(loadHockeyPlayers(LEAGUE));
  flea.fail = () => 'network';

  assert.equal(await lastSeason(), null);
});

test('last season stats are added to the players', () => {
  const players = withLastSeasonStats(
    [{ id: 1, name: 'A' }, { id: 2, name: 'B' }],
    { 1: { points: 500, avg: 6.25, gamesPlayed: 80, rank: 3 } },
  );

  assert.deepEqual(players[0], {
    id: 1, name: 'A', lastSeasonPoints: 500, lastSeasonAvg: 6.25, lastSeasonGamesPlayed: 80, lastSeasonRank: 3,
  });
  assert.equal(players[1].lastSeasonPoints, undefined);
});
