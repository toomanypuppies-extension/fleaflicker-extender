<template>
  <div
    class="fleaflicker-extender-drawer"
    :class="{
      expanded: drawerExpanded,
      collapsed: !drawerExpanded,
      lightTheme: !darkMode,
      darkTheme: darkMode,
    }"
    :style="bindCssVars"
  >
    <div class="mainContent">
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
        sport="hockey"
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
    </div>

    <div @click="toggleDrawer" class="expandCollapse">
      <va-icon class="material-icons" :color="teamSecondaryColor" size="large"
        >sports_hockey</va-icon
      >
    </div>
  </div>
</template>

<script>
import {
  TEAM_NAME_TO_ABBR,
  TEAM_ABBR_TO_COLORS,
  TEAM_ABBR_TO_NAME,
} from "./contants";
import { getAllPlayers } from "./api/flea";
import { getGamesThisWeek } from "./api/nhl";
import { getStore, setStore } from "./utils/storage";
import { getLeagueId } from "./utils/util";
import PlayerList from "./components/PlayerList.vue";
import PlayerCard from "./components/PlayerCard.vue";
import Settings from "./components/Settings.vue";
import Filter from "./components/Filter.vue";

export default {
  data() {
    return {
      teamAbbrToName: TEAM_ABBR_TO_NAME,
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
      const result = await getAllPlayers(
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
      const val = getStore(item);
      if (val !== undefined && val !== null) {
        this[item] = val;
      }

      // Setup watcher to store info
      this.$watch(item, (val) => {
        setStore(item, val);
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
      const abbr = TEAM_NAME_TO_ABBR[this.favoriteTeam];
      return TEAM_ABBR_TO_COLORS[abbr].primary;
    },
    teamSecondaryColor() {
      const abbr = TEAM_NAME_TO_ABBR[this.favoriteTeam];
      return TEAM_ABBR_TO_COLORS[abbr].secondary;
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
.fleaflicker-extender-drawer {
  z-index: 100;
  position: fixed;
  bottom: 0;
  transition: all 350ms;
  height: 100vh;
  width: calc(100vw - 100px);
  color: var(--themeAccentColor);
}

.fleaflicker-extender-drawer {
  &.collapsed {
    right: calc(-100vw + 100px);
  }
  &.expanded {
    right: 0;
  }

  /**
  * Fleaflicker overrides
  */
  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    text-shadow: unset !important;
  }
}

.expandCollapse {
  position: absolute;
  left: -48px;
  bottom: 48px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 48px;
  width: 48px;
  box-shadow: -2px 0px 1px 0px rgba(0, 0, 0, 0.25);
  background-color: var(--teamMainColor);
}
.mainContent {
  box-shadow: -2px 0px 1px 0px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  padding: 1em;
  background-color: var(--teamMainColor);
}
.containerColor {
  border: 2px var(--teamSecondaryColor) solid;
  color: var(--themeAccentColor);
  background: var(--themeBaseColor);
}
.v-flex {
  display: flex;
  flex-direction: column;
  justify-content: space-around;
  padding: 0.5em;
  width: 100%;
}
.spacer {
  height: 0.5em;
}
.h-flex {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  padding: 0.5em;
  width: 100%;
}
.align-center {
  align-items: center;
}
.flex-spaceBetween {
  display: flex;
  justify-content: space-between;
}

/*
  * VUESTIC OVERRIDES
  */
.va-select-option-list {
  color: rgb(52, 73, 94);
}

.lightTheme .va-input--bordered.va-input__container,
.darkTheme .va-input--bordered .va-input__container {
  background: unset;
}
.darkTheme .va-input__content__input {
  color: #e2e2e2 !important;
}
.lightTheme .va-input__icons i {
  background: unset !important;
  color: #333333 !important;
}
.darkTheme .va-input__icons i {
  color: #e2e2e2 !important;
  background: unset !important;
}
.darkTheme .va-checkbox__square {
  color: #e2e2e2 !important;
  background: #333333 !important;
  border-color: #e2e2e2;
}
.va-select-option-list__option,
.va-select-option-list__option i {
  color: #333333 !important;
  background: #e2e2e2 !important;
}
</style>