import { getStored, setStoredEntries } from "../../utils/db";
import { getLeagueBoxscore, getLeagueScoreboard } from "../../utils/flea";
import { easternDay } from "../../utils/util";
import { ROSTER_GROUPS } from "./league";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
// Fleaflicker's scoring days start at 6am Eastern
const SCORING_DAY_START_HOUR = 6;
// Box scores for today change while games are played. Earlier days are kept for good.
const LIVE_BOXSCORE_MAX_AGE = 5 * MINUTE;
// Save fetched box scores every so often, so a long first load isn't lost if the page closes
const SAVE_EVERY = 10;

export const COMPARE_RANGES = {
  matchup: { label: 'This matchup', periods: 1 },
  last4: { label: 'Last 4 matchups', periods: 4 },
  season: { label: 'Season', periods: Infinity },
};

// Positions in the order they're shown
export const POSITIONS = ['C', 'LW', 'RW', 'D', 'G'];

const round = (value) => Math.round(value * 100) / 100;

const convertSide = (lineups, side) => lineups.flatMap(lineup => (lineup.slots || []).map(slot => {
  const proPlayer = slot[side]?.proPlayer;
  if (!proPlayer) {
    return null;
  }
  const games = slot[side].requestedGames || [];
  return {
    // Fleaflicker leaves out the bench's group
    group: lineup.group || ROSTER_GROUPS.bench,
    slot: slot.position?.label,
    playerId: proPlayer.id,
    name: proPlayer.nameFull,
    position: proPlayer.position,
    games: games.length,
    points: round(games.reduce((total, game) => total + (game.pointsActual?.value || 0), 0)),
  };
}).filter(Boolean));

/**
 * One day of a matchup: each side's lineup with every player's points that day, and the points
 * fleaflicker counted for each side (the starters').
 */
export const convertBoxscore = (boxscore) => ({
  day: boxscore.scoringPeriod?.ordinal,
  awayId: boxscore.game?.away?.id,
  homeId: boxscore.game?.home?.id,
  away: convertSide(boxscore.lineups || [], 'away'),
  home: convertSide(boxscore.lineups || [], 'home'),
  awayPoints: boxscore.pointsAway?.scoringPeriod?.value?.value ?? 0,
  homePoints: boxscore.pointsHome?.scoringPeriod?.value?.value ?? 0,
});

// Midnight UTC of the Eastern calendar date, for counting days without daylight saving trouble
const easternDate = (time) => {
  const [month, date, year] = easternDay(time).split('/').map(Number);
  return Date.UTC(year, month - 1, date);
};

/**
 * Fleaflicker's scoring period (day ordinal) at `time`, within the matchup period. Days start at
 * 6am Eastern. Clamped to the period's days.
 */
export const dayOrdinalAt = (period, time) => {
  const index = Math.round((easternDate(time - SCORING_DAY_START_HOUR * HOUR) - easternDate(period.start)) / DAY);
  return Math.min(Math.max(period.firstDay + index, period.firstDay), period.lastDay);
};

// The day's date in Eastern time, like 2026-10-11, as the NHL schedule lists games
export const dayDate = (period, day) => new Date(
  easternDate(period.start) + (day - period.firstDay) * DAY
).toISOString().slice(0, 10);

/**
 * Matchup periods that have started, most recent last, limited to the range's count
 */
export const periodsInRange = (scoreboard, rangeKey, now) => {
  const started = (scoreboard?.periods || []).filter(period => period.start <= now);
  const count = COMPARE_RANGES[rangeKey]?.periods ?? 1;
  return count === Infinity ? started : started.slice(-count);
};

const findMatchup = (matchups, teamId) => matchups.find(m => m.awayId === teamId || m.homeId === teamId);

/**
 * Every day so far of the given teams' matchups in the range, from box scores:
 * { days: { [teamId]: [{ period, day, opponentId, lineup, points }] }, failed }
 * `lineup` is the team's players that day, `points` what fleaflicker counted. Box scores for days
 * that are over are stored for good, so after the first load only today's are fetched.
 * @param {(done: number, total: number) => void} onProgress called as box scores are fetched
 */
