import { IR_ELIGIBLE_INJURIES, ROSTER_GROUPS } from "./league";
import { dayOrdinalAt, dayDate } from "./boxscores";

/**
 * How a player's expected points per game are worked out, picked in the app.
 * Each falls back to the next best number when the player has no games for it.
 */
export const PROJECTION_METHODS = {
  mix: {
    label: 'Mix',
    description: "70% season average, 30% last 5 games. The season average leans on last season's until a player has played about 10 games.",
  },
  season: { label: 'Season average', description: "This season's points per game." },
  last5: { label: 'Last 5 games', description: 'Points per game over the last 5 games.' },
  lastSeason: { label: 'Last season', description: "Last season's points per game." },
};
export const DEFAULT_PROJECTION_METHOD = 'mix';

// In the mix, last season's average counts like this many games of this season's
const LAST_SEASON_WEIGHT_GAMES = 10;
const RECENT_FORM_WEIGHT = 0.3;
const GAMES_IN_SEASON = 82;
// When a player's game to game spread isn't known, guess it from their average
const DEFAULT_SPREAD_RATIO = 0.8;

const isGoalie = (player) => player.positions?.includes('G') || player.position === 'G';

/**
 * Expected points per game for a player, by PROJECTION_METHODS key
 */
export const pointsPerGame = (player, method = DEFAULT_PROJECTION_METHOD) => {
  const played = player.gamesPlayed > 0;
  const season = played ? player.avg : null;
  const last5 = played ? player.last5 : null;
  const lastSeason = player.lastSeasonAvg ?? null;

  switch (method) {
    case 'season':
      return season ?? lastSeason ?? 0;
    case 'last5':
      return last5 ?? season ?? lastSeason ?? 0;
    case 'lastSeason':
      return lastSeason ?? season ?? 0;
    default: {
      const gamesPlayed = played ? player.gamesPlayed : 0;
      const blended = lastSeason === null
        ? season ?? 0
        : ((season ?? 0) * gamesPlayed + lastSeason * LAST_SEASON_WEIGHT_GAMES) / (gamesPlayed + LAST_SEASON_WEIGHT_GAMES);
      return last5 === null ? blended : blended * (1 - RECENT_FORM_WEIGHT) + last5 * RECENT_FORM_WEIGHT;
    }
  }
};

/**
 * Games played by each NHL team so far, the most any of its players has played
 */
export const teamGamesPlayed = (players) => {
  const games = {};
  for (const player of players) {
    games[player.team] = Math.max(games[player.team] || 0, player.gamesPlayed || 0);
  }
  return games;
};

/**
 * How likely a player is to play in one of their team's games: 1 for skaters, the share of their
 * team's games a goalie has started for goalies.
 */
export const startRate = (player, teamGames) => {
  if (!isGoalie(player)) {
    return 1;
  }
  const games = teamGames[player.team] || 0;
  if (games > 0) {
    return Math.min((player.gamesPlayed || 0) / games, 1);
  }
  // Before the season's first games
  return player.lastSeasonGamesPlayed ? Math.min(player.lastSeasonGamesPlayed / GAMES_IN_SEASON, 1) : 0.5;
};

/**
 * The lineup worth the most: assigns players to slots to maximise the total value.
 * @param {Array<{ value: number, positions: string[] }>} players
 * @param {Array<{ label, eligibility: string[] }>} slots one entry per slot
 * @returns {Array<number|null>} for each slot, the index of the player in it
 */
