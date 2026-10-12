import lodash from 'lodash';
import { createStore } from 'vuex';
import { getLocalStorage, setLocalStorage } from "./utils/storage";
import { getColors, getLeagueId } from './utils/util';
import { teamSeriesColors } from './hockey/chartColors';

// lodash is CommonJS, which node (tests) can't import names from
const { set, debounce, merge, get, cloneDeep } = lodash;

const initState = {
  sport: 'nhl',
  leagueId: null,
  drawerExpanded: false,
  loading: true,
  settings: {
    darkMode: true,
  },
  // players, schedule or league
  activeTab: 'players',
  openSettings: false,
  openHelp: false,
  favoriteTeam: "Seattle Kraken",
  excludeIfNoPoints: true,
  selectedPlayer: null,
  filter: "",
  teamSelections: [],
  injurySelections: [],
  positionSelections: [],
  gameDaysSelections: [],
  // all or any, see GAME_DAYS_MODES
  gameDaysMode: 'all',
  // [{ key, min, max }]
  statFilters: [],
  // Columns picked in the column chooser, empty for the defaults
  visibleColumnKeys: [],
  // The user's team in this league, picked on the League tab or found on fleaflicker's page
  myTeamId: null,
  // League tab timeline: a team id or null for every team, and TIMELINE_FILTERS keys
  timelineTeamId: null,
  timelineFilters: [],
  // League tab section: matchups or activity
  leagueSection: 'matchups',
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
  ownership: "",
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
  if (!!getLeagueId()) {
    const localstoreState = getLocalStorage('vuex-state', getLeagueId());
    if (localstoreState) {
      initialState = merge(initialState, localstoreState);
    }
  }
  const defaultState = JSON.parse(JSON.stringify(initialState));
  // Saved by older versions
  Object.assign(defaultState, TRANSIENT_DEFAULTS);

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
      state.injurySelections = [];
      state.positionSelections = [];
      state.gameDaysSelections = [];
      state.gameDaysMode = 'all';
      state.statFilters = [];
      state.ownership = "";
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
      return getColors(state)?.primary;
    },
    teamSecondaryColor(state) {
      return getColors(state)?.secondary;
    },
    // Two chart series colors from the favorite team's, adjusted to be readable in the theme
    chartColors(state) {
      return teamSeriesColors(getColors(state), state.settings.darkMode ? 'dark' : 'light');
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