import axios from 'axios';
import { FLEA_API_BASE, SORT_OPTIONS } from '../hockey/constants';
import { setLocalStorage, getLocalStorage } from './storage';
import { convertPlayerObjects } from '../hockey/collections/players';


const buildUrl = (segment) => {
  return `${FLEA_API_BASE}/${segment}`;
}

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
  const storedPlayers = getLocalStorage('hockey_players');
  const playersStoreTime = getLocalStorage('hockey_playersFetchedAt');
  let storedLessThanHourAgo = false;
  if (playersStoreTime) {
    storedLessThanHourAgo = (new Date().getTime() - parseInt(playersStoreTime, 10)) < (60 * 60 * 1000);
  }
  if (!forceRefresh && storedPlayers && storedLessThanHourAgo) {
    return storedPlayers;
  }

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

    const lastPlayer = playersList[playersList.length - 1];
    if (stopIfNoPoints && !lastPlayer?.viewingActualPoints?.value || lastPlayer?.viewingActualPoints?.value === 0) {
      morePlayersLeft = false;
    }
  }

  console.log('no more players', morePlayersLeft)

  const players = convertPlayerObjects(playersList);

  setLocalStorage('hockey_players', players);
  setLocalStorage('hockey_playersFetchedAt', new Date().getTime());

  return players;
}

export const getAllFootballPlayers = async (leagueId, stopIfNoPoints = true, forceRefresh = false, freeAgent = false) => {
  const storedPlayers = getLocalStorage('football_players');
  const playersStoreTime = getLocalStorage('football_playersFetchedAt');
  let storedLessThanHourAgo = false;
  if (playersStoreTime) {
    storedLessThanHourAgo = (new Date().getTime() - parseInt(playersStoreTime, 10)) < (60 * 60 * 1000);
  }
  if (!forceRefresh && storedPlayers && storedLessThanHourAgo) {
    return storedPlayers;
  }

  let playersList = [];
  let offset = 0;
  let morePlayersLeft = true;
  // TODO remove offset < 45
  while (morePlayersLeft && offset < 45) {
    const response = await getPlayers('NFL', leagueId, freeAgent, offset);
    playersList = playersList.concat(response.players);
    offset = response.resultOffsetNext;

    if (offset >= response.resultTotal) {
      morePlayersLeft = false;
    }

    const lastPlayer = playersList[playersList.length - 1];
    if (stopIfNoPoints && !lastPlayer?.viewingActualPoints?.value || lastPlayer?.viewingActualPoints?.value === 0) {
      morePlayersLeft = false;
    }
  }

  const players = convertPlayerObjects(playersList);

  setLocalStorage('football_players', players);
  setLocalStorage('football_playersFetchedAt', new Date().getTime());

  return players;
}