export const bestLineup = (players, slots) => {
  if (!slots.length) {
    return [];
  }
  // The Hungarian algorithm on slots x players, minimising cost. Empty "players" let slots stay
  // empty, and slots never take a player who can't fill them.
  const NOT_ALLOWED = 1e9;
  const columns = Math.max(players.length, 0) + slots.length;
  const cost = slots.map(slot => Array.from({ length: columns }, (_, j) => {
    if (j >= players.length) {
      return 0;
    }
    const player = players[j];
    return player.positions.some(position => slot.eligibility.includes(position)) ? -Math.max(player.value, 0) : NOT_ALLOWED;
  }));

  const n = slots.length;
  const m = columns;
  const u = new Array(n + 1).fill(0);
  const v = new Array(m + 1).fill(0);
  const p = new Array(m + 1).fill(0);
  const way = new Array(m + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array(m + 1).fill(Infinity);
    const used = new Array(m + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = Infinity;
      let j1 = 0;
      for (let j = 1; j <= m; j++) {
        if (!used[j]) {
          const current = cost[i0 - 1][j - 1] - u[i0] - v[j];
          if (current < minv[j]) {
            minv[j] = current;
            way[j] = j0;
          }
          if (minv[j] < delta) {
            delta = minv[j];
            j1 = j;
          }
        }
      }
      for (let j = 0; j <= m; j++) {
        if (used[j]) {
          u[p[j]] += delta;
          v[j] -= delta;
        } else {
          minv[j] -= delta;
        }
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0);
  }

  const lineup = new Array(n).fill(null);
  for (let j = 1; j <= m; j++) {
    const slotIndex = p[j] - 1;
    const playerIndex = j - 1;
    if (slotIndex >= 0 && playerIndex < players.length && cost[slotIndex][playerIndex] < 0) {
      lineup[slotIndex] = playerIndex;
    }
  }
  return lineup;
};

// Each slot once per opening, like two 'C' entries for two center slots
const expandSlots = (startSlots) => startSlots.flatMap(slot => Array.from({ length: slot.count }, () => slot));

const gamesByDate = (schedule) => {
  const byDate = new Map();
  for (const week of schedule || []) {
    for (const day of week.days || []) {
      byDate.set(day.date, day.games || []);
    }
  }
  return byDate;
};

const gameFor = (games, team) => games?.find(game => game.away === team || game.home === team);

const groupSlots = (groups, group) => (groups || []).filter(g => g.group === group).flatMap(g => g.slots);

const round = (value) => Math.round(value * 100) / 100;

/**
 * Expected points a team adds over the rest of a matchup period with the lineups it has set:
 * { expected, bench, best, variance, bestVariance, days: [{ day, date, expected, bench, best, hasLineup }], players }.
 * Only starters' points count. `bench` is what benched players with games are expected to score,
 * `best` what the best possible lineup each day would score instead. Injured players, DTD too,
 * are expected to score nothing. Games that started before `scoreAsOf` are left out, their points
 * are already in the score.
 * @param lineupFor (day) => that day's roster groups, like loadTeamRosters', or null if not known
 * @param playersById the player table's players, for averages
 */
export const projectTeam = ({
  lineupFor, playersById, startSlots = [], schedule, period, method = DEFAULT_PROJECTION_METHOD, teamGames = {}, scoreAsOf = Date.now(),
}) => {
  if (!period) {
    return { expected: 0, bench: 0, best: 0, variance: 0, days: [], players: [] };
  }

  const players = new Map();
  const playerFor = (rosterPlayer) => {
    if (!players.has(rosterPlayer.id)) {
      const player = { ...rosterPlayer, ...playersById.get(rosterPlayer.id) };
      const positions = player.positions || (player.position || '').split('/');
      const injured = IR_ELIGIBLE_INJURIES.includes(player.injury);
      const rate = pointsPerGame(player, method);
      const chance = injured ? 0 : startRate({ ...player, positions }, teamGames);
      const spread = player.consistency ?? Math.abs(rate) * DEFAULT_SPREAD_RATIO;
      players.set(rosterPlayer.id, {
        id: player.id,
        name: player.name,
        team: player.team,
        position: player.position,
        positions,
        injury: player.injury,
        injured,
        rate,
        startRate: chance,
        // Mean and variance of one of the player's team's games
        gameValue: chance * rate,
        gameVariance: chance * (spread ** 2 + rate ** 2) - (chance * rate) ** 2,
        // Games in the lineup, and on the bench
        games: 0,
        benchGames: 0,
        expected: 0,
        benchExpected: 0,
      });
    }
    return players.get(rosterPlayer.id);
  };

  const games = gamesByDate(schedule);
  const allSlots = expandSlots(startSlots);
  const firstDay = dayOrdinalAt(period, scoreAsOf);
  const days = [];
  let variance = 0;
  let bestVariance = 0;

  for (let day = firstDay; day <= period.lastDay; day++) {
    const date = dayDate(period, day);
    const groups = lineupFor(day);
    if (!groups) {
      days.push({ day, date, expected: 0, bench: 0, best: 0, hasLineup: false });
      continue;
    }
    const dayGames = games.get(date);
    const gameOf = (player) => gameFor(dayGames, player.team);
    const playsLater = (player) => {
      const game = gameOf(player);
      return !!game && game.start > scoreAsOf;
    };

    const starterSlots = groupSlots(groups, ROSTER_GROUPS.start).filter(slot => slot.player);
    const benched = groupSlots(groups, ROSTER_GROUPS.bench).map(slot => slot.player).filter(Boolean);
    let expected = 0;
    let bench = 0;

    for (const slot of starterSlots) {
      if (!playsLater(slot.player)) continue;
      const player = playerFor(slot.player);
      player.games += 1;
      player.expected += player.gameValue;
      expected += player.gameValue;
      variance += player.gameVariance;
    }
    for (const rosterPlayer of benched) {
      const player = playerFor(rosterPlayer);
      if (!playsLater(rosterPlayer) || player.gameValue <= 0) continue;
      player.benchGames += 1;
      player.benchExpected += player.gameValue;
      bench += player.gameValue;
    }
    // Starters not playing later today still show in the player list
    starterSlots.forEach(slot => playerFor(slot.player));

    // The best lineup from everyone with a game still to come. Starters whose game has begun are
    // locked in, their slots can't be used again.
    const openSlots = [...allSlots];
    for (const slot of starterSlots) {
      const game = gameOf(slot.player);
      if (game && game.start <= scoreAsOf) {
        const index = openSlots.findIndex(candidate => candidate.label === slot.label);
        if (index >= 0) openSlots.splice(index, 1);
      }
    }
    const candidates = [...starterSlots.map(slot => slot.player), ...benched]
      .filter(playsLater)
      .map(playerFor)
      .filter(player => player.gameValue > 0);
    const lineup = bestLineup(candidates.map(player => ({ value: player.gameValue, positions: player.positions })), openSlots);
    const chosen = lineup.filter(index => index !== null).map(index => candidates[index]);
    const best = chosen.reduce((total, player) => total + player.gameValue, 0);
    bestVariance += chosen.reduce((total, player) => total + player.gameVariance, 0);

    days.push({ day, date, expected: round(expected), bench: round(bench), best: round(best), hasLineup: true });
  }

  const sum = (key) => round(days.reduce((total, day) => total + day[key], 0));
  return {
    expected: sum('expected'),
    bench: sum('bench'),
    best: sum('best'),
    variance,
    bestVariance,
    days,
    players: [...players.values()]
      .map(player => ({ ...player, expected: round(player.expected), benchExpected: round(player.benchExpected) }))
      .sort((a, b) => b.expected - a.expected || b.benchExpected - a.benchExpected || b.rate - a.rate),
  };
};

// Games a projection expects the team to start or bench
export const gamesLeft = (projection) => projection.players.reduce((total, player) => total + player.games + player.benchGames, 0);

/**
 * A win chance as a percentage. While games are left nothing is certain, so near certainties
 * show as >99% or <1%.
 */
export const formatChance = (fraction, anyGamesLeft) => {
  if (anyGamesLeft && fraction > 0.99) return '>99%';
  if (anyGamesLeft && fraction < 0.01) return '<1%';
  return `${Math.round(fraction * 100)}%`;
};

// Standard normal cumulative distribution (Abramowitz and Stegun 7.1.26)
const normalCdf = (x) => {
  const t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2);
  const erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t
    * Math.exp(-(x * x) / 2);
  return x >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
};

/**
 * Chance the first team finishes ahead, from the current scores and both projections
 */
export const winChance = (score, projection, opponentScore, opponentProjection) => {
  const lead = (score + projection.expected) - (opponentScore + opponentProjection.expected);
  const spread = Math.sqrt(projection.variance + opponentProjection.variance);
  if (spread === 0) {
    return lead > 0 ? 1 : lead < 0 ? 0 : 0.5;
  }
  return normalCdf(lead / spread);
};
