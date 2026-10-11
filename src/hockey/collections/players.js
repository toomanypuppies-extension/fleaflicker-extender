import { getLocalStorage, clearLocalStorage } from "../../utils/storage";
import { getStored, setStoredEntries } from "../../utils/db";
import { convertEpochToTimeString, easternDay } from "../../utils/util";
import { getAllHockeyPlayers } from "../../utils/flea";
import { syncActivity, ACTIVITY_KINDS } from "./activity";

const getTodaysGame = (requestedGames, teamAbbr) => {
  const currentGame = requestedGames[0].game;
  if (teamAbbr === currentGame.away.abbreviation) {
    return `@${currentGame.home.abbreviation} ${convertEpochToTimeString(currentGame.startTimeEpochMilli)}`
  } else {
    return `${currentGame.away.abbreviation} ${convertEpochToTimeString(currentGame.startTimeEpochMilli)}`
  }
}

const parseFormatted = (formatted) => formatted && parseFloat(formatted) || 0.0;

// The two stats fleaflicker lists for each player: goals and assists for skaters,
// goals against and save percentage for goalies
const statsByCategory = (player) => Object.fromEntries(
  (player.viewingActualStats || []).map(stat => [stat.category?.abbreviation, stat.value?.value])
);

// Fleaflicker flags recent results that are well above or below the player's usual
const trend = (lastX) => {
  if (lastX?.overPerforming) return 'hot';
  if (lastX?.underPerforming) return 'cold';
  return undefined;
};

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


    const points = parseFormatted(player.viewingActualPoints?.formatted);
    const avg = parseFormatted(player.viewingActualPointsAverage?.formatted);
    const last1 = parseFormatted(player.lastX?.[0]?.value?.formatted);
    const last5 = parseFormatted(player.lastX?.[1]?.value?.formatted);
    const last10 = parseFormatted(player.lastX?.[2]?.value?.formatted);
    const stats = statsByCategory(player);
    const positionRank = player.rankFantasy?.positions?.[0];

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
      // Fleaflicker doesn't list games played, the average is points per game
      gamesPlayed: avg ? Math.round(points / avg) : 0,
      goals: stats.G,
      assists: stats.Ast,
      goalsAgainst: stats.GA,
      // Listed as a percentage, shown like .932
      savePct: stats['%'] === undefined ? undefined : stats['%'] / 100,
      percentOwned: player.proPlayer.percentOwnedRatio === undefined
        ? undefined
        : Math.round(player.proPlayer.percentOwnedRatio * 100),
      rank: player.rankFantasy?.ordinal,
      positionRank: positionRank?.ordinal,
      positionRankLabel: positionRank?.position?.label,
      // Game to game spread of the player's points this season
      consistency: player.seasonsStandartDeviation?.value,
      trend1: trend(player.lastX?.[0]),
      trend5: trend(player.lastX?.[1]),
      trend10: trend(player.lastX?.[2]),
      hasGameToday,
      expandedData: {
        image: player.proPlayer?.headshotUrl,
        news: player.proPlayer?.news?.[0],
      }
    }
  })
}

// Bump when convertPlayerObjects changes, so players stored by an older version are refetched
const PLAYERS_FORMAT = 2;

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
  const { players, seasons } = await getAllHockeyPlayers(leagueId, { stopIfNoPoints });
  const finalPlayers = convertPlayerObjects(players);

  // If the players can't be stored (storage full), still show them. Players and their metadata
  // are stored together, so older stored players stay paired with their own metadata.
  await setStoredEntries({
    hockey_players: finalPlayers,
    hockey_playersMeta: {
      format: PLAYERS_FORMAT,
      stopIfNoPoints,
      season: seasons?.selectedValue,
      // The latest season before this one that fleaflicker has stats for
      previousSeason: previousSeason(seasons),
      statsEpoch: fetchStart,
      activityEpoch: fetchStart - ACTIVITY_OVERLAP,
      activityCheckedEpoch: fetchStart,
    },
  }, leagueId);

  return { players: finalPlayers, savedAt: fetchStart };
}

