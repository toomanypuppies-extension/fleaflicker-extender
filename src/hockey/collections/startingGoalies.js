import { getStored, setStored } from "../../utils/db";
import { getStartingGoalies } from "../api/dailyFaceoff";
import { HOCKEY_TEAM_NAME_TO_ABBR } from "../constants";

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
// Starters are announced through the day. The proxy checks Daily Faceoff every 15 minutes.
const UNSETTLED_MAX_AGE = 15 * MINUTE;
// Days are kept this long, so last night's still shows in the morning
const KEEP_DAYS = 3;
// The NHL's schedule is the same for every league
const STORAGE_ID = 'nhl';
const STORAGE_KEY = 'hockey_startingGoalies';

// Daily Faceoff's statuses for a starter, as its page shows them: news that he's starting, news
// pointing to him, or none yet (no status, which its page shows as Unconfirmed)
export const GOALIE_START_STATUSES = { confirmed: 'Confirmed', likely: 'Likely', unconfirmed: 'Unconfirmed' };
export const CONFIRMED = GOALIE_START_STATUSES.confirmed;
// Daily Faceoff's page for a day's starters, like /starting-goalies/2026-10-12
export const startingGoaliesUrl = (date) => `https://www.dailyfaceoff.com/starting-goalies/${date}`;

/**
 * A day's starting goalies from Daily Faceoff (through the proxy):
 * { date, games: [{ start, away, home }], complete, fetchedAt }, sides like { team, goalie, status, details,
 * source, sourceUrl }. Kept, and once every starter is confirmed (complete) never fetched again.
 * Null if they've never been loaded and can't be.
 */
export const loadStartingGoalies = async (date, { now = Date.now(), forceRefresh = false } = {}) => {
  const stored = (await getStored(STORAGE_KEY, STORAGE_ID)) || {};
  const entry = stored[date];
  if (entry && (entry.complete || (!forceRefresh && now - entry.fetchedAt < UNSETTLED_MAX_AGE))) {
    return entry;
  }
  try {
    const day = await getStartingGoalies(date);
    if (!day?.games) {
      return entry || null;
    }
    const fresh = { date, games: day.games, complete: !!day.complete, fetchedAt: now };
    // Older days are left out
    const kept = Object.fromEntries(Object.entries(stored).filter(([key]) => Date.parse(key) > now - KEEP_DAYS * DAY));
    await setStored(STORAGE_KEY, { ...kept, [date]: fresh }, STORAGE_ID);
    return fresh;
  } catch (err) {
    console.error(err);
    return entry || null;
  }
};

// Lowercase letters only, so "St Louis Blues" is "St. Louis Blues" and "Stützle" is "Stutzle"
const normalize = (name) => (name || '').normalize('NFD').replace(/[^a-zA-Z]/g, '').toLowerCase();
const lastName = (name) => normalize((name || '').trim().split(/\s+/).slice(1).join(' '));

const TEAM_ABBR = Object.fromEntries(Object.entries(HOCKEY_TEAM_NAME_TO_ABBR).map(([name, abbr]) => [normalize(name), abbr]));

const isGoalie = (player) => player.position === 'G' || player.positions?.includes('G');

/**
 * Each goalie's start today, by player id, for the goalies on teams Daily Faceoff lists:
 * { starting, status, starter, details, source, sourceUrl, date, fetchedAt }. The listed starter has
 * starting true and status 'Confirmed' or null (not yet). Their team's other goalies have starting
 * false, and starter is who's listed instead. Goalies are matched by team and name, or last name
 * when that's unique on the team.
 */
export const goalieStarts = (day, players) => {
  const starts = new Map();
  if (!day?.games) {
    return starts;
  }
  const goaliesByTeam = new Map();
  for (const player of players || []) {
    if (isGoalie(player)) {
      goaliesByTeam.set(player.team, [...(goaliesByTeam.get(player.team) || []), player]);
    }
  }
  const findGoalie = (goalies, name) => {
    const exact = goalies.filter(goalie => normalize(goalie.name) === normalize(name));
    if (exact.length === 1) return exact[0];
    const byLastName = goalies.filter(goalie => lastName(goalie.name) === lastName(name));
    return byLastName.length === 1 ? byLastName[0] : null;
  };

  for (const game of day.games) {
    for (const side of [game.away, game.home]) {
      const team = TEAM_ABBR[normalize(side?.team)];
      const goalies = goaliesByTeam.get(team) || [];
      if (!team || !side.goalie) continue;
      const starter = findGoalie(goalies, side.goalie);
      const shared = { status: side.status || null, starter: side.goalie, date: day.date, fetchedAt: day.fetchedAt };
      for (const goalie of goalies) {
        starts.set(goalie.id, goalie === starter
          ? { ...shared, starting: true, details: side.details || null, source: side.source || null, sourceUrl: side.sourceUrl || null }
          : { ...shared, starting: false });
      }
    }
  }
  return starts;
};

// For sorting: confirmed starters first, then likely, then unconfirmed
export const GOALIE_START_ORDER = { Confirmed: 1, Likely: 2, Unconfirmed: 3 };

/**
 * A starter's status as Daily Faceoff shows it: "Confirmed", "Likely" or "Unconfirmed" (no news
 * yet). '' for backups and goalies there's nothing on.
 */
export const goalieStartLabel = (start) => {
  if (!start?.starting) return '';
  return Object.values(GOALIE_START_STATUSES).includes(start.status) ? start.status : GOALIE_START_STATUSES.unconfirmed;
};
