import { getStored, setStored } from "../../utils/db";
import { getLeagueStandings, getLeagueRules, getLeagueScoreboard, getTeamRoster, getLeagueSettings } from "../../utils/flea";
import { easternDay } from "../../utils/util";
import { ACTIVITY_KINDS } from "./activity";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// Records, waiver order and the current matchup period change at most a few times a day
const LEAGUE_INFO_MAX_AGE = HOUR;
// Roster rules rarely change
const RULES_MAX_AGE = DAY;

// Injuries that let a player go on IR, in this app's leagues
export const IR_ELIGIBLE_INJURIES = ['DTD', 'OUT', 'SUS', 'IR'];

// Moves that count against a team's acquisition limit. Fleaflicker only lists claims that succeeded.
const ACQUISITION_KINDS = [ACTIVITY_KINDS.add, ACTIVITY_KINDS.claim];

export const ROSTER_GROUPS = {
  start: 'START',
  bench: 'BENCH',
  injured: 'INJURED',
  taxi: 'TAXI',
};

const convertStandings = (standings) => ({
  name: standings.league?.name,
  teams: (standings.divisions || []).flatMap(division => division.teams || []).map(team => ({
    id: team.id,
    name: team.name,
    logoUrl: team.logoUrl,
    record: team.recordOverall?.formatted,
    rank: team.recordOverall?.rank,
    waiverPosition: team.waiverPosition,
    owners: (team.owners || []).map(owner => owner.displayName),
  })),
});

const convertRules = (rules) => ({
  // Starters and bench, everyone not on IR or taxi
  maxActive: rules.maxActive,
  maxRosterSize: rules.maxRosterSize,
  irSlots: (rules.rosterPositions || [])
    .filter(position => position.group === ROSTER_GROUPS.injured)
    .reduce((total, position) => total + (position.start || 0), 0),
});

// Matchup periods run from the start of their first day to the start of the next period
const convertScoreboard = (scoreboard) => {
  const periods = (scoreboard.eligibleSchedulePeriods || [])
    .map(period => ({
      ordinal: period.ordinal,
      start: parseInt(period.low.startEpochMilli, 10),
      lastDayStart: parseInt(period.high.startEpochMilli, 10),
    }))
    .sort((a, b) => a.start - b.start)
    .map((period, i, all) => ({ ...period, end: all[i + 1]?.start ?? period.lastDayStart + DAY }));

  return {
    periods,
    currentOrdinal: scoreboard.schedulePeriod?.ordinal,
    // This period's head-to-head matchups
    matchups: (scoreboard.games || []).map(game => ({
      awayId: game.away?.id,
      homeId: game.home?.id,
      awayScore: game.awayScore?.score?.formatted ?? null,
      homeScore: game.homeScore?.score?.formatted ?? null,
      inProgress: !!game.isInProgress,
    })),
  };
};

// A team's current opponent and the score, from the team's side: { opponentId, score, opponentScore, inProgress }
export const currentMatchup = (scoreboard, teamId) => {
  const matchup = scoreboard?.matchups?.find(m => m.awayId === teamId || m.homeId === teamId);
  if (!matchup) return null;
  const home = matchup.homeId === teamId;
  return {
    opponentId: home ? matchup.awayId : matchup.homeId,
    score: home ? matchup.homeScore : matchup.awayScore,
    opponentScore: home ? matchup.awayScore : matchup.homeScore,
    inProgress: matchup.inProgress,
  };
};

// Optional, the proxy route may be unavailable. Undefined keeps what was stored before.
const fetchSettings = async (leagueId) => {
  try {
    const settings = await getLeagueSettings(leagueId);
    return settings && { transactionLimit: settings.transactionLimit, waivers: settings.waivers };
  } catch (err) {
    console.warn('Unable to load league settings', err);
    return undefined;
  }
};

/**
 * Acquisitions allowed per matchup period, or null when there's no limit or it isn't known.
 * Fleaflicker's weekly limit applies to each head-to-head matchup period.
 */
export const acquisitionLimit = (settings) => (
  settings?.transactionLimit?.period === 'week' ? settings.transactionLimit.limit : null
);

export const currentPeriod = (scoreboard, now) => (
  scoreboard?.periods.find(period => period.start <= now && now < period.end) ||
  scoreboard?.periods.find(period => period.ordinal === scoreboard.currentOrdinal)
);

/**
 * The league's name, teams, roster rules, matchup periods, and settings from the rules page
 * (transaction limit and waiver timing, missing if they couldn't be loaded).
 * Returns what's stored when fleaflicker can't be reached, with error set.
 */
