import { getLocalStorage, setLocalStorage, clearLocalStorage } from "../../utils/storage";
import { convertEpochToTimeString } from "../../utils/util";
import { getAllHockeyPlayers, getActivityToTimeEpochMilli } from "../../utils/flea";

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

const MINUTE = 60 * 1000;
// Minimum time between stat refreshes while games are being played
const LIVE_STATS_INTERVAL = 30 * MINUTE;
const LIVE_STATS_INTERVAL_FORCED = 5 * MINUTE;
// Fallback when there is no schedule to check against (old behaviour)
const STATS_MAX_AGE_WITHOUT_SCHEDULE = 30 * MINUTE;
// Upper bound on how long a game (plus scoring updates) can take
const GAME_WINDOW = 4 * 60 * MINUTE;
// Minimum time between league activity checks on page load
const ACTIVITY_CHECK_INTERVAL = 5 * MINUTE;
// Past this many activity pages a full fetch is about as cheap
const MAX_ACTIVITY_PAGES = 5;
// After a full fetch, re-read activity from this far back. Covers the proxy serving player listings
// up to 5 min old (see TTL_BY_ENDPOINT in the proxy) and drift between our clock and flea's.
// Re-applying activity is harmless, it just sets players to their current owner again.
const ACTIVITY_OVERLAP = 6 * MINUTE;

const easternDay = (epochMilli) => new Date(epochMilli).toLocaleDateString('en-US', { timeZone: 'America/New_York' });

// Stats only change while NHL games are being played. Flea's requestedGames (todaysGame)
// and numGamesInSchedulePeriod also roll over daily, so always refresh once per day.
const statsNeedRefresh = (statsEpoch, now, forceRefresh) => {
  if (easternDay(statsEpoch) !== easternDay(now)) {
    return true;
  }

  const gameStartTimes = getLocalStorage('gamesThisWeek')?.gameStartTimes;
  if (!gameStartTimes) {
    return now - statsEpoch > STATS_MAX_AGE_WITHOUT_SCHEDULE;
  }

  const minInterval = forceRefresh ? LIVE_STATS_INTERVAL_FORCED : LIVE_STATS_INTERVAL;
  if (now - statsEpoch < minInterval) {
    return false;
  }

  // Was any game in progress between the last stats fetch and now?
  return gameStartTimes.some(start => start < now && start + GAME_WINDOW > statsEpoch);
}

const fetchAllPlayers = async (leagueId, stopIfNoPoints) => {
  const fetchStart = new Date().getTime();
  const players = await getAllHockeyPlayers(leagueId, stopIfNoPoints);
  const finalPlayers = convertPlayerObjects(players);

  setLocalStorage('hockey_players', finalPlayers);
  setLocalStorage('hockey_playersMeta', {
    stopIfNoPoints,
    statsEpoch: fetchStart,
    activityEpoch: fetchStart - ACTIVITY_OVERLAP,
    activityCheckedEpoch: fetchStart,
  });

  return finalPlayers;
}

// Applies league activity since the last check to the stored players.
// Returns false if the changes can't be applied incrementally and a full fetch is needed.
const applyOwnershipChanges = async (leagueId, players, meta, now) => {
  const items = await getActivityToTimeEpochMilli('NHL', leagueId, meta.activityEpoch, MAX_ACTIVITY_PAGES);
  if (!items) {
    return false;
  }

  // Trade and commissioner items don't list the players that moved
  if (items.some(item => item.trade || item.commishPowers)) {
    return false;
  }

  if (items.some(item => item.membership)) {
    clearLocalStorage('hockey_owners');
  }

  const playersById = new Map(players.map(player => [player.id, player]));
  items.forEach(item => {
    // transaction.player.owner is the player's current owner, not the owner at the time
    // of the transaction, so the order the items are applied in doesn't matter
    const leaguePlayer = item.transaction?.player;
    const player = playersById.get(leaguePlayer?.proPlayer?.id);
    if (player) {
      player.owner = leaguePlayer.owner?.name;
    }
  });

  const newestActivityEpoch = Math.max(meta.activityEpoch, ...items.map(item => parseInt(item.timeEpochMilli, 10)));
  setLocalStorage('hockey_players', players);
  setLocalStorage('hockey_playersMeta', {
    ...meta,
    activityEpoch: newestActivityEpoch,
    activityCheckedEpoch: now,
  });

  return true;
}

export const loadHockeyPlayers = async (leagueId, stopIfNoPoints = true, forceRefresh = false) => {
  // Keep a snapshot of all players and only update what could have changed:
  // - stats, only when NHL games have been played since the last fetch (full fetch)
  // - ownership, from the league activity feed (usually a single call)
  const storedPlayers = getLocalStorage('hockey_players');
  const meta = getLocalStorage('hockey_playersMeta');
  const now = new Date().getTime();

  try {
    if (
      !storedPlayers ||
      !meta ||
      meta.stopIfNoPoints !== stopIfNoPoints ||
      statsNeedRefresh(meta.statsEpoch, now, forceRefresh)
    ) {
      return await fetchAllPlayers(leagueId, stopIfNoPoints);
    }

    if (!forceRefresh && now - meta.activityCheckedEpoch < ACTIVITY_CHECK_INTERVAL) {
      return storedPlayers;
    }

    const applied = await applyOwnershipChanges(leagueId, storedPlayers, meta, now);
    if (!applied) {
      return await fetchAllPlayers(leagueId, stopIfNoPoints);
    }
    return storedPlayers;
  } catch (err) {
    // Most likely throttled, stale players are better than none
    console.error(err);
    return storedPlayers || [];
  }
}
