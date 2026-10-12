import lodash from 'lodash';
import { createStore } from 'vuex';
import { getLocalStorage, setLocalStorage } from "./utils/storage";
import { getColors, getLeagueId } from './utils/util';
import { teamSeriesColors, textColorOn, FALLBACK_COLORS } from './hockey/chartColors';

// The app's own colors, when the favorite team's aren't wanted
export const DEFAULT_THEME_COLORS = { primary: '#17202b', secondary: '#58a6ff' };
const themeColors = (state) => (state.settings.colorTheme === 'default' ? DEFAULT_THEME_COLORS : getColors(state));

// lodash is CommonJS, which node (tests) can't import names from
const { set, debounce, mergeWith, get, cloneDeep } = lodash;

// Saved state over the defaults. Saved lists replace the default ones whole: merged item by item, an
// empty saved list would keep a default like ['HEALTHY'].
const merge = (target, source) => mergeWith(target, source, (_, value) => (Array.isArray(value) ? value : undefined));

// What the Players tab's filters start as, and go back to with Clear filters
export const FILTER_DEFAULTS = { ownership: 'Free Agent', injurySelections: ['HEALTHY'] };
// Bumped when FILTER_DEFAULTS change, so saved filters from before get them once
const FILTER_DEFAULTS_VERSION = 1;

const initState = {
  sport: 'nhl',
  leagueId: null,
  drawerExpanded: false,
  loading: true,
  settings: {
    darkMode: true,
    // 'team' for the favorite team's colors, 'default' for the app's own (DEFAULT_THEME_COLORS)
    colorTheme: 'team',
  },
  // A TABS key
  activeTab: 'players',
  openSettings: false,
  openHelp: false,
  favoriteTeam: "Seattle Kraken",
  excludeIfNoPoints: true,
  selectedPlayer: null,
  filter: "",
  teamSelections: [],
  injurySelections: [...FILTER_DEFAULTS.injurySelections],
  positionSelections: [],
  gameDaysSelections: [],
  // all or any, see GAME_DAYS_MODES
  gameDaysMode: 'all',
  // [{ key, min, max }]
  statFilters: [],
  // Lineup spots picked in the matchup's planner, players must fit all of them:
  // [{ date: 'YYYY-MM-DD', label: 'C', eligibility: ['C'] }]
  spotFilters: [],
  // Daily Faceoff statuses of today's starting goalies to show (Confirmed, Likely, Unconfirmed), empty for anyone
  goalieStartSelections: [],
  // Columns picked in the column chooser, empty for the defaults
  visibleColumnKeys: [],
  // The user's team in this league, picked in the toolbar or found on fleaflicker's page
  myTeamId: null,
  // League tab timeline: a team id or null for every team, and TIMELINE_FILTERS keys
  timelineTeamId: null,
  timelineFilters: [],
  // The team page open on the League tab, or null
  openTeamId: null,
  // The team page's COMPARE_RANGES key
  teamRange: 'matchup',
  // The matchup period (week) shown, null for the current one
  selectedPeriod: null,
  // The matchup open on the League tab (its box score game id), or null for the list
  openMatchupId: null,
  // PROJECTION_METHODS and PROJECTION_LINEUPS keys
  projectionMethod: 'mix',
  projectionLineup: 'best',
  // Teams compared in the open matchup, empty for the matchup's two teams, and a COMPARE_RANGES key
  compareTeamIds: [],
  compareRange: 'matchup',
  owners: [],
  ownership: FILTER_DEFAULTS.ownership,
  filterDefaultsVersion: FILTER_DEFAULTS_VERSION,
  gamesByMatchup: null,
  weekStartDates: null,
}

// Open dialogs and the open player card aren't saved, so a reload doesn't reopen them.
// A picked week isn't either, so the League tab opens on the current one.
const TRANSIENT_DEFAULTS = { openSettings: false, openHelp: false, selectedPlayer: null, selectedPeriod: null };
const TRANSIENT_KEYS = Object.keys(TRANSIENT_DEFAULTS);

