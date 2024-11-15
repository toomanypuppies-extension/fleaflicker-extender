import axios from 'axios';
import { FLEA_API_BASE, SORT_OPTIONS } from '../hockey/constants';
import { mapToQueryArrayString } from './util';


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
    const response = await axios.get(buildUrl('FetchLeagueActivity'), {
      params: {
        sport: sport,
        league_id: leagueId,
        result_offset: offset
      }
    });
    return response.data;
  } catch (err) {
    console.error(err);
  }
}

export const getActivityToTimeEpochMilli = async (sport = 'NHL', leagueId, targetTimeEpochMilli) => {
  let activityList = [];
  let offset = 0;
  let moreActivitiesLeft = true;
  while (moreActivitiesLeft) {
    const response = await getRecentHockeyActivity(sport, leagueId, offset);
    activityList = activityList.concat(response.items);
    offset = response.resultOffsetNext;

    if (offset >= response.resultTotal) {
      moreActivitiesLeft = false;
    }
    if (!response.resultOffsetNext) {
      moreActivitiesLeft = false;
    }

    const lastActivity = activityList[activityList.length - 1];
    if (parseInt(lastActivity.timeEpochMilli, 10) < targetTimeEpochMilli) {
      moreActivitiesLeft = false;
    }
  }
  return activityList;
}

// Ex: https://www.fleaflicker.com/api/FetchPlayerListing?sport=NHL&league_id=12089&filter.player_id=3756&filter.player_id=3757
export const getSelectPlayers = async (sport, leagueId, playerIds, offset = 0) => {
  try {
    if (!leagueId) {
      console.error('No league id provided. Failing call');
      return;
    }
    const response = await axios.get(
      buildUrl(`FetchPlayerListing?sport=${sport}&league_id=${leagueId}&result_offset=${offset}&${mapToQueryArrayString(playerIds, 'filter.player_id')}`)
    );
    return response.data;
  } catch (err) {
    console.error(err)
  }
}

export const getAllSelectPlayers = async (sport = 'NHL', leagueId, playerIds) => {
  let playerList = [];
  let offset = 0;
  let morePlayersLeft = true;
  while (morePlayersLeft) {
    const response = await getSelectPlayers(sport, leagueId, playerIds, offset);
    playerList = playerList.concat(response.players);

    if (!response.resultOffsetNext) {
      morePlayersLeft = false;
    }

    offset = response.resultOffsetNext;

    if (offset >= response.resultTotal) {
      morePlayersLeft = false;
    }
  }
  return playerList;
}

// Ex https://www.fleaflicker.com/api/FetchPlayerListing?sport=NHL&league_id=12089
export const getPlayers = async (sport, leagueId, freeAgent = true, offset = 0) => {
  try {
    if (!leagueId) {
      console.error('No league id provided. Failing call');
      return;
    }
    const response = await axios.get(buildUrl('FetchPlayerListing'), {
      params: {
        sport: sport,
        league_id: leagueId,
        'filter.free_agent_only': freeAgent,
        sort: SORT_OPTIONS.total,
        result_offset: offset
      },
    });
    return response.data;
  } catch (err) {
    console.error(err);
  }
}

export const getAllHockeyPlayers = async (leagueId, stopIfNoPoints = true, forceRefresh = false, freeAgent = false) => {
  let playersList = [];
  let offset = 0;
  let morePlayersLeft = true;
  while (morePlayersLeft) {
    const response = await getPlayers('NHL', leagueId, freeAgent, offset);
    playersList = playersList.concat(response.players);
    offset = response.resultOffsetNext;

    if (offset >= response.resultTotal) {
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

  return playersList;
}

export const getLeagueStandings = async (leagueId) => {
  try {
    if (!leagueId) {
      console.error('No league id provided. Failing call');
      return;
    }
    const response = await axios.get(buildUrl('FetchLeagueStandings'), {
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

export const getLeagueOwners = async (leagueId) => {
  const standings = await getLeagueStandings(leagueId);

  const teams = standings?.divisions?.[0]?.teams;
  if (!teams) return [];

  return teams.map(team => team.name);
}