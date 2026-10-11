import { mock } from 'node:test';
import { fleaClient } from '../../src/utils/fleaClient.js';
import { clearAllStored, resetDbConnection } from '../../src/utils/db.js';

const PAGE_SIZE = 30;

// What axios 0.x rejects with
const axiosError = (message, config, response) => Object.assign(new Error(message), { config, response, isAxiosError: true });

export const leaguePlayer = (id, { points = 0, avg, owner, team = 'SEA' } = {}) => ({
  proPlayer: {
    id,
    nameFull: `Player ${id}`,
    proTeamAbbreviation: team,
    position: 'C',
    positionEligibility: ['C', 'F'],
  },
  viewingActualPoints: { value: points, formatted: String(points) },
  ...(avg !== undefined && { viewingActualPointsAverage: { value: avg, formatted: String(avg) } }),
  owner: owner ? { name: owner } : undefined,
});

/**
 * A fleaflicker league served through fleaClient's axios adapter.
 * By default 75 players with points (descending) followed by 45 with none.
 */
export const createFakeFlea = ({ withPoints = 75, withoutPoints = 45 } = {}) => {
  const fake = {
    players: [
      ...Array.from({ length: withPoints }, (_, i) => leaguePlayer(i + 1, { points: withPoints - i })),
      ...Array.from({ length: withoutPoints }, (_, i) => leaguePlayer(withPoints + i + 1)),
    ],
    // Players listed for an earlier season (sort_season), by season
    seasonPlayers: {},
    sortSeasons: { eligibleValues: [2025, 2026], selectedValue: 2026 },
    // Newest first, like fleaflicker
    activity: [],
    teams: ['Team A', 'Team B'],
    // Responses for league endpoints, set by tests that need them
    standings: null,
    rules: null,
    scoreboard: null,
    // Scoreboards for other matchup periods, by a day (scoring period) in them
    scoreboardsByDay: {},
    // FetchLeagueBoxscore responses by `${gameId}:${day}`
    boxscores: {},
    // team id to FetchRoster response
    rosters: {},
    // The proxy's rules page settings, null when the route isn't available
    settings: {
      transactionLimit: { period: 'week', limit: 7 },
      waivers: {
        gameStartWaivers: true,
        hoursAfterDrop: 24,
        gameStartLockTime: { hour: 5, minute: 0 },
        firstComeFirstServedTime: { hour: 8, minute: 0 },
      },
    },
    calls: [],
    // (endpoint, params) => undefined | status code | 'network'
    fail: null,
  };

  fake.callsTo = (endpoint) => fake.calls.filter(call => call === endpoint).length;

  // A transaction that left `player` owned by `owner` (undefined for a drop).
  // Like fleaflicker, every activity item shows the player's current owner, not the owner at the time.
  fake.addTransaction = (timeEpochMilli, playerId, owner) => {
    const player = fake.players.find(p => p.proPlayer.id === playerId);
    player.owner = owner ? { name: owner } : undefined;
    fake.activity.unshift({
      timeEpochMilli: String(timeEpochMilli),
      transaction: { type: owner ? undefined : 'TRANSACTION_DROP', player },
    });
  };

  const respond = (endpoint, params) => {
    const offset = params?.result_offset || 0;
    switch (endpoint) {
      case 'FetchPlayerListing': {
        const players = params?.sort_season ? fake.seasonPlayers[params.sort_season] || [] : fake.players;
        // fleaflicker's last page still has a resultOffsetNext, past resultTotal
        return {
          players: players.slice(offset, offset + PAGE_SIZE),
          resultOffsetNext: offset + PAGE_SIZE,
          resultTotal: players.length,
          sortSeasons: { ...fake.sortSeasons, selectedValue: params?.sort_season || fake.sortSeasons.selectedValue },
        };
      }
      case 'FetchLeagueActivity':
        return {
          items: fake.activity.slice(offset, offset + PAGE_SIZE),
          resultOffsetNext: offset + PAGE_SIZE < fake.activity.length ? offset + PAGE_SIZE : undefined,
          resultTotal: fake.activity.length,
        };
      case 'FetchLeagueStandings':
        return fake.standings || { divisions: [{ teams: fake.teams.map(name => ({ name })) }] };
      case 'FetchLeagueRules':
        return fake.rules;
      case 'FetchLeagueScoreboard':
        return params?.scoring_period ? fake.scoreboardsByDay[params.scoring_period] || null : fake.scoreboard;
      case 'FetchLeagueBoxscore':
        return fake.boxscores[`${params?.fantasy_game_id}:${params?.scoring_period}`] || null;
      case 'FetchRoster':
        return fake.rosters[params?.team_id] || null;
      case 'LeagueSettings':
        return fake.settings;
      default:
        return null;
    }
  };

  fleaClient.defaults.adapter = async (config) => {
    const path = new URL(config.url).pathname;
    // The proxy's settings route is /proxy/flea-rules/nhl/<league id>
    const endpoint = path.includes('/flea-rules/') ? 'LeagueSettings' : path.split('/').pop();
    fake.calls.push(endpoint);

    const failure = fake.fail?.(endpoint, config.params);
    if (failure === 'network') {
      throw axiosError('Network Error', config);
    }
    const status = failure || (respond(endpoint, config.params) ? 200 : 404);
    const response = {
      data: status === 200 ? respond(endpoint, config.params) : { message: 'error' },
      status,
      statusText: String(status),
      headers: {},
      config,
      request: {},
    };
    if (status !== 200) {
      throw axiosError(`Request failed with status code ${status}`, config, response);
    }
    return response;
  };

  return fake;
};

// fleaClient keeps rate limiting state between tests, so every test starts later than the last
let nextClockStart = Date.parse('2026-01-05T17:00:00Z');

/**
 * Mocks Date and setTimeout, starting at noon Eastern on a day after any previous test's clock.
 * Returns the start time.
 */
export const startClock = () => {
  const start = nextClockStart;
  nextClockStart += 7 * 24 * 60 * 60 * 1000;
  mock.timers.enable({ apis: ['setTimeout', 'Date'], now: start });
  return start;
};

export const stopClock = () => mock.timers.reset();

export const advanceClock = (ms) => mock.timers.tick(ms);

// Waits for a promise while moving the mocked clock forward, so rate limiting and backoff sleeps finish
export const settle = async (promise) => {
  let done = false;
  promise.then(() => { done = true; }, () => { done = true; });
  for (let i = 0; !done && i < 100000; i++) {
    await new Promise(resolve => setImmediate(resolve));
    if (!done) mock.timers.tick(100);
  }
  return promise;
};

export const storage = globalThis.localStorage;

export const setLeague = (leagueId) => {
  globalThis.location.href = `https://www.fleaflicker.com/nhl/leagues/${leagueId}`;
};

// Clears localStorage and IndexedDB
export const resetStorage = async () => {
  globalThis.localStorage.reset();
  await clearAllStored();
};

// Runs fn as if IndexedDB couldn't be opened, so storage falls back to localStorage
export const withoutIndexedDb = async (fn) => {
  const indexedDB = globalThis.indexedDB;
  delete globalThis.indexedDB;
  resetDbConnection();
  try {
    return await fn();
  } finally {
    globalThis.indexedDB = indexedDB;
    resetDbConnection();
  }
};
