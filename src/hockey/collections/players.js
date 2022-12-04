import { getLocalStorage, setLocalStorage } from "../../utils/storage";
import { convertEpochToTimeString } from "../../utils/util";
import { differenceInDays } from 'date-fns'
import { getActivityToTimeEpochMilli, getAllSelectPlayers } from "../../utils/flea";

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
  // Check and see when players were last fully loaded
  // If players aren't loaded (or load is > 2 weeks old), then load them all
  // If loaded, then fetch recent activity
  // If oldest recent activity is older than the stored cache, then go ahead and do a small load of players
  // Map recent activity into a Set of ids
  // Remove those players from the players data
  // getSelectPlayers with that Set
  // Add those players to the player data
  // Save data
  // Else
  // Fetch all

  const storedPlayers = getLocalStorage('hockey_players');
  const playersStoreTime = getLocalStorage('hockey_playersFetchedAt');

  let finalPlayers;

  let storedLessThanFourteenDaysAgo = false;
  const playersStoreTimeEpochMilli = parseInt(playersStoreTime, 10);
  const storedDateObject = new Date(playersStoreTimeEpochMilli);
  if (playersStoreTime) {
    const daysAgo = differenceInDays(storedDateObject, new Date());
    storedLessThanFourteenDaysAgo = (daysAgo < 14);
  }

  if (storedLessThanFourteenDaysAgo && storedPlayers && !forceRefresh) {
    const recentActivity = await getActivityToTimeEpochMilli('NHL', leagueId, playersStoreTimeEpochMilli);
    const playersSet = new Set();
    recentActivity.forEach(item => {
      if (item.transaction && item.transaction.player) {
        playersSet.add(item.transaction.player.proPlayer.id);
      }
    });

    const filteredPlayers = storedPlayers.filter(player => !playersSet.has(player.id));
    const players = await getAllSelectPlayers('NHL', leagueId, playersSet);
    const groomedPlayers = convertPlayerObjects(players);
    finalPlayers = filteredPlayers.concat(groomedPlayers);
  } else {
    const players = await getAllHockeyPlayers(leagueId, stopIfNoPoints, forceRefresh);
    finalPlayers = convertPlayerObjects(players);
  }

  setLocalStorage('hockey_players', finalPlayers);
  setLocalStorage('hockey_playersFetchedAt', new Date().getTime());

  return finalPlayers;
}
