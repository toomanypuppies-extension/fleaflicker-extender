import { nextEasternTime } from "../../utils/util";
import { ACTIVITY_KINDS } from "./activity";

const HOUR = 60 * 60 * 1000;

export const WAIVER_STATUS = {
  owned: 'owned',
  // Can be added right away, first come first served
  free: 'free',
  // Can only be claimed, until `until`
  waivers: 'waivers',
  // Waivers have been processed, but first come first served doesn't open until `until`
  locked: 'locked',
  // The league's waiver settings aren't known
  unknown: 'unknown',
};

export const WAIVER_REASONS = {
  drop: 'drop',
  gameStart: 'gameStart',
};

// Each player's most recent drop, from the activity log
export const latestDrops = (activityItems) => {
  const drops = new Map();
  (activityItems || []).forEach(item => {
    if (item.kind === ACTIVITY_KINDS.drop && item.time > (drops.get(item.playerId) || 0)) {
      drops.set(item.playerId, item.time);
    }
  });
  return drops;
};

/**
 * Whether an unowned player can be added right away or only claimed, and until when.
 * Fleaflicker doesn't say, so it's worked out from the league's waiver settings:
 * - dropped players are on waivers for hoursAfterDrop after the drop
 * - with game-start waivers, free agents go on waivers when their game starts, until claims are
 *   processed at the next gameStartLockTime (Eastern), and can be added first come first served
 *   from the next firstComeFirstServedTime after that
 * @param {Object} player with id, owner and todaysGameStart
 * @param {{ waivers?: Object, drops: Map, now: number }} context waivers from the league settings,
 *   drops from latestDrops
 * @returns {{ status: string, until?: number, reasons?: string[] }}
 */
export const waiverStatus = (player, { waivers, drops, now }) => {
  if (player.owner) {
    return { status: WAIVER_STATUS.owned };
  }
  if (!waivers) {
    return { status: WAIVER_STATUS.unknown };
  }

  let until = 0;
  let lockedUntil = 0;
  const reasons = [];

  const droppedAt = drops?.get(player.id);
  if (droppedAt && waivers.hoursAfterDrop) {
    const clears = droppedAt + waivers.hoursAfterDrop * HOUR;
    if (now < clears) {
      until = clears;
      reasons.push(WAIVER_REASONS.drop);
    }
  }

  const gameStart = player.todaysGameStart;
  if (waivers.gameStartWaivers && waivers.gameStartLockTime && gameStart && gameStart <= now) {
    const processed = nextEasternTime(gameStart, waivers.gameStartLockTime);
    if (now < processed) {
      until = Math.max(until, processed);
      reasons.push(WAIVER_REASONS.gameStart);
    } else if (waivers.firstComeFirstServedTime) {
      const opens = nextEasternTime(processed - 1, waivers.firstComeFirstServedTime);
      if (now < opens) {
        lockedUntil = opens;
      }
    }
  }

  if (until) {
    return { status: WAIVER_STATUS.waivers, until, reasons };
  }
  if (lockedUntil) {
    return { status: WAIVER_STATUS.locked, until: lockedUntil };
  }
  return { status: WAIVER_STATUS.free };
};

const formatWhen = (epoch, now) => {
  const date = new Date(epoch);
  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return date.toDateString() === new Date(now).toDateString()
    ? time
    : `${date.toLocaleDateString([], { weekday: 'short' })} ${time}`;
};

// Short text for the Availability column, empty for owned players or unknown settings
export const availabilityLabel = (availability, now) => {
  switch (availability?.status) {
    case WAIVER_STATUS.free:
      return 'Free agent';
    case WAIVER_STATUS.waivers:
      return `Waivers until ${formatWhen(availability.until, now)}`;
    case WAIVER_STATUS.locked:
      return `Addable ${formatWhen(availability.until, now)}`;
    default:
      return '';
  }
};

// Sorts free agents first, then by when players can be added. Owned players have no value, so sort last.
export const availabilityOrder = (availability) => {
  switch (availability?.status) {
    case WAIVER_STATUS.free:
      return 0;
    case WAIVER_STATUS.waivers:
    case WAIVER_STATUS.locked:
      return availability.until;
    default:
      return undefined;
  }
};
