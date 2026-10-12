import { getStored, setStored } from "../../utils/db";
import { getActivityToTimeEpochMilli } from "../../utils/flea";

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

// How far back the activity timeline goes
export const TIMELINE_WINDOW = 14 * DAY;
// Items older than this are dropped from storage. Longer than the timeline so add counts can
// cover matchup periods that span more than one week, like around the all-star break.
const RETENTION = 28 * DAY;
// Re-read this far back when checking for new items, in case the proxy served a page that was a few
// minutes old (see TTL_BY_ENDPOINT in the proxy). Items already stored are recognized and skipped.
const OVERLAP = 6 * MINUTE;

export const ACTIVITY_KINDS = {
  add: 'add',
  claim: 'claim',
  drop: 'drop',
  irOn: 'irOn',
  irOff: 'irOff',
  trade: 'trade',
  membership: 'membership',
  other: 'other',
};

const transactionKind = (type) => {
  switch (type) {
    // Fleaflicker leaves out the type for plain adds
    case undefined:
    case 'TRANSACTION_ADD':
      return ACTIVITY_KINDS.add;
    case 'TRANSACTION_CLAIM':
      return ACTIVITY_KINDS.claim;
    case 'TRANSACTION_DROP':
      return ACTIVITY_KINDS.drop;
    default:
      return ACTIVITY_KINDS.other;
  }
};

const itemKind = (item) => {
  if (item.transaction) return transactionKind(item.transaction.type);
  if (item.reserveChange) return item.reserveChange.removed ? ACTIVITY_KINDS.irOff : ACTIVITY_KINDS.irOn;
  if (item.trade) return ACTIVITY_KINDS.trade;
  if (item.membership) return ACTIVITY_KINDS.membership;
  return ACTIVITY_KINDS.other;
};

/**
 * The parts of a league activity item the app uses. Raw items repeat each player's stats and games,
 * which would make a few weeks of activity take more room than the players themselves.
 */
export const convertActivityItem = (item) => {
  const kind = itemKind(item);
  const change = item.transaction || item.reserveChange;
  const leaguePlayer = change?.player;
  const time = parseInt(item.timeEpochMilli, 10);
  const playerId = leaguePlayer?.proPlayer?.id;
  const teamId = change?.team?.id;

  return {
    key: [time, kind, playerId ?? '', teamId ?? ''].join('|'),
    time,
    kind,
    teamId,
    teamName: change?.team?.name,
    playerId,
    playerName: leaguePlayer?.proPlayer?.nameFull,
    playerTeam: leaguePlayer?.proPlayer?.proTeamAbbreviation,
    playerPosition: leaguePlayer?.proPlayer?.position,
    injury: leaguePlayer?.proPlayer?.injury?.typeAbbreviaition,
    // The player's owner when the item was fetched, not when it happened
    owner: leaguePlayer?.owner?.name,
    // Teams that put in a claim for the player, including the winner
    claimTeams: item.transaction?.waiverResolutionTeams?.length,
    bidAmount: item.transaction?.bidAmount,
    tradeId: item.transaction?.tradeId,
    // Trades and commissioner changes don't say which players moved where
    unknownOwnership: !!item.trade || !!item.commishPowers || !!item.transaction?.commishPowers,
  };
};

const emptyLog = () => ({ items: [], coveredFrom: null, fetchedAt: null });

export const getActivityLog = async (leagueId) => (await getStored('hockey_activity', leagueId)) || emptyLog();

/**
 * Brings the stored activity up to date, and makes sure it reaches back to `since`.
 * Returns the stored log ({ items newest first, coveredFrom, fetchedAt }), or null if that would take
 * more than maxPages pages of activity.
 */
export const syncActivity = async (leagueId, { since, maxPages = Infinity, now = Date.now() } = {}) => {
  const log = await getActivityLog(leagueId);
  const reachesBack = log.coveredFrom !== null && log.coveredFrom <= since;

  // Older pages can only be reached by paging through the newer ones first
  const fetchFrom = reachesBack ? Math.max(log.fetchedAt - OVERLAP, since) : since;
  const fetched = await getActivityToTimeEpochMilli('NHL', leagueId, fetchFrom, maxPages);
  if (!fetched) {
    return null;
  }

  const byKey = new Map(log.items.map(item => [item.key, item]));
  // Newer copies win, their owners are more up to date
  fetched.map(convertActivityItem).forEach(item => byKey.set(item.key, item));

  const keepFrom = Math.min(now - RETENTION, since);
  const items = [...byKey.values()]
    .filter(item => item.time > keepFrom)
    .sort((a, b) => b.time - a.time);

  const updated = {
    items,
    coveredFrom: reachesBack ? Math.max(log.coveredFrom, keepFrom) : fetchFrom,
    fetchedAt: now,
  };
  await setStored('hockey_activity', updated, leagueId);
  return updated;
};
