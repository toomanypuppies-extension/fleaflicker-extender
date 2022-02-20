import axios from 'axios';
import { FLEA_API_BASE, SORT_OPTIONS } from '../contants';
import { setStore, getStore } from './storage';



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
    console.log(err);
  }
}

const convertEpochToTimeString = (epoch) => {
  return new Date(parseInt(epoch, 10)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const getTodaysGame = (requestedGames, teamAbbr) => {
  const currentGame = requestedGames[0].game;
  if (teamAbbr === currentGame.away.abbreviation) {
    return `@${currentGame.home.abbreviation} ${convertEpochToTimeString(currentGame.startTimeEpochMilli)}`
  } else {
    return `${currentGame.away.abbreviation} ${convertEpochToTimeString(currentGame.startTimeEpochMilli)}`
  }
}

const convertPlayerObjects = (players) => {
  return players.map((player) => {
    // This allows for filtering on combine positions of W, F
    const positionSplit = player.proPlayer.position.split('/');
    const combinedPositions = [...positionSplit, ...player.proPlayer.positionEligibility]
    const positions = Array.from(new Set(combinedPositions));

    const hasGameToday = player.requestedGames && player.requestedGames.length > 0;
    let todaysGame;
    if (hasGameToday) {
      todaysGame = getTodaysGame(player.requestedGames, player.proPlayer.proTeamAbbreviation);
    }


    const points = player.viewingActualPoints?.formatted && parseFloat(player.viewingActualPoints.formatted, 10) || 0.0;
    const avg = player.viewingActualPointsAverage?.formatted && parseFloat(player.viewingActualPointsAverage.formatted, 10) || 0.0;
    const last1 = player.lastX?.[0]?.value?.formatted && parseFloat(player.lastX[0].value.formatted, 10) || 0.0;
    const last5 = player.lastX?.[1]?.value?.formatted && parseFloat(player.lastX[1].value.formatted, 10) || 0.0;
    const last10 = player.lastX?.[2]?.value?.formatted && parseFloat(player.lastX[2].value.formatted, 10) || 0.0;

    const gamesThisWeek = player.numGamesInSchedulePeriod;

    const owner = player.owner?.name;

    return {
      id: player.proPlayer.id,
      name: player.proPlayer.nameFull,
      team: player.proPlayer.proTeamAbbreviation,
      owner,
      todaysGame,
      gamesThisWeek,
      position: player.proPlayer.position,
      positions,
      injury: player.proPlayer?.injury?.typeAbbreviaition,
      points,
      avg,
      last1,
      last5,
      last10,
      hasGameToday,
      expandedData: {
        image: player.proPlayer?.headshotUrl,
        proTeam: player.proPlayer.proTeam,
        rankFantasy: player.rankFantasy,
        news: player.proPlayer?.news?.[0],
      }
    }
  })
}

export const getAllPlayers = async (leagueId, stopIfNoPoints = true, forceRefresh = false, freeAgent = false) => {
  const storedPlayers = getStore('players');
  if (!forceRefresh && storedPlayers) {
    console.log('loaded players from store')
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

  console.log(playersList);

  const players = convertPlayerObjects(playersList);

  setStore('players', players);

  return players;
}