export const loadLeagueInfo = async (leagueId, { now = Date.now(), forceRefresh = false } = {}) => {
  const stored = await getStored('hockey_league', leagueId);
  const stale = (fetchedAt, maxAge) => (
    forceRefresh || !fetchedAt || now - fetchedAt >= maxAge || easternDay(fetchedAt) !== easternDay(now)
  );

  const infoStale = stale(stored?.fetchedAt, LEAGUE_INFO_MAX_AGE);
  const rulesStale = stale(stored?.rulesFetchedAt, RULES_MAX_AGE);
  // Settings that couldn't be loaded are tried again sooner
  const settingsStale = stored?.settings
    ? stale(stored.settingsFetchedAt, RULES_MAX_AGE)
    : stale(stored?.settingsTriedAt, LEAGUE_INFO_MAX_AGE);
  if (stored && !infoStale && !rulesStale && !settingsStale) {
    return stored;
  }

  try {
    const [standings, scoreboard, rules, settings] = await Promise.all([
      infoStale ? getLeagueStandings(leagueId) : null,
      infoStale ? getLeagueScoreboard(leagueId) : null,
      rulesStale ? getLeagueRules(leagueId) : null,
      settingsStale ? fetchSettings(leagueId) : undefined,
    ]);
    if ((infoStale && (!standings || !scoreboard)) || (rulesStale && !rules)) {
      throw new Error('Failed to fetch league info');
    }

    const info = {
      ...stored,
      ...(infoStale && {
        ...convertStandings(standings),
        scoreboard: convertScoreboard(scoreboard),
        fetchedAt: now,
      }),
      ...(rulesStale && { rules: convertRules(rules), rulesFetchedAt: now }),
      ...(settingsStale && { settingsTriedAt: now }),
      ...(settings && { settings, settingsFetchedAt: now }),
    };
    await setStored('hockey_league', info, leagueId);
    return info;
  } catch (err) {
    console.error(err);
    return stored ? { ...stored, error: true } : null;
  }
};

const convertRoster = (roster) => (roster.groups || []).map(group => ({
  // Fleaflicker leaves out the bench's group
  group: group.group || ROSTER_GROUPS.bench,
  slots: (group.slots || []).map(slot => {
    const proPlayer = slot.leaguePlayer?.proPlayer;
    return {
      label: slot.position?.label,
      player: proPlayer && {
        id: proPlayer.id,
        name: proPlayer.nameFull,
        team: proPlayer.proTeamAbbreviation,
        position: proPlayer.position,
        injury: proPlayer.injury?.typeAbbreviaition,
      },
    };
  }),
}));

const newestActivityFor = (teamId, activityItems) => Math.max(
  0,
  ...activityItems.filter(item => item.teamId === teamId).map(item => item.time)
);

/**
 * Every team's roster, keyed by team id. A team's stored roster is used until the activity log
 * shows a move by that team, or a new day starts (injuries change without any activity).
 */
export const loadTeamRosters = async (leagueId, teamIds, activityItems, { now = Date.now() } = {}) => {
  const stored = (await getStored('hockey_rosters', leagueId)) || {};
  const rosters = { ...stored };

  const outdated = teamIds.filter(teamId => {
    const roster = stored[teamId];
    return !roster ||
      easternDay(roster.fetchedAt) !== easternDay(now) ||
      newestActivityFor(teamId, activityItems) > roster.activitySeen;
  });

  if (outdated.length === 0) {
    return rosters;
  }

  // One at a time, fleaClient spaces out the calls anyway
  for (const teamId of outdated) {
    try {
      const roster = await getTeamRoster(leagueId, teamId);
      if (roster) {
        rosters[teamId] = {
          groups: convertRoster(roster),
          fetchedAt: now,
          activitySeen: newestActivityFor(teamId, activityItems),
        };
      }
    } catch (err) {
      // Keep the older roster, if there is one
      console.error(err);
    }
  }

  await setStored('hockey_rosters', rosters, leagueId);
  return rosters;
};

export const countAcquisitions = (activityItems, teamId, period) => {
  if (!period) {
    return 0;
  }
  return activityItems.filter(item => (
    item.teamId === teamId &&
    ACQUISITION_KINDS.includes(item.kind) &&
    item.time >= period.start &&
    item.time < period.end
  )).length;
};

/**
 * What a team can still do: acquisitions left this matchup period, open roster and IR spots,
 * and injured players who could go on IR but haven't.
 * @param {number|null} acquisitionLimit per matchup period, null when unknown or unlimited
 */
export const summarizeTeam = ({ team, roster, rules, period, activityItems, acquisitionLimit = null }) => {
  const groupPlayers = (name) => (roster?.groups || [])
    .filter(group => group.group === name)
    .flatMap(group => group.slots.map(slot => slot.player).filter(Boolean));

  const active = [...groupPlayers(ROSTER_GROUPS.start), ...groupPlayers(ROSTER_GROUPS.bench)];
  const injuredReserve = groupPlayers(ROSTER_GROUPS.injured);
  const acquisitions = countAcquisitions(activityItems, team.id, period);

  return {
    teamId: team.id,
    name: team.name,
    acquisitions,
    acquisitionLimit,
    acquisitionsLeft: acquisitionLimit === null ? null : Math.max(acquisitionLimit - acquisitions, 0),
    activeCount: active.length,
    maxActive: rules?.maxActive,
    // Negative when the team is over the limit
    openActiveSpots: rules?.maxActive === undefined || !roster ? null : rules.maxActive - active.length,
    irCount: injuredReserve.length,
    irSlots: rules?.irSlots,
    openIrSpots: rules?.irSlots === undefined || !roster ? null : Math.max(rules.irSlots - injuredReserve.length, 0),
    irEligible: active.filter(player => IR_ELIGIBLE_INJURIES.includes(player.injury)),
    hasRoster: !!roster,
  };
};
