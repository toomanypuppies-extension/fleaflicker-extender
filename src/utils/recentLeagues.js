import { KEY_PREFIX } from "./storage";

// Not per league like other keys
const RECENT_LEAGUES_KEY = `${KEY_PREFIX}recentLeagues`;
const MAX_RECENT_LEAGUES = 10;

/**
 * Leagues opened in this browser, most recent first: [{ id, name, sport, lastVisited }]
 */
export const getRecentLeagues = () => {
  try {
    const leagues = JSON.parse(localStorage.getItem(RECENT_LEAGUES_KEY));
    return Array.isArray(leagues) ? leagues : [];
  } catch (err) {
    return [];
  }
};

export const recordLeagueVisit = ({ id, name, sport = 'nhl' }, now = Date.now()) => {
  if (!id) {
    return;
  }
  const leagueId = String(id);
  const previous = getRecentLeagues().find(league => league.id === leagueId);
  const leagues = [
    // Keep the name from an earlier visit if league info couldn't be loaded this time
    { id: leagueId, name: name || previous?.name, sport, lastVisited: now },
    ...getRecentLeagues().filter(league => league.id !== leagueId),
  ].slice(0, MAX_RECENT_LEAGUES);

  try {
    localStorage.setItem(RECENT_LEAGUES_KEY, JSON.stringify(leagues));
  } catch (err) {
    console.warn('Unable to store recent leagues', err);
  }
};

export const forgetRecentLeague = (id) => {
  const leagues = getRecentLeagues().filter(league => league.id !== String(id));
  try {
    localStorage.setItem(RECENT_LEAGUES_KEY, JSON.stringify(leagues));
  } catch (err) {
    console.warn('Unable to store recent leagues', err);
  }
};
