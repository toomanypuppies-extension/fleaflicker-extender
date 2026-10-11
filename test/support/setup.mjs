// Loaded with --import before any test: module resolution plus the browser globals src/ uses
import { register } from 'node:module';

register('./hooks.mjs', import.meta.url);

// In-memory IndexedDB
await import('fake-indexeddb/auto');

/**
 * In-memory localStorage. Like browsers, Object.keys() lists the stored keys and setItem throws
 * QuotaExceededError past the quota (counted in UTF-16 code units).
 */
const createLocalStorage = () => {
  const items = new Map();
  let quota = Infinity;
  const used = () => [...items].reduce((total, [key, value]) => total + key.length + value.length, 0);

  const api = {
    getItem: (key) => (items.has(key) ? items.get(key) : null),
    setItem: (key, value) => {
      const stringValue = String(value);
      const existing = items.has(key) ? key.length + items.get(key).length : 0;
      if (used() - existing + key.length + stringValue.length > quota) {
        const err = new Error('The quota has been exceeded.');
        err.name = 'QuotaExceededError';
        throw err;
      }
      items.set(key, stringValue);
    },
    removeItem: (key) => { items.delete(key); },
    clear: () => items.clear(),
  };

  // Test-only controls, not enumerable so they don't show up as stored keys
  const controls = {
    setQuota: (value) => { quota = value; },
    used,
    reset: () => { items.clear(); quota = Infinity; },
  };

  return new Proxy(api, {
    get: (target, prop) => target[prop] ?? controls[prop],
    ownKeys: () => [...items.keys()],
    getOwnPropertyDescriptor: (target, key) => (
      items.has(key) ? { enumerable: true, configurable: true, value: items.get(key) } : undefined
    ),
  });
};

globalThis.localStorage = createLocalStorage();
globalThis.location = { href: 'https://www.fleaflicker.com/nhl/leagues/100' };