const previousSeason = (seasons) => {
  const earlier = (seasons?.eligibleValues || []).filter(season => season < seasons.selectedValue);
  return earlier.length ? Math.max(...earlier) : undefined;
};

// Applies league activity since the last check to the stored players.
// Returns false if the changes can't be applied incrementally and a full fetch is needed.
const applyOwnershipChanges = async (leagueId, players, meta, now) => {
  const log = await syncActivity(leagueId, { since: meta.activityEpoch, maxPages: MAX_ACTIVITY_PAGES, now });
  if (!log) {
    return false;
  }

  // Oldest first
  const items = log.items.filter(item => item.time > meta.activityEpoch).reverse();

  if (items.some(item => item.unknownOwnership)) {
    return false;
  }

  if (items.some(item => item.kind === ACTIVITY_KINDS.membership)) {
    clearLocalStorage('hockey_owners');
  }

  // Each item has its player's owner from when the item was fetched. Applied oldest first, every
  // player ends up with the owner from their newest item, which was fetched after their last move.
  const playersById = new Map(players.map(player => [player.id, player]));
  items.forEach(item => {
    const player = playersById.get(item.playerId);
    if (player) {
      player.owner = item.owner;
    }
  });

  const newestActivityEpoch = Math.max(meta.activityEpoch, ...items.map(item => item.time));
  await setStoredEntries({
    hockey_players: players,
    hockey_playersMeta: {
      ...meta,
      activityEpoch: newestActivityEpoch,
      activityCheckedEpoch: now,
    },
  }, leagueId);

  return true;
}

// Why the latest players couldn't be loaded, shown to the user
export const LOAD_ERRORS = {
  noLeague: 'noLeague',
  leagueNotFound: 'leagueNotFound',
  unavailable: 'unavailable',
};

// Loads run one at a time. Otherwise a slower, older load can overwrite the stored players
// with older data, and a load started during a full fetch would start a second full fetch
// instead of using what the first one stores.
let previousLoad = Promise.resolve();

/**
 * @returns {Promise<{ players: Array, savedAt?: number, error?: string }>}
 *   savedAt is when the players' stats were fetched, error is one of LOAD_ERRORS
 */
export const loadHockeyPlayers = (leagueId, stopIfNoPoints = true, forceRefresh = false) => {
  const load = previousLoad.then(() => loadHockeyPlayersNow(leagueId, stopIfNoPoints, forceRefresh));
  previousLoad = load.catch(() => {});
  return load;
}

const loadHockeyPlayersNow = async (leagueId, stopIfNoPoints, forceRefresh) => {
  // Keep a snapshot of all players and only update what could have changed:
  // - stats, only when NHL games have been played since the last fetch (full fetch)
  // - ownership, from the league activity feed (usually a single call)
  if (!leagueId) {
    return { players: [], error: LOAD_ERRORS.noLeague };
  }

  const storedPlayers = await getStored('hockey_players', leagueId);
  const meta = await getStored('hockey_playersMeta', leagueId);
  const now = new Date().getTime();
  const stored = { players: storedPlayers, savedAt: meta?.statsEpoch };

  try {
    if (
      !storedPlayers ||
      !meta ||
      meta.format !== PLAYERS_FORMAT ||
      meta.stopIfNoPoints !== stopIfNoPoints ||
      statsNeedRefresh(meta.statsEpoch, now, forceRefresh)
    ) {
      return await fetchAllPlayers(leagueId, stopIfNoPoints);
    }

    if (!forceRefresh && now - meta.activityCheckedEpoch < ACTIVITY_CHECK_INTERVAL) {
      return stored;
    }

    const applied = await applyOwnershipChanges(leagueId, storedPlayers, meta, now);
    if (!applied) {
      return await fetchAllPlayers(leagueId, stopIfNoPoints);
    }
    return stored;
  } catch (err) {
    // Most likely throttled, stale players are better than none
    console.error(err);
    const error = err.response?.status === 404 ? LOAD_ERRORS.leagueNotFound : LOAD_ERRORS.unavailable;
    // Stored players from the same settings are still worth showing
    if (storedPlayers && meta?.stopIfNoPoints === stopIfNoPoints) {
      return { ...stored, error };
    }
    return { players: [], error };
  }
}
