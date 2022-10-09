import { set, debounce, merge, get } from 'lodash';
import { createStore } from 'vuex';
import { getLocalStorage, setLocalStorage } from "./utils/storage";
import { getColors } from './utils/util';

export const store = createStore({
  state() {
    const defaultState = {
      sport: null,
      leagueId: null,
      drawerExpanded: false,
      loading: true,
      settings: {
        darkMode: true,
      },
      nfl: {
        openSettings: false,
        favoriteTeam: "Seattle Seahawks",
      },
      nhl: {
        openSettings: false,
        favoriteTeam: "Seattle Kraken",
        selectedPlayer: null,
        filter: "",
        teamSelections: [],
        injurySelections: [],
        positionSelections: [],
        gameDaysSelections: [],
        onlyFreeAgents: true,
        excludeIfNoPoints: true,
      },
    };
    return defaultState;
  },
  mutations: {
    toggleDrawer(state) {
      state.drawerExpanded = !state.drawerExpanded;
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
    setFavoriteTeam(state, { sport, team }) {
      state[sport].favoriteTeam = team;
    },
    setKeyValue(state, { key, value }) {
      set(state, key, value)
    },
    toggleKeyValue(state, { key }) {
      set(state, key, !get(state, key))
    },
    loadFromLocalStorage(state) {
      const localStorageState = getLocalStorage('vuex-state', state.leagueId);
      return merge(state, localStorageState)
    }
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