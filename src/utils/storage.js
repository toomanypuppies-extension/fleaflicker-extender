import { getLeagueId } from "./util";

const KEY_PREFIX = 'ff-extender-';
// Stored per league and by far the largest thing we store (~0.5-1MB each)
const PLAYERS_KEY = 'hockey_players';
const PLAYERS_META_KEY = 'hockey_playersMeta';

const buildKey = (key, leagueId) => `${KEY_PREFIX}${leagueId || getLeagueId()}-${key}`;

const isQuotaError = (err) => err?.name === 'QuotaExceededError' || err?.name === 'NS_ERROR_DOM_QUOTA_REACHED';

// Removes other leagues' stored players, least recently fetched first, until there's room.
// Returns false once there's nothing left to remove.
const freeSpaceFor = (write, currentLeagueId) => {
  const currentPlayersKey = buildKey(PLAYERS_KEY, currentLeagueId);
  const otherLeagues = Object.keys(localStorage)
    .filter(key => key.startsWith(KEY_PREFIX) && key.endsWith(`-${PLAYERS_KEY}`) && key !== currentPlayersKey)
    .map(playersKey => {
      const metaKey = playersKey.replace(new RegExp(`${PLAYERS_KEY}$`), PLAYERS_META_KEY);
      let fetchedAt = 0;
      try {
        fetchedAt = JSON.parse(localStorage.getItem(metaKey))?.statsEpoch || 0;
      } catch (err) {
        // Treat unreadable metadata as oldest
      }
      return { playersKey, metaKey, fetchedAt };
    })
    .sort((a, b) => a.fetchedAt - b.fetchedAt);

  for (const { playersKey, metaKey } of otherLeagues) {
    localStorage.removeItem(playersKey);
    localStorage.removeItem(metaKey);
    try {
      write();
      return true;
    } catch (err) {
      if (!isQuotaError(err)) throw err;
    }
  }
  return false;
}

// Returns false if the payload couldn't be stored
export const setLocalStorage = (key, payload, leagueId) => {
  const id = leagueId || getLeagueId()
  const stringified = JSON.stringify(payload);
  const write = () => localStorage.setItem(buildKey(key, id), stringified);
  try {
    write();
    return true;
  } catch (err) {
    try {
      if (isQuotaError(err) && freeSpaceFor(write, id)) {
        return true;
      }
    } catch (freeSpaceErr) {
      console.warn('Unable to free up storage', freeSpaceErr);
    }
    console.warn(`Unable to store ${key}`, err);
    return false;
  }
}

export const getLocalStorage = (key, leagueId) => {
  const id = leagueId || getLeagueId()
  const stringified = localStorage.getItem(buildKey(key, id));
  return JSON.parse(stringified);
}

export const clearLocalStorage = (key, payload, leagueId) => {
  const id = leagueId || getLeagueId()
  localStorage.removeItem(buildKey(key, id));
}

// Only removes our keys. In the extension, localStorage is shared with fleaflicker's own site.
export const clearAllLocalStorage = () => {
  Object.keys(localStorage)
    .filter(key => key.startsWith(KEY_PREFIX))
    .forEach(key => localStorage.removeItem(key));
}
