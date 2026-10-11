import { fleaClient } from './fleaClient';
import { FLEA_API_BASE, LEAGUE_SETTINGS_BASE, SORT_OPTIONS } from '../hockey/constants';


const buildUrl = (segment) => {
  return `${FLEA_API_BASE}/${segment}`;
}

// Ex https://www.fleaflicker.com/api/FetchLeagueActivity?sport=NHL&league_id=12089
export const getRecentHockeyActivity = async (sport = 'NHL', leagueId, offset = 0) => {
  try {
    if (!leagueId) {
      console.error('No league id provided. Failing call');
      return;
    }
    const response = await fleaClient.get(buildUrl('FetchLeagueActivity'), {
      params: {
        sport: sport,
        league_id: leagueId,
        result_offset: offset
      }
    });
    return response.data;
  } catch (err) {
    console.error(err);
    // Rethrown so callers can tell a missing league (404) from being throttled
    throw err;
  }
}

// Activity is returned newest first, 30 items per page.
// Returns null if more than maxPages would be needed to reach targetTimeEpochMilli.
export const getActivityToTimeEpochMilli = async (sport = 'NHL', leagueId, targetTimeEpochMilli, maxPages = Infinity) => {
  let activityList = [];
  let offset = 0;
  let pages = 0;
  let moreActivitiesLeft = true;
  while (moreActivitiesLeft) {
    if (pages >= maxPages) {
      return null;
    }
    const response = await getRecentHockeyActivity(sport, leagueId, offset);
    if (!response) {
      throw new Error('Failed to fetch league activity');
    }
    pages++;
    activityList = activityList.concat(response.items || []);
    offset = response.resultOffsetNext;

    if (offset >= response.resultTotal) {
      moreActivitiesLeft = false;
    }
    if (!response.resultOffsetNext) {
      moreActivitiesLeft = false;
    }

    const lastActivity = activityList[activityList.length - 1];
    if (!lastActivity || parseInt(lastActivity.timeEpochMilli, 10) < targetTimeEpochMilli) {
      moreActivitiesLeft = false;
    }
  }
  return activityList.filter(item => parseInt(item.timeEpochMilli, 10) > targetTimeEpochMilli);
}

// Ex https://www.fleaflicker.com/api/FetchPlayerListing?sport=NHL&league_id=12089
// season is the year a season starts in, e.g. 2025 for 2025-26. Omitted for the current season.
export const getPlayers = async (sport, leagueId, freeAgent = true, offset = 0, season) => {
  try {
    if (!leagueId) {
      console.error('No league id provided. Failing call');
      return;
    }
    const response = await fleaClient.get(buildUrl('FetchPlayerListing'), {
      params: {
        sport: sport,
        league_id: leagueId,
        'filter.free_agent_only': freeAgent,
        sort: SORT_OPTIONS.total,
        result_offset: offset,
        ...(season && { sort_season: season }),
      },
    });
    return response.data;
  } catch (err) {
    console.error(err);
    // Rethrown so callers can tell a missing league (404) from being throttled
    throw err;
  }
}

/**
 * Every page of the player listing, sorted by points.
 * @returns {Promise<{ players: Array, seasons?: { eligibleValues: number[], selectedValue: number } }>}
 *   seasons are the ones fleaflicker has stats for, and the one listed
 */
export const getAllHockeyPlayers = async (leagueId, { stopIfNoPoints = true, freeAgent = false, season } = {}) => {
  let playersList = [];
  let seasons;
  let offset = 0;
  let morePlayersLeft = true;
  while (morePlayersLeft) {
    const response = await getPlayers('NHL', leagueId, freeAgent, offset, season);
    if (!response) {
      throw new Error('Failed to fetch player listing');
    }
    seasons = seasons || response.sortSeasons;
    playersList = playersList.concat(response.players || []);
    offset = response.resultOffsetNext;

    // Without a next offset this would refetch the first page forever
    if (!offset || offset >= response.resultTotal) {
      morePlayersLeft = false;
    }

    const lastPlayerOfSegment = response.players[response.players.length - 1];
    const firstPlayerOfSegment = response.players[0];
    // We stop if the first player has points and the last player has none. Check first so that we still return players at year start.
    if (stopIfNoPoints && (firstPlayerOfSegment?.viewingActualPoints?.value > 0 && !lastPlayerOfSegment?.viewingActualPoints?.value || lastPlayerOfSegment?.viewingActualPoints?.value === 0)) {
      morePlayersLeft = false;
    }

    // exit early in dev
    if (process.env.NODE_ENV === 'development' && offset > 50) {
      console.log('local env, exiting getAllHockeyPlayers early')
      morePlayersLeft = false;
    }
  }

  return { players: playersList, seasons };
}

export const getLeagueStandings = async (leagueId) => {
  try {
    if (!leagueId) {
      console.error('No league id provided. Failing call');
      return;
    }
    const response = await fleaClient.get(buildUrl('FetchLeagueStandings'), {
      params: {
        sport: 'NHL',
        league_id: leagueId,
      },
    });
    return response.data;
  } catch (err) {
    console.error(err);
  }
}

const fetchLeagueEndpoint = async (endpoint, leagueId, params = {}) => {
  if (!leagueId) {
    console.error('No league id provided. Failing call');
    return;
  }
  const response = await fleaClient.get(buildUrl(endpoint), {
    params: { sport: 'NHL', league_id: leagueId, ...params },
  });
  return response.data;
}

// Roster rules: positions (including IR spots), maxActive and maxRosterSize
// Ex https://www.fleaflicker.com/api/FetchLeagueRules?sport=NHL&league_id=12089
export const getLeagueRules = (leagueId) => fetchLeagueEndpoint('FetchLeagueRules', leagueId);

// The current matchup period (schedulePeriod) and the season's others (eligibleSchedulePeriods)
// Ex https://www.fleaflicker.com/api/FetchLeagueScoreboard?sport=NHL&league_id=12089
export const getLeagueScoreboard = (leagueId, scoringPeriod) => fetchLeagueEndpoint(
  'FetchLeagueScoreboard', leagueId, scoringPeriod ? { scoring_period: scoringPeriod } : {}
);

// Both lineups in a matchup on one day (scoring period), with each player's points that day
// Ex https://www.fleaflicker.com/api/FetchLeagueBoxscore?sport=NHL&league_id=12089&fantasy_game_id=3603193&scoring_period=11
export const getLeagueBoxscore = (leagueId, gameId, scoringPeriod) => fetchLeagueEndpoint(
  'FetchLeagueBoxscore', leagueId, { fantasy_game_id: gameId, scoring_period: scoringPeriod }
);

// A team's current roster, grouped into starters, bench, IR and taxi
// Ex https://www.fleaflicker.com/api/FetchRoster?sport=NHL&league_id=12089&team_id=63133
// With a scoring period (day), the lineup set for that day, which can be a future one
export const getTeamRoster = (leagueId, teamId, scoringPeriod) => fetchLeagueEndpoint(
  'FetchRoster', leagueId, { team_id: teamId, ...(scoringPeriod && { scoring_period: scoringPeriod }) }
);

/**
 * Settings from the league's rules page, through the proxy: transactionLimit ({ period, limit } or null)
 * and waivers ({ hoursAfterDrop, gameStartWaivers, gameStartLockTime, firstComeFirstServedTime, ... }).
 * See the proxy's flea/rules.js.
 */
export const getLeagueSettings = async (leagueId) => {
  const response = await fleaClient.get(`${LEAGUE_SETTINGS_BASE}/nhl/${leagueId}`);
  return response.data;
}
