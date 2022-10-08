<template>
  <Filter
    @update="updateFilterModel"
    @toggleSettings="toggleSettings"
    :themeAccentColor="themeAccentColor"
  />
  <Settings
    :openSettings="openSettings"
    :themeAccentColor="themeAccentColor"
    :themeBaseColor="themeBaseColor"
    @update="updateModel"
    @refreshPlayers="refreshPlayers"
  />

  <PlayerList
    ref="PlayerList"
    sport="nhl"
    :loading="loading"
    :players="players"
    :gamesByTeam="gamesByTeam"
    :onlyFreeAgents="onlyFreeAgents"
    :injurySelections="injurySelections"
    :teamSelections="teamSelections"
    :gameDaysSelections="gameDaysSelections"
    :positionSelections="positionSelections"
    :excludeIfNoPoints="excludeIfNoPoints"
    :filter="filter"
    :teamSecondaryColor="teamSecondaryColor"
    @playerSelected="(player) => selectPlayer(player)"
  />
  <PlayerCard
    :selectedPlayer="selectedPlayer"
    :leagueId="leagueId"
    :teamAbbrToName="teamAbbrToName"
    @fleaflickerNav="toggleDrawer"
    @clearSelectedPlayer="clearSelectedPlayer"
  />
</template>

<script>
import {
  HOCKEY_TEAM_NAME_TO_ABBR,
  HOCKEY_TEAM_ABBR_TO_COLORS,
  HOCKEY_TEAM_ABBR_TO_NAME,
} from "./constants";
import { getAllHockeyPlayers } from "../utils/flea";
import { getGamesThisWeek } from "./api/nhl";
import { getLocalStorage, setLocalStorage } from "../utils/storage";
import { getLeagueId } from "../utils/util";
import PlayerList from "./components/PlayerList.vue";
import PlayerCard from "./components/PlayerCard.vue";
import Settings from "./components/Settings.vue";
import Filter from "./components/Filter.vue";

export default {
  data() {
    return {
      teamAbbrToName: HOCKEY_TEAM_ABBR_TO_NAME,
      leagueId: null,
      loading: true,
      players: [],
      gamesByTeam: {},
      drawerExpanded: false,
      filterBufferTimer: null,
      // filter
      filter: "",
      teamSelections: [],
      injurySelections: [],
      positionSelections: [],
      gameDaysSelections: [],
      onlyFreeAgents: true,
      // settings
      excludeIfNoPoints: true,
      favoriteTeam: "Seattle Kraken",
      darkMode: true,
      openSettings: false,
      // player card
      selectedPlayer: null,
      stateToStore: [
        "filter",
        "drawerExpanded",
        "teamSelections",
        "injurySelections",
        "positionSelections",
        "gameDaysSelections",
        "onlyFreeAgents",
        "excludeIfNoPoints",
        "openSettings",
        "favoriteTeam",
        "darkMode",
        "selectedPlayer",
      ],
    };
  },
  components: {
    PlayerList,
    PlayerCard,
    Settings,
    Filter,
  },
  methods: {
    async loadGames(forceRefresh) {
      this.gamesByTeam = {};
      const result = await getGamesThisWeek(forceRefresh);
      this.gamesByTeam = result;
    },
    async loadPlayers(forceRefresh) {
      this.players = [];
      this.loading = true;
      const result = await getAllHockeyPlayers(
        this.leagueId,
        this.excludeIfNoPoints,
        forceRefresh
      );
      this.players = result;
      this.loading = false;
    },
    debounceFiltering() {
      if (this.filterBufferTimer) {
        clearTimeout(this.filterBufferTimer);
      }

      this.filterBufferTimer = setTimeout(() => {
        this.$refs.PlayerList.setFilteredPlayers();
      }, 500);
    },
    toggleDrawer() {
      this.drawerExpanded = !this.drawerExpanded;
    },
    clearSelectedPlayer() {
      this.selectedPlayer = null;
    },
    selectPlayer(player) {
      if (this.selectedPlayer?.id !== player.id) {
        this.selectedPlayer = player;
      } else {
        this.selectedPlayer = null;
      }
    },
    toggleSettings() {
      this.openSettings = !this.openSettings;
    },
    refreshPlayers() {
      this.loadPlayers(true);
      this.loadGames(true);
    },
    updateModel(key, val) {
      this[key] = val;
    },
    updateFilterModel(key, val) {
      this[key] = val;
      this.debounceFiltering();
    },
  },
  created() {
    this.stateToStore.forEach((item) => {
      // load state from store
      const val = getLocalStorage(item);
      if (val !== undefined && val !== null) {
        this[item] = val;
      }

      // Setup watcher to store info
      this.$watch(item, (val) => {
        setLocalStorage(item, val);
      });
    });
    this.leagueId = getLeagueId();
  },
  mounted() {
    this.loadPlayers();
    this.loadGames();
  },
  computed: {
    bindCssVars() {
      return {
        "--themeAccentColor": this.themeAccentColor,
        "--themeBaseColor": this.themeBaseColor,
        "--teamMainColor": this.teamMainColor,
        "--teamSecondaryColor": this.teamSecondaryColor,
        "--teamSecondaryColor30Opacity": `${this.teamSecondaryColor}30`,
      };
    },
    teamMainColor() {
      const abbr = HOCKEY_TEAM_NAME_TO_ABBR[this.favoriteTeam];
      return HOCKEY_TEAM_ABBR_TO_COLORS[abbr].primary;
    },
    teamSecondaryColor() {
      const abbr = HOCKEY_TEAM_NAME_TO_ABBR[this.favoriteTeam];
      return HOCKEY_TEAM_ABBR_TO_COLORS[abbr].secondary;
    },
    themeBaseColor() {
      return this.darkMode ? "#333333" : "#e2e2e2";
    },
    themeAccentColor() {
      return this.darkMode ? "#e2e2e2" : "#333333";
    },
  },
};
</script>

<style lang="scss">

</style>