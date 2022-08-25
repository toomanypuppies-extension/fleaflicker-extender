import axios from 'axios';
import { FLEA_API_BASE, SORT_OPTIONS } from '../contants';
import { setStore, getStore } from '../../utils/storage';
import { convertPlayerObjects } from '../collections/players';


const buildUrl = (segment) => {
  return `${FLEA_API_BASE}/${segment}`;
}

export const getPlayers = async (leagueId, freeAgent = true, offset = 0) => {
  try {
    if (!leagueId) {
      console.error('No league id provided. Failing call');
      return;
    }
    const response = await axios.get(buildUrl('FetchPlayerListing'), {
      params: {
        sport: 'NHL',
        league_id: leagueId,
        'filter.free_agent_only': freeAgent,
        sort: SORT_OPTIONS.total,
        result_offset: offset
      }
    });
    return response.data;
  } catch (err) {
    console.error(err);
  }
}

export const getAllPlayers = async (leagueId, stopIfNoPoints = true, forceRefresh = false, freeAgent = false) => {
  const storedPlayers = getStore('players');
  const playersStoreTime = getStore('playersFetchedAt');
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
    const response = await getPlayers(leagueId, freeAgent, offset);
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

  setStore('players', players);
  setStore('playersFetchedAt', new Date().getTime());

  return players;
}

