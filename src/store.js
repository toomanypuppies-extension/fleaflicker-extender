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
  openSettings: false,
  favoriteTeam: "Seattle Kraken",
  excludeIfNoPoints: true,
  selectedPlayer: null,
  filter: "",
  teamSelections: [],
  injurySelections: [],
  positionSelections: [],
  gameDaysSelections: [],
  onlyFreeAgents: true,
}

const createState = () => {
  const defaultState = JSON.parse(JSON.stringify(initState));
  defaultState.leagueId = getLeagueId();
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
      state.onlyFreeAgents = true;
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

const localStoreSubscriber = debounce((mutation, state) => {
  setLocalStorage('vuex-state', state, state.leagueId);
}, 250);

store.subscribe(localStoreSubscriber)