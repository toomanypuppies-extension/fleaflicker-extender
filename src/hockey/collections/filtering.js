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
  // Claimable now. Players locked after waivers are processed can't be claimed or added yet.
  if (ownership === "On waivers") {
    return !player.owner && player.availability?.status === WAIVER_STATUS.waivers;
  }
  return !OWNERSHIP_OPTIONS.includes(ownership) && player.owner === ownership;
};

const matchesInjury = (player, injurySelections) => {
  if (!player.injury) {
    return injurySelections.includes("HEALTHY");
  }
  return injurySelections.includes(player.injury);
};

// Positions a listing like W or F stands for
const POSITION_GROUPS = { W: ['LW', 'RW'], F: ['C', 'LW', 'RW'] };
const expandPositions = (positions) => positions.flatMap(position => [position, ...(POSITION_GROUPS[position] || [])]);

// A lineup spot like { date, eligibility }: the player's team plays that day and they can fill it
const fitsSpot = (player, { date, eligibility }, teamsByDate) => {
  if (!teamsByDate?.[date]?.includes(player.team)) {
    return false;
  }
  const canPlay = expandPositions([...(player.positions || []), ...(player.position || '').split('/')]);
  const slotTakes = expandPositions(eligibility || []);
  return canPlay.some(position => slotTakes.includes(position));
};

// The Goalie starts filter: today's starters with any of the picked Daily Faceoff statuses
// (goalieStartLabel's: Confirmed, Likely, Unconfirmed)
const matchesGoalieStart = (player, goalieStartSelections) => (
  goalieStartSelections.length === 0 || goalieStartSelections.includes(player.goalieStartLabel)
);

/**
 * @param {Array} players
 * @param {Object} filters the filter state from the store: filter, teamSelections, injurySelections,
 *   positionSelections, gameDaysSelections, gameDaysMode, ownership, statFilters, spotFilters, goalieStartSelections
 * @param {Object} gamesByTeam team abbreviation to the days it plays, e.g. { SEA: ['Mo', 'We'] }
 * @param {Object} teamsByDate date (YYYY-MM-DD) to the teams playing, for spotFilters
 */
export const filterPlayers = (players, filters, gamesByTeam, teamsByDate = {}) => {
  const {
    filter = "",
    teamSelections = [],
    injurySelections = [],
    positionSelections = [],
    gameDaysSelections = [],
    gameDaysMode = GAME_DAYS_MODES.all,
    ownership = "",
    statFilters = [],
    spotFilters = [],
    goalieStartSelections = [],
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
    statFilters.every(statFilter => matchesStatFilter(player, statFilter)) &&
    spotFilters.every(spot => fitsSpot(player, spot, teamsByDate)) &&
    matchesGoalieStart(player, goalieStartSelections)
  ));
};