// The state for the league in the URL: its saved state over the defaults
const createState = () => {
  // A copy, so one league's saved state doesn't become the next league's defaults
  let initialState = cloneDeep(initState);
  // Nothing saved has the current defaults already
  let savedDefaultsVersion = FILTER_DEFAULTS_VERSION;
  if (!!getLeagueId()) {
    const localstoreState = getLocalStorage('vuex-state', getLeagueId());
    if (localstoreState) {
      initialState = merge(initialState, localstoreState);
      savedDefaultsVersion = localstoreState.filterDefaultsVersion || 0;
    }
  }
  const defaultState = JSON.parse(JSON.stringify(initialState));
  // Saved by older versions
  Object.assign(defaultState, TRANSIENT_DEFAULTS);

  // Earlier versions had a League tab with matchups and rosters (or activity) as sections
  if (defaultState.activeTab === 'league') {
    defaultState.activeTab = defaultState.leagueSection === 'matchups' ? 'matchups' : 'rosters';
  }
  delete defaultState.leagueSection;

  // Saved before the filters had defaults: start them from the defaults once, after that what the
  // user picks stays, an empty Injury (any) included
  if (savedDefaultsVersion < FILTER_DEFAULTS_VERSION) {
    Object.assign(defaultState, cloneDeep(FILTER_DEFAULTS), { filterDefaultsVersion: FILTER_DEFAULTS_VERSION });
  }

  // Team renamed in 2025
  const renameTeam = (team) => team === 'Utah Hockey Club' ? 'Utah Mammoth' : team;
  defaultState.favoriteTeam = renameTeam(defaultState.favoriteTeam);
  defaultState.teamSelections = defaultState.teamSelections.map(renameTeam);

  return defaultState;
}

export const store = createStore({
  state() {
    return createState();
  },
  mutations: {
    clearFilters(state) {
      state.filter = "";
      state.teamSelections = [];
      state.injurySelections = [...FILTER_DEFAULTS.injurySelections];
      state.positionSelections = [];
      state.gameDaysSelections = [];
      state.gameDaysMode = 'all';
      state.statFilters = [];
      state.spotFilters = [];
      state.goalieStartSelections = [];
      state.ownership = FILTER_DEFAULTS.ownership;
    },
    loadFromLocalStorage(state) {
      const localStorageState = getLocalStorage('vuex-state', state.leagueId);
      return merge(state, localStorageState)
    },
    resetStore(state) {
      merge(state, createState());
    },
    // On the standalone site, opening a league from the home page doesn't reload the page
    loadLeagueState(state) {
      Object.assign(state, createState(), { leagueId: getLeagueId() });
    },
    setSport(state, payload) {
      state.sport = payload;
    },
    setLeagueId(state, payload) {
      state.leagueId = payload;
    },
    setDarkMode(state, payload) {
      state.settings.darkMode = payload;
    },
    setFavoriteTeam(state, payload) {
      state.favoriteTeam = payload;
    },
    setKeyValue(state, { key, value }) {
      set(state, key, value)
    },
    toggleDrawer(state) {
      state.drawerExpanded = !state.drawerExpanded;
      // We set this immediately since it happens on nav. Otherwise the debounce would prevent the set
      saveState(state);
    },
    toggleKeyValue(state, { key }) {
      set(state, key, !get(state, key))
    },
  },
  getters: {
    themeBaseColor(state) {
      return state.settings.darkMode ? "#333333" : "#e2e2e2";
    },
    themeAccentColor(state) {
      return state.settings.darkMode ? "#e2e2e2" : "#333333";
    },
    teamMainColor(state) {
      return themeColors(state)?.primary;
    },
    teamSecondaryColor(state) {
      return themeColors(state)?.secondary;
    },
    // Two chart series colors from the favorite team's, adjusted to be readable in the theme
    chartColors(state) {
      const mode = state.settings.darkMode ? 'dark' : 'light';
      return state.settings.colorTheme === 'default' ? FALLBACK_COLORS[mode] : teamSeriesColors(getColors(state), mode);
    },
    // Your opponent's badge and border: their color in your matchup's charts, where you're first
    opponentColors(state, getters) {
      const background = getters.chartColors[1];
      return { background, text: textColorOn(background) };
    }
  }
})

const saveState = (state) => {
  const saved = { ...state };
  TRANSIENT_KEYS.forEach(key => delete saved[key]);
  setLocalStorage('vuex-state', saved, state.leagueId);
};

const localStoreSubscriber = debounce((mutation, state) => saveState(state), 250);

store.subscribe(localStoreSubscriber)