export const loadTeamDays = async (leagueId, { scoreboard, teamIds, range = 'matchup', now = Date.now(), onProgress }) => {
  const periods = periodsInRange(scoreboard, range, now);
  const stored = (await getStored('hockey_boxscores', leagueId)) || {};
  const storedMatchups = (await getStored('hockey_matchups', leagueId)) || {};
  const boxscores = { ...stored };
  const matchupsByPeriod = { ...storedMatchups };
  let failed = 0;

  const save = () => setStoredEntries({ hockey_boxscores: boxscores, hockey_matchups: matchupsByPeriod }, leagueId);

  // Which matchup each team was in, for each period
  for (const period of periods) {
    if (period.ordinal === scoreboard.currentOrdinal) {
      matchupsByPeriod[period.ordinal] = scoreboard.matchups.map(({ gameId, awayId, homeId }) => ({ gameId, awayId, homeId }));
    } else if (!matchupsByPeriod[period.ordinal]) {
      try {
        const response = await getLeagueScoreboard(leagueId, period.firstDay);
        matchupsByPeriod[period.ordinal] = (response?.games || []).map(game => ({
          gameId: game.id, awayId: game.away?.id, homeId: game.home?.id,
        }));
      } catch (err) {
        console.error(err);
        failed++;
      }
    }
  }

  const wanted = [];
  for (const period of periods) {
    const lastDaySoFar = dayOrdinalAt(period, now);
    const gameIds = new Set(teamIds
      .map(teamId => findMatchup(matchupsByPeriod[period.ordinal] || [], teamId)?.gameId)
      .filter(Boolean));
    for (const gameId of gameIds) {
      for (let day = period.firstDay; day <= lastDaySoFar; day++) {
        // Days before the current one are over, unless the period itself is
        const final = period.end <= now || day < lastDaySoFar;
        wanted.push({ key: `${gameId}:${day}`, gameId, day, final });
      }
    }
  }

  const toFetch = wanted.filter(({ key }) => {
    const box = boxscores[key];
    return !box || (!box.final && now - box.fetchedAt >= LIVE_BOXSCORE_MAX_AGE);
  });

  // One at a time, fleaClient spaces out the calls anyway
  for (const [index, { key, gameId, day, final }] of toFetch.entries()) {
    onProgress?.(index, toFetch.length);
    try {
      const response = await getLeagueBoxscore(leagueId, gameId, day);
      if (response) {
        boxscores[key] = { ...convertBoxscore(response), day, final, fetchedAt: now };
      }
    } catch (err) {
      // Keep what was stored, if anything
      console.error(err);
      failed++;
    }
    if ((index + 1) % SAVE_EVERY === 0) {
      await save();
    }
  }
  onProgress?.(toFetch.length, toFetch.length);
  if (toFetch.length || Object.keys(matchupsByPeriod).length !== Object.keys(storedMatchups).length) {
    await save();
  }

  const days = Object.fromEntries(teamIds.map(teamId => [teamId, periods.flatMap(period => {
    const matchup = findMatchup(matchupsByPeriod[period.ordinal] || [], teamId);
    if (!matchup) {
      return [];
    }
    const side = matchup.homeId === teamId ? 'home' : 'away';
    return wanted
      .filter(({ gameId }) => gameId === matchup.gameId)
      .map(({ key }) => boxscores[key])
      .filter(Boolean)
      .map(box => ({
        period: period.ordinal,
        day: box.day,
        opponentId: side === 'home' ? matchup.awayId : matchup.homeId,
        lineup: box[side],
        points: box[`${side}Points`],
      }));
  })]));

  return { days, failed };
};

// A player's main position, the first listed (C/LW counts as C)
export const primaryPosition = (position) => (position || '').split('/')[0];

// Starters with a game that day, the only players whose points count
const countedSlots = (days) => days.flatMap(day => day.lineup.filter(slot => slot.group === ROSTER_GROUPS.start && slot.games > 0));

/**
 * Counted points by player, most first: [{ playerId, name, position, points, games }]
 */
export const pointsByPlayer = (days) => {
  const byId = new Map();
  for (const slot of countedSlots(days)) {
    const player = byId.get(slot.playerId) || { playerId: slot.playerId, name: slot.name, position: slot.position, points: 0, games: 0 };
    player.points += slot.points;
    player.games += slot.games;
    byId.set(slot.playerId, player);
  }
  return [...byId.values()]
    .map(player => ({ ...player, points: round(player.points) }))
    .sort((a, b) => b.points - a.points);
};

/**
 * Counted points by the players' main position: [{ position, points, games }] in POSITIONS order
 */
export const pointsByPosition = (days) => {
  const totals = Object.fromEntries(POSITIONS.map(position => [position, { position, points: 0, games: 0 }]));
  for (const slot of countedSlots(days)) {
    const total = totals[primaryPosition(slot.position)];
    if (total) {
      total.points += slot.points;
      total.games += slot.games;
    }
  }
  return POSITIONS.map(position => ({ ...totals[position], points: round(totals[position].points) }));
};

// What fleaflicker counted over the days
export const totalPoints = (days) => round(days.reduce((total, day) => total + day.points, 0));
