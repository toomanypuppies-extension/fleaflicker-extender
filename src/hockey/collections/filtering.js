import { HOCKEY_TEAM_NAME_TO_ABBR, OWNERSHIP_OPTIONS } from "../constants";
import { containsAll } from "../../utils/util";

// Teams that play on every one of the selected days
const teamsPlayingOn = (gamesByTeam, days) => new Set(
  Object.entries(gamesByTeam || {})
    .filter(([, teamDays]) => containsAll(teamDays, days))
    .map(([team]) => team)
);

const matchesOwnership = (player, ownership) => {
  if (!ownership || ownership === "All") {
    return true;
  }
  if (ownership === "Free Agent") {
    return !player.owner;
  }
  if (ownership === "Owned") {
    return !!player.owner;
  }
  return !OWNERSHIP_OPTIONS.includes(ownership) && player.owner === ownership;
};

const matchesInjury = (player, injurySelections) => {
  if (!player.injury) {
    return injurySelections.includes("HEALTHY");
  }
  return injurySelections.includes(player.injury);
};

/**
 * @param {Array} players
 * @param {Object} filters the filter state from the store: filter, teamSelections, injurySelections,
 *   positionSelections, gameDaysSelections, ownership
 * @param {Object} gamesByTeam team abbreviation to the days it plays, e.g. { SEA: ['Mo', 'We'] }
 */
export const filterPlayers = (players, filters, gamesByTeam) => {
  const {
    filter = "",
    teamSelections = [],
    injurySelections = [],
    positionSelections = [],
    gameDaysSelections = [],
    ownership = "",
  } = filters;

  const search = filter.trim().toLowerCase();
  const teams = new Set(teamSelections.map(team => HOCKEY_TEAM_NAME_TO_ABBR[team]));
  const teamsWithGames = gameDaysSelections.length > 0 ? teamsPlayingOn(gamesByTeam, gameDaysSelections) : null;

  return (players || []).filter(player => (
    matchesOwnership(player, ownership) &&
    (!teamsWithGames || teamsWithGames.has(player.team)) &&
    (teams.size === 0 || teams.has(player.team)) &&
    (injurySelections.length === 0 || matchesInjury(player, injurySelections)) &&
    (positionSelections.length === 0 || positionSelections.some(pos => player.positions.includes(pos))) &&
    (!search || player.name.toLowerCase().includes(search))
  ));
};
