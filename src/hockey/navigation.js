import { TABS } from "./constants";

/**
 * Which page of the app is showing, kept in browser history so Back and Forward move between pages:
 * the tab, the week picked, and the matchup or team page open. On the standalone site it's the URL's
 * query, like ?tab=matchups&week=3&matchup=3603041.
 */

const NAV_KEYS = ['tab', 'week', 'matchup', 'team'];
// Tabs where a week is picked, and where a team page can be open
const WEEK_TABS = ['matchups', 'schedule'];
const TEAM_TABS = ['matchups', 'rosters'];

const id = (value) => {
  const number = parseInt(value, 10);
  return Number.isNaN(number) ? null : number;
};

/**
 * The page from the store's state, as strings for a URL query: { tab, week?, matchup?, team? }.
 * Only what the tab shows, a matchup left open on another tab isn't part of the page.
 */
export const navFromState = (state) => {
  const nav = { tab: state.activeTab };
  if (WEEK_TABS.includes(state.activeTab) && state.selectedPeriod !== null && state.selectedPeriod !== undefined) {
    nav.week = String(state.selectedPeriod);
  }
  if (state.activeTab === 'matchups' && state.openMatchupId) {
    nav.matchup = String(state.openMatchupId);
  }
  if (TEAM_TABS.includes(state.activeTab) && state.openTeamId) {
    nav.team = String(state.openTeamId);
  }
  return nav;
};

/**
 * The store keys for a page from a URL query or history entry, or null when it has no tab the app
 * knows. Links from before matchups and rosters had their own tabs open matchups.
 */
export const stateFromNav = (nav) => {
  const tab = nav?.tab === 'league' ? 'matchups' : nav?.tab;
  if (!TABS.some(candidate => candidate.key === tab)) {
    return null;
  }
  return {
    activeTab: tab,
    selectedPeriod: WEEK_TABS.includes(tab) ? id(nav.week) : null,
    // Fleaflicker's matchup ids are strings, team ids numbers
    openMatchupId: tab === 'matchups' && nav.matchup ? String(nav.matchup) : null,
    openTeamId: TEAM_TABS.includes(tab) ? id(nav.team) : null,
  };
};

export const sameNav = (a, b) => NAV_KEYS.every(key => (a?.[key] ?? null) === (b?.[key] ?? null));

// A URL query with the page's keys replaced, other keys kept
export const queryWithNav = (query, nav) => {
  const rest = Object.fromEntries(Object.entries(query || {}).filter(([key]) => !NAV_KEYS.includes(key)));
  return { ...rest, ...nav };
};

// Whether a URL query says which page to show
export const queryHasNav = (query) => NAV_KEYS.some(key => query?.[key] !== undefined);
