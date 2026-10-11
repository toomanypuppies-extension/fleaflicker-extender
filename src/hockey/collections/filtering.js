import { HOCKEY_TEAM_NAME_TO_ABBR, OWNERSHIP_OPTIONS } from "../constants";
import { containsAll } from "../../utils/util";
import { WAIVER_STATUS } from "./waivers";

export const GAME_DAYS_MODES = {
  // Teams playing on every selected day
  all: 'all',
  // Teams playing on at least one of them
  any: 'any',
};

const teamsPlayingOn = (gamesByTeam, days, mode) => new Set(
  Object.entries(gamesByTeam || {})
    .filter(([, teamDays]) => (
      mode === GAME_DAYS_MODES.any ? days.some(day => teamDays.includes(day)) : containsAll(teamDays, days)
    ))
    .map(([team]) => team)
);

// A stat filter like { key: 'avg', min: 2.5, max: null }. Players without the stat don't match.
const matchesStatFilter = (player, { key, min, max }) => {
  const value = player[key];
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return false;
  }
  return (min === null || min === undefined || value >= min) &&
    (max === null || max === undefined || value <= max);
};

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
  if (ownership === "Addable now") {
    return !player.owner && player.availability?.status === WAIVER_STATUS.free;
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
 *   positionSelections, gameDaysSelections, gameDaysMode, ownership, statFilters
 * @param {Object} gamesByTeam team abbreviation to the days it plays, e.g. { SEA: ['Mo', 'We'] }
 */
export const filterPlayers = (players, filters, gamesByTeam) => {
  const {
    filter = "",
    teamSelections = [],
    injurySelections = [],
    positionSelections = [],
    gameDaysSelections = [],
    gameDaysMode = GAME_DAYS_MODES.all,
    ownership = "",
    statFilters = [],
  } = filters;

  const search = filter.trim().toLowerCase();
  const teams = new Set(teamSelections.map(team => HOCKEY_TEAM_NAME_TO_ABBR[team]));
  const teamsWithGames = gameDaysSelections.length > 0
    ? teamsPlayingOn(gamesByTeam, gameDaysSelections, gameDaysMode)
    : null;

  return (players || []).filter(player => (
    matchesOwnership(player, ownership) &&
    (!teamsWithGames || teamsWithGames.has(player.team)) &&
    (teams.size === 0 || teams.has(player.team)) &&
    (injurySelections.length === 0 || matchesInjury(player, injurySelections)) &&
    (positionSelections.length === 0 || positionSelections.some(pos => player.positions.includes(pos))) &&
    (!search || player.name.toLowerCase().includes(search)) &&
    statFilters.every(statFilter => matchesStatFilter(player, statFilter))
  ));
};
