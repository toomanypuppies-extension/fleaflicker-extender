import { set, debounce, merge, get } from 'lodash';
import { createStore } from 'vuex';
import { getLocalStorage, setLocalStorage } from "./utils/storage";
import { getColors, getLeagueId } from './utils/util';

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
  owners: [],
  ownership: "",
  gamesByMatchup: null,
  weekStartDates: null,
}

// Open dialogs aren't saved, so a reload doesn't reopen them
const TRANSIENT_KEYS = ['openSettings', 'openHelp'];

const createState = () => {
  let initialState = initState;
  if (!!getLeagueId()) {
    const localstoreState = getLocalStorage('vuex-state', getLeagueId());
    if (localstoreState) {
      initialState = merge(initState, localstoreState);
    }
  }
  const defaultState = JSON.parse(JSON.stringify(initialState));
  // Saved by older versions
  TRANSIENT_KEYS.forEach(key => { defaultState[key] = false; });

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