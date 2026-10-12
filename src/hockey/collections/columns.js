// The player table's columns. Optional columns are picked in the column chooser.

export const COLUMN_GROUPS = {
  basics: 'Basics',
  season: 'This season',
  lastSeason: 'Last season',
};

const number = 'number';
const lowFirst = (field) => ({ type: 'numberLowFirst', field });

/**
 * key: the player field shown
 * sortType: see sortPlayers, missing for columns that can't be sorted
 * isDefault: shown until the column chooser is used
 * filterable: can be used in a stat range filter
 * format: player to the text shown, instead of player[key]
 * trendField: player field with 'hot' or 'cold' for the value
 * title: explains the column, shown on hover
 */
export const COLUMNS = [
  { key: 'name', name: 'Name', group: COLUMN_GROUPS.basics, sortType: 'string', required: true },
  { key: 'team', name: 'Team', group: COLUMN_GROUPS.basics, sortType: 'string', isDefault: true },
  { key: 'owner', name: 'Owner', group: COLUMN_GROUPS.basics, sortType: 'string', isDefault: true },
  {
    key: 'availabilityLabel', name: 'Availability', group: COLUMN_GROUPS.basics, isDefault: true,
    sortType: lowFirst('availabilityOrder'),
    title: "Whether a free agent can be added now or only claimed off waivers, worked out from the league's waiver settings",
  },
  {
    key: 'todaysGame', name: "Today's Game", group: COLUMN_GROUPS.basics, isDefault: true,
    sortType: lowFirst('todaysGameStart'),
  },
  {
    key: 'gamesThisWeek', name: 'Games Left', group: COLUMN_GROUPS.basics, sortType: number, isDefault: true,
    filterable: true, title: 'Games left in the current matchup period',
  },
  { key: 'gameDays', name: 'Game Days', group: COLUMN_GROUPS.basics, isDefault: true, title: 'Days the team plays this week' },
  { key: 'position', name: 'Position', group: COLUMN_GROUPS.basics, sortType: 'string', isDefault: true },
  {
    key: 'goalieStartLabel', name: 'Starting', group: COLUMN_GROUPS.basics, sortType: lowFirst('goalieStartOrder'),
    title: "Today's starting goalies from Daily Faceoff: confirmed, likely, or unconfirmed (listed with no news yet)",
  },
  { key: 'injury', name: 'Injury', group: COLUMN_GROUPS.basics, sortType: 'string', isDefault: true },
  {
    key: 'percentOwned', name: '% Owned', group: COLUMN_GROUPS.basics, sortType: number, filterable: true,
    title: 'Percent of fleaflicker leagues the player is owned in',
  },

  { key: 'points', name: 'Points', group: COLUMN_GROUPS.season, sortType: number, isDefault: true, filterable: true },
  { key: 'avg', name: 'Avg', group: COLUMN_GROUPS.season, sortType: number, isDefault: true, filterable: true, title: 'Points per game' },
  { key: 'last1', name: 'Last 1', group: COLUMN_GROUPS.season, sortType: number, isDefault: true, filterable: true, trendField: 'trend1' },
  { key: 'last5', name: 'Last 5', group: COLUMN_GROUPS.season, sortType: number, isDefault: true, filterable: true, trendField: 'trend5' },
  { key: 'last10', name: 'Last 10', group: COLUMN_GROUPS.season, sortType: number, isDefault: true, filterable: true, trendField: 'trend10' },
  { key: 'gamesPlayed', name: 'GP', group: COLUMN_GROUPS.season, sortType: number, filterable: true, title: 'Games played' },
  { key: 'goals', name: 'G', group: COLUMN_GROUPS.season, sortType: number, filterable: true, title: 'Goals' },
  { key: 'assists', name: 'A', group: COLUMN_GROUPS.season, sortType: number, filterable: true, title: 'Assists' },
  {
    key: 'goalsAgainst', name: 'GA', group: COLUMN_GROUPS.season, sortType: lowFirst('goalsAgainst'), filterable: true,
    title: 'Goals against, for goalies',
  },
  {
    key: 'savePct', name: 'SV%', group: COLUMN_GROUPS.season, sortType: number, filterable: true,
    format: (player) => (typeof player.savePct === 'number' ? player.savePct.toFixed(3).replace(/^0/, '') : ''),
    title: 'Save percentage, for goalies. Filter with decimals, like 0.910.',
  },
  { key: 'rank', name: 'Rank', group: COLUMN_GROUPS.season, sortType: lowFirst('rank'), filterable: true, title: "Fleaflicker's fantasy rank" },
  {
    key: 'positionRank', name: 'Pos Rank', group: COLUMN_GROUPS.season, sortType: lowFirst('positionRank'), filterable: true,
    format: (player) => (player.positionRank ? `${player.positionRankLabel || ''}${player.positionRank}` : ''),
    title: "Fantasy rank at the player's position",
  },
  {
    key: 'consistency', name: 'Spread', group: COLUMN_GROUPS.season, sortType: lowFirst('consistency'), filterable: true,
    format: (player) => (typeof player.consistency === 'number' ? player.consistency.toFixed(2) : ''),
    title: "How much the player's points vary from game to game (standard deviation). Lower is steadier.",
  },

  { key: 'lastSeasonPoints', name: 'LY Points', group: COLUMN_GROUPS.lastSeason, sortType: number, filterable: true, title: 'Points last season' },
  { key: 'lastSeasonAvg', name: 'LY Avg', group: COLUMN_GROUPS.lastSeason, sortType: number, filterable: true, title: 'Points per game last season' },
  { key: 'lastSeasonGamesPlayed', name: 'LY GP', group: COLUMN_GROUPS.lastSeason, sortType: number, filterable: true, title: 'Games played last season' },
  {
    key: 'lastSeasonRank', name: 'LY Rank', group: COLUMN_GROUPS.lastSeason, sortType: lowFirst('lastSeasonRank'), filterable: true,
    title: 'Fantasy rank last season',
  },
];

export const COLUMNS_BY_KEY = Object.fromEntries(COLUMNS.map(column => [column.key, column]));

export const DEFAULT_COLUMN_KEYS = COLUMNS.filter(column => column.required || column.isDefault).map(column => column.key);

export const SORT_TYPES = Object.fromEntries(
  COLUMNS.filter(column => column.sortType).map(column => [column.key, column.sortType])
);

export const STAT_FILTER_COLUMNS = COLUMNS.filter(column => column.filterable);

export const usesLastSeason = (columnKeys) => columnKeys.some(key => COLUMNS_BY_KEY[key]?.group === COLUMN_GROUPS.lastSeason);

// Columns to show, in table order. Required columns are always shown, unknown keys are ignored.
export const visibleColumns = (columnKeys) => {
  const chosen = new Set(columnKeys?.length ? columnKeys : DEFAULT_COLUMN_KEYS);
  return COLUMNS.filter(column => column.required || chosen.has(column.key));
};

export const cellText = (column, player) => {
  const value = column.format ? column.format(player) : player[column.key];
  return value === undefined || value === null ? '' : value;
};
