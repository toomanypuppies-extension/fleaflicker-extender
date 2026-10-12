import { HOCKEY_TEAM_ABBR_TO_NAME } from "../constants";

// A light night has fewer than half the league's 32 teams playing, so fewer fantasy players are
// active and a streamer is more likely to fit in a lineup
export const LIGHT_NIGHT_MAX_GAMES = 7;

export const NHL_TEAMS = Object.keys(HOCKEY_TEAM_ABBR_TO_NAME).filter(team => team !== 'FA');

// The date in Eastern as YYYY-MM-DD, how the NHL's schedule lists days
export const easternDate = (epochMilli) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date(epochMilli));

/**
 * A week of the schedule as a team by day grid.
 * @param {{ days: Array }} week from convertSchedule
 * @returns {{ days: Array, teams: Array }}
 *   days: [{ date, dayAbbrev, gameCount, light, past }]
 *   teams: [{ team, cells: [{ opponent, home } | null per day], games, lightGames, gamesLeft }]
 */
export const weekGrid = (week, { now = Date.now() } = {}) => {
  const today = easternDate(now);
  const days = (week?.days || []).map(day => ({
    date: day.date,
    dayAbbrev: day.dayAbbrev,
    gameCount: day.games.length,
    light: day.games.length > 0 && day.games.length <= LIGHT_NIGHT_MAX_GAMES,
    past: day.date < today,
  }));

  const teams = NHL_TEAMS.map(team => {
    const cells = (week?.days || []).map(day => {
      const game = day.games.find(g => g.away === team || g.home === team);
      if (!game) return null;
      const home = game.home === team;
      return { opponent: home ? game.away : game.home, home, start: game.start };
    });
    const playing = cells.map((cell, i) => (cell ? days[i] : null)).filter(Boolean);
    return {
      team,
      cells,
      games: playing.length,
      lightGames: playing.filter(day => day.light).length,
      gamesLeft: playing.filter(day => !day.past).length,
    };
  });

  return { days, teams };
};
