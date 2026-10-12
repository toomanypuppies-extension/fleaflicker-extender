import { ACTIVITY_KINDS } from "./activity";
import { easternDate } from "./schedule";

const MINUTE = 60 * 1000;
// An add and a drop by the same team this close together were one roster move
const SWAP_WINDOW = 2 * MINUTE;

export const TIMELINE_KINDS = {
  swap: 'swap',
  ...ACTIVITY_KINDS,
};

// The filters the timeline offers, and the kinds of rows each shows
export const TIMELINE_FILTERS = {
  adds: { label: 'Adds', kinds: [TIMELINE_KINDS.add, TIMELINE_KINDS.claim, TIMELINE_KINDS.swap] },
  drops: { label: 'Drops', kinds: [TIMELINE_KINDS.drop, TIMELINE_KINDS.swap] },
  ir: { label: 'IR', kinds: [TIMELINE_KINDS.irOn, TIMELINE_KINDS.irOff] },
  trades: { label: 'Trades', kinds: [TIMELINE_KINDS.trade] },
};

const ADDS = [ACTIVITY_KINDS.add, ACTIVITY_KINDS.claim];

/**
 * Pairs each add with the same team's drop made at about the same time into one swap row:
 * { kind: 'swap', time, teamId, teamName, added: item, dropped: item }. Other items are left as they are.
 * @param {Array} items activity items, newest first
 */
export const pairSwaps = (items) => {
  const paired = new Set();
  const rows = [];
  items.forEach(item => {
    if (paired.has(item)) return;
    if (ADDS.includes(item.kind) || item.kind === ACTIVITY_KINDS.drop) {
      const partnerKinds = item.kind === ACTIVITY_KINDS.drop ? ADDS : [ACTIVITY_KINDS.drop];
      const partner = items.find(other => (
        !paired.has(other) &&
        other !== item &&
        other.teamId === item.teamId &&
        partnerKinds.includes(other.kind) &&
        Math.abs(other.time - item.time) <= SWAP_WINDOW
      ));
      if (partner) {
        paired.add(item);
        paired.add(partner);
        const [added, dropped] = item.kind === ACTIVITY_KINDS.drop ? [partner, item] : [item, partner];
        rows.push({
          kind: TIMELINE_KINDS.swap,
          key: `swap|${added.key}|${dropped.key}`,
          time: Math.max(added.time, dropped.time),
          teamId: item.teamId,
          teamName: item.teamName,
          added,
          dropped,
        });
        return;
      }
    }
    rows.push(item);
  });
  return rows;
};

/**
 * The activity timeline: activity since `since`, newest first, grouped by Eastern day.
 * @param {Array} items activity log items, newest first
 * @param {{ since: number, teamId?: number, filters?: string[], period?: { start: number } }} options
 *   filters are TIMELINE_FILTERS keys, none for every kind
 * @returns {Array<{ date: string, rows: Array }>} rows have inPeriod set when they're in the current matchup period
 */
export const buildTimeline = (items, { since, teamId = null, filters = [], period = null }) => {
  const kinds = filters.length ? new Set(filters.flatMap(filter => TIMELINE_FILTERS[filter]?.kinds || [])) : null;

  const rows = pairSwaps((items || []).filter(item => item.time >= since))
    .filter(row => teamId === null || row.teamId === teamId)
    .filter(row => !kinds || kinds.has(row.kind))
    .map(row => ({ ...row, inPeriod: !!period && row.time >= period.start }));

  const days = [];
  rows.forEach(row => {
    const date = easternDate(row.time);
    if (days[days.length - 1]?.date !== date) {
      days.push({ date, rows: [] });
    }
    days[days.length - 1].rows.push(row);
  });
  return days;
};
