import axios from 'axios';

// Fleaflicker allows 90 calls/min, and in the standalone site every user shares the proxy's IP.
// Throttled calls come back as 403s.
const MIN_CALL_SPACING = 300;
const RETRY_DELAYS = [5000, 15000, 30000];
const THROTTLED_STATUSES = [403, 429];

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

let nextCallAt = 0;
// Set when any call gets throttled so queued calls back off too, instead of each
// burning a call on its own 403
let pausedUntil = 0;

const waitForSlot = async () => {
  const now = Date.now();
  const callAt = Math.max(now, nextCallAt, pausedUntil);
  nextCallAt = callAt + MIN_CALL_SPACING;
  if (callAt > now) {
    await sleep(callAt - now);
  }
  // A call ahead of us may have been throttled while we waited
  if (pausedUntil > Date.now()) {
    await waitForSlot();
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
