import { getLeagueId } from "./util";
import { buildKey, KEY_PREFIX, getLocalStorage, setLocalStorage, clearLocalStorage, clearAllLocalStorage } from "./storage";

/**
 * Storage for large per-league data (players, league activity, rosters). IndexedDB has room for far
 * more than localStorage's ~5MB, which a couple of leagues' players already fill.
 *
 * In the extension this is fleaflicker's IndexedDB, the same as localStorage is fleaflicker's
 * localStorage. If IndexedDB can't be opened (some private browsing modes), everything falls back
 * to localStorage, which is what older versions used.
 *
 * Keys are the same as localStorage's, so values stored by older versions are moved over on first read.
 */

const DB_NAME = 'ff-extender';
const STORE = 'kv';

let dbPromise = null;

const openDb = () => {
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      if (!globalThis.indexedDB) {
        resolve(null);
        return;
      }
      try {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => request.result.createObjectStore(STORE);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => {
          console.warn('IndexedDB unavailable, using localStorage', request.error);
          resolve(null);
        };
      } catch (err) {
        console.warn('IndexedDB unavailable, using localStorage', err);
        resolve(null);
      }
    });
  }
  return dbPromise;
};

// Runs fn against the store in one transaction, resolving with fn's request result once it commits
const transact = (db, mode, fn) => new Promise((resolve, reject) => {
  const tx = db.transaction(STORE, mode);
  const request = fn(tx.objectStore(STORE));
  tx.oncomplete = () => resolve(request?.result);
  tx.onerror = () => reject(tx.error);
  tx.onabort = () => reject(tx.error);
});

const isQuotaError = (err) => err?.name === 'QuotaExceededError';

// Vue's reactive proxies can't be structured cloned, plain copies can
const plain = (value) => JSON.parse(JSON.stringify(value));

const putEntries = (db, entries) => transact(db, 'readwrite', (store) => {
  entries.forEach(([key, value]) => store.put(value, key));
});

// Frees room by removing other leagues' data, they're refetched when next visited
const removeOtherLeagues = (db, leagueId) => transact(db, 'readwrite', (store) => {
  const ownPrefix = buildKey('', leagueId);
  const request = store.openCursor();
  request.onsuccess = () => {
    const cursor = request.result;
    if (!cursor) return;
    if (cursor.key.startsWith(KEY_PREFIX) && !cursor.key.startsWith(ownPrefix)) {
      cursor.delete();
    }
    cursor.continue();
  };
});

export const getStored = async (key, leagueId) => {
  const id = leagueId || getLeagueId();
  const db = await openDb();
  if (!db) {
    return getLocalStorage(key, id);
  }

  try {
    const value = await transact(db, 'readonly', store => store.get(buildKey(key, id)));
    if (value !== undefined) {
      return value;
    }
    // Stored by an older version
    const legacy = getLocalStorage(key, id);
    if (legacy !== null && await setStored(key, legacy, id)) {
      clearLocalStorage(key, null, id);
    }
    return legacy;
  } catch (err) {
    console.warn(`Unable to read ${key}`, err);
    return null;
  }
};

/**
 * Stores several values in one transaction, so either all of them are stored or none are.
 * Returns false if they couldn't be stored.
 */
export const setStoredEntries = async (values, leagueId) => {
  const id = leagueId || getLeagueId();
  const db = await openDb();
  if (!db) {
    // Not atomic, but like before IndexedDB: later values are only stored if earlier ones were
    return Object.entries(values).every(([key, value]) => setLocalStorage(key, value, id));
  }

  const entries = Object.entries(values).map(([key, value]) => [buildKey(key, id), value]);
  try {
    await putEntries(db, entries);
    return true;
  } catch (err) {
    try {
      if (err?.name === 'DataCloneError') {
        await putEntries(db, entries.map(([key, value]) => [key, plain(value)]));
        return true;
      }
      if (isQuotaError(err)) {
        await removeOtherLeagues(db, id);
        await putEntries(db, entries);
        return true;
      }
    } catch (retryErr) {
      err = retryErr;
    }
    console.warn(`Unable to store ${Object.keys(values).join(', ')}`, err);
    return false;
  }
};

export const setStored = (key, value, leagueId) => setStoredEntries({ [key]: value }, leagueId);

export const removeStored = async (key, leagueId) => {
  const id = leagueId || getLeagueId();
  clearLocalStorage(key, null, id);
  const db = await openDb();
  if (db) {
    try {
      await transact(db, 'readwrite', store => store.delete(buildKey(key, id)));
    } catch (err) {
      console.warn(`Unable to remove ${key}`, err);
    }
  }
};

// Removes everything this app stored, in IndexedDB and localStorage
export const clearAllStored = async () => {
  clearAllLocalStorage();
  const db = await openDb();
  if (db) {
    try {
      await transact(db, 'readwrite', store => store.clear());
    } catch (err) {
      console.warn('Unable to clear stored data', err);
    }
  }
};

// For tests: forget the open database, so the next call opens it again (or falls back)
export const resetDbConnection = () => {
  dbPromise?.then(db => db?.close());
  dbPromise = null;
};
