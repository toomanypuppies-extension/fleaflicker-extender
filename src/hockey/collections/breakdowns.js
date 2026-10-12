import { pointsByPlayer, pointsByPosition, primaryPosition, POSITIONS } from "./boxscores";

// Players shown in a chart at first, and named in the tooltip of the rest
export const TOP_PLAYERS = 12;
const OTHERS_NAMED = 4;

const round = (value) => Math.round(value * 100) / 100;

/**
 * A team's players by points: scored in box score `days`, and projected for the rest of the
 * matchup if there's a `projection` (projectTeam's). Most points first:
 * [{ id, name, position, scored, games, projected, starts }]
 */
export const playerBreakdown = (days, projection = null) => {
  const byId = new Map();
  const playerFor = (id, name, position) => {
    if (!byId.has(id)) byId.set(id, { id, name, position, scored: 0, games: 0, projected: 0, starts: 0 });
    return byId.get(id);
  };
  for (const player of pointsByPlayer(days || [])) {
    Object.assign(playerFor(player.playerId, player.name, player.position), { scored: player.points, games: player.games });
  }
  for (const player of projection?.players || []) {
    if (player.expected > 0) {
      Object.assign(playerFor(player.id, player.name, player.position), { projected: player.expected, starts: player.games });
    }
  }
  return [...byId.values()].sort((a, b) => (b.scored + b.projected) - (a.scored + a.projected));
};

/**
 * Points by main position: scored in `days`, projected from `projection`:
 * [{ position, scored, games, projected, starts }] in POSITIONS order
 */
export const positionBreakdown = (days, projection = null) => {
  const scored = pointsByPosition(days || []);
  const projected = Object.fromEntries(POSITIONS.map(position => [position, { points: 0, starts: 0 }]));
  for (const player of projection?.players || []) {
    const total = projected[primaryPosition(player.position, player.positions)];
    if (total) {
      total.points += player.expected;
      total.starts += player.games;
    }
  }
  return scored.map(({ position, points, games }) => ({
    position,
    scored: points,
    games,
    projected: round(projected[position].points),
    starts: projected[position].starts,
  }));
};

const format = (value) => (value ?? 0).toFixed(1);

/**
 * BarChart rows for one team's playerBreakdown: the top `shown` players, then the rest as one row.
 * With `stacked`, each value is [scored, projected].
 */
export const playerChartRows = (players, { stacked = false, shown = TOP_PLAYERS } = {}) => {
  const value = (scored, projected) => (stacked ? [scored, projected] : scored);
  const rows = players.slice(0, shown).map(player => {
    const scoredDetail = `${player.position} · ${player.games} games started`
      + (player.games ? ` · ${format(player.scored / player.games)} per game` : '');
    const projectedDetail = `${player.starts} ${player.starts === 1 ? 'start' : 'starts'} left`;
    return {
      key: player.id,
      label: player.name,
      values: [value(player.scored, player.projected)],
      details: [stacked ? [scoredDetail, projectedDetail] : scoredDetail],
    };
  });
  const rest = players.slice(shown);
  if (rest.length) {
    const sum = (key) => round(rest.reduce((total, player) => total + player[key], 0));
    // A few names, a long list makes a tooltip taller than the chart
    const names = rest.slice(0, OTHERS_NAMED).map(player => player.name).join(', ');
    const more = rest.length > OTHERS_NAMED ? ` and ${rest.length - OTHERS_NAMED} more` : '';
    const detail = `${names}${more}`;
    rows.push({
      key: 'others',
      label: rest.length === 1 ? '1 other' : `${rest.length} others`,
      values: [value(sum('scored'), sum('projected'))],
      details: [stacked ? [detail, detail] : detail],
    });
  }
  return rows;
};

/**
 * BarChart rows for positionBreakdowns, one per team (series)
 */
export const positionChartRows = (breakdowns, { stacked = false } = {}) => POSITIONS.map((position, index) => ({
  key: position,
  label: position,
  values: breakdowns.map(rows => (stacked ? [rows[index].scored, rows[index].projected] : rows[index].scored)),
  details: breakdowns.map(rows => (stacked
    ? [`${rows[index].games} games started`, `${rows[index].starts} starts left`]
    : `${rows[index].games} games started`)),
}));
