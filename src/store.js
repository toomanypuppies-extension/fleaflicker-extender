import { createStore } from 'vuex';

export const store = createStore({
  state() {
    return {
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
      },
    }
  },
  mutations: {
    setSport(state, sport) {
      state.sport = sport;
    },
    setLeagueId(state, leagueId) {
      state.leagueId = leagueId;
    },
    toggleDrawer(state) {
      state.drawerExpanded = !state.drawerExpanded;
    }
  }
})