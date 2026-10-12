import { getStored, setStored } from "../../utils/db";
import { getAllHockeyPlayers } from "../../utils/flea";
import { convertPlayerObjects } from "./players";

// The stats kept from last season, and the player fields they're shown as
const LAST_SEASON_FIELDS = {
  points: 'lastSeasonPoints',
  avg: 'lastSeasonAvg',
  gamesPlayed: 'lastSeasonGamesPlayed',
  rank: 'lastSeasonRank',
};

/**
 * Last season's stats by player id, e.g. { 3756: { points: 586.8, avg: 7.16, gamesPlayed: 82, rank: 1 } }.
 * Fetched the first time they're asked for and stored for good, a finished season doesn't change.
 * Returns null if there's no earlier season or it can't be fetched.
 */
export const loadLastSeasonStats = async (leagueId) => {
  const season = (await getStored('hockey_playersMeta', leagueId))?.previousSeason;
  if (!season) {
    return null;
  }

  const key = `hockey_seasonStats_${season}`;
  const stored = await getStored(key, leagueId);
  if (stored) {
    return stored.players;
  }

  try {
    // Players without points last season have nothing to compare
    const { players } = await getAllHockeyPlayers(leagueId, { stopIfNoPoints: true, season });
    const byId = Object.fromEntries(convertPlayerObjects(players).map(player => [
      player.id,
      Object.fromEntries(Object.keys(LAST_SEASON_FIELDS).map(stat => [stat, player[stat]])),
    ]));
    await setStored(key, { season, players: byId }, leagueId);
    return byId;
  } catch (err) {
    console.error(err);
    return null;
  }
};

// A player's last season stats as player fields: { lastSeasonPoints, lastSeasonAvg, ... }
export const lastSeasonFields = (lastSeasonById, playerId) => {
  const lastSeason = lastSeasonById?.[playerId];
  return Object.fromEntries(Object.entries(LAST_SEASON_FIELDS).map(([stat, field]) => [field, lastSeason?.[stat]]));
};

// Copies of the players with last season's stats added, see lastSeasonFields
export const withLastSeasonStats = (players, lastSeasonById) => players.map(player => ({
  ...player,
  ...lastSeasonFields(lastSeasonById, player.id),
}));
