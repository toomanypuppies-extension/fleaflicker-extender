import axios from 'axios';

// Fleaflicker allows 90 calls/min per IP, and in the standalone site every user shares the proxy's IP.
// Throttled calls come back as 403s.
const MIN_CALL_SPACING = 300;
// The extension calls fleaflicker from the user's own IP, so it keeps under the limit itself, leaving
// room for fleaflicker's own pages. The site's calls go through the proxy, which limits them for everyone.
const WINDOW = 60 * 1000;
export const CALLS_PER_WINDOW = process.env.STANDALONE ? Infinity : 75;
const RETRY_DELAYS = [5000, 15000, 30000];
const THROTTLED_STATUSES = [403, 429];

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

let nextCallAt = 0;
// When calls were made in the last WINDOW, oldest first
const recentCalls = [];
// Set when any call gets throttled so queued calls back off too, instead of each
// burning a call on its own 403
let pausedUntil = 0;

const waitForSlot = async () => {
  for (;;) {
    const now = Date.now();
    while (recentCalls.length && recentCalls[0] <= now - WINDOW) {
      recentCalls.shift();
    }
    // A full window frees up when its oldest call leaves it
    const windowOpensAt = recentCalls.length >= CALLS_PER_WINDOW
      ? recentCalls[recentCalls.length - CALLS_PER_WINDOW] + WINDOW
      : now;
    const callAt = Math.max(now, nextCallAt, pausedUntil, windowOpensAt);
    if (callAt <= now) {
      nextCallAt = now + MIN_CALL_SPACING;
      recentCalls.push(now);
      return;
    }
    // Calls waiting together check again when they wake, only one takes each slot
    await sleep(callAt - now);
  }
}

const retryDelay = (error, attempt) => {
  const retryAfter = parseInt(error.response?.headers?.['retry-after'], 10);
  if (retryAfter > 0) {
    return retryAfter * 1000;
  }
  // Jitter so clients throttled together don't all retry together
  return RETRY_DELAYS[attempt] + Math.random() * 1000;
}

// Player loads run one at a time, so a request that never finishes would block every later load.
// The proxy holds queued requests for up to 45s.
export const fleaClient = axios.create({ timeout: 60 * 1000 });

fleaClient.interceptors.request.use(async (config) => {
  await waitForSlot();
  return config;
});

fleaClient.interceptors.response.use(undefined, async (error) => {
  const config = error.config;
  const status = error.response?.status;
  const attempt = config?.retryAttempt || 0;

  if (!config || !THROTTLED_STATUSES.includes(status) || attempt >= RETRY_DELAYS.length) {
    throw error;
  }

  const delay = retryDelay(error, attempt);
  console.warn(`Fleaflicker throttled (${status}), retrying in ${Math.round(delay / 1000)}s`);
  pausedUntil = Math.max(pausedUntil, Date.now() + delay);

  return fleaClient({ ...config, retryAttempt: attempt + 1 });
});
