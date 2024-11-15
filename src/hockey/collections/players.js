import { getLocalStorage, setLocalStorage, clearLocalStorage } from "../../utils/storage";
import { convertEpochToTimeString } from "../../utils/util";
import { getAllHockeyPlayers } from "../../utils/flea";

const getTodaysGame = (requestedGames, teamAbbr) => {
  const currentGame = requestedGames[0].game;
  if (teamAbbr === currentGame.away.abbreviation) {
    return `@${currentGame.home.abbreviation} ${convertEpochToTimeString(currentGame.startTimeEpochMilli)}`
  } else {
    return `${currentGame.away.abbreviation} ${convertEpochToTimeString(currentGame.startTimeEpochMilli)}`
  }
}

export const convertPlayerObjects = (players) => {
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

    const gamesThisWeek = player.numGamesInSchedulePeriod || 0;

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

export const loadHockeyPlayers = async (leagueId, stopIfNoPoints = true, forceRefresh = false) => {
  // Fetch all players
  // If cache was populated <60min ago, then don't fetch

  if (forceRefresh) {
    clearLocalStorage('hockey_players');
    clearLocalStorage('hockey_playersFetchedAt');
  }

  const storedPlayers = getLocalStorage('hockey_players');
  const playersStoreTime = getLocalStorage('hockey_playersFetchedAt');

  let finalPlayers;

  let storedLessThan30mAgo = false;

  if (playersStoreTime) {
    const playersStoreTimeEpochMilli = parseInt(playersStoreTime, 10);
    const storedDateObject = new Date(playersStoreTimeEpochMilli);
    const msAgo = new Date() - storedDateObject;
    storedLessThan30mAgo = msAgo < 1800000;
  }

  if (storedLessThan30mAgo && !forceRefresh) {
    return storedPlayers;
  }

  const players = await getAllHockeyPlayers(leagueId, stopIfNoPoints, forceRefresh);
  finalPlayers = convertPlayerObjects(players);

  setLocalStorage('hockey_players', finalPlayers);
  setLocalStorage('hockey_playersFetchedAt', new Date().getTime());

  return finalPlayers;
}
