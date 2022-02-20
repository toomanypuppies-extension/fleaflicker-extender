<template>
  <div
    class="drawer"
    :class="{
      expanded: drawerExpanded,
      collapsed: !drawerExpanded,
      lightTheme: !darkMode,
      darkTheme: darkMode,
    }"
    :style="themeColorStyle"
  >
    <div class="mainContent" :style="teamBackgroundColorStyle">
      <div class="formContainer" :style="containerStyles">
        <div class="v-flex">
          <va-input
            v-model="filter"
            label="Search"
            placeholder="Johnny Hockey"
            bordered
            :color="themeAccentColor"
          />
          <span class="spacer"></span>
          <va-select
            label="Injury"
            :options="injuryOptions"
            v-model="injurySelections"
            placeholder="OUT"
            maxHeight="300px"
            multiple
            :color="themeAccentColor"
            bordered
          />
        </div>
        <div class="v-flex">
          <va-select
            label="Teams"
            :options="teamOptions"
            v-model="teamSelections"
            placeholder="Seattle Kraken"
            maxHeight="300px"
            multiple
            :color="themeAccentColor"
            bordered
          />
          <span class="spacer"></span>

          <va-select
            label="Position"
            :options="positionOptions"
            v-model="positionSelections"
            placeholder="F"
            maxHeight="300px"
            multiple
            :color="themeAccentColor"
            bordered
          />
        </div>
        <div class="h-flex">
          <div class="v-flex">
            <va-checkbox
              v-model="mustHaveGameToday"
              label="Has Game Today"
              :color="themeAccentColor"
            />
            <span class="spacer"></span>

            <va-checkbox
              v-model="onlyFreeAgents"
              label="Only Free Agents"
              :color="themeAccentColor"
            />
          </div>
          <div class="settings">
            <va-icon
              @click="toggleSettings"
              class="material-icons"
              :color="themeAccentColor"
              size="medium"
              >settings</va-icon
            >
          </div>
        </div>
      </div>
      <div v-if="settings" class="settingsContainer" :style="containerStyles">
        <div class="v-flex">
          <va-select
            label="Favorite Team"
            :options="teamOptions"
            v-model="favoriteTeam"
            placeholder="Seattle Kraken"
            maxHeight="300px"
            bordered
            :color="themeAccentColor"
          />
          <span class="spacer"></span>

          <va-button
            :rounded="false"
            bordered
            class="refreshButton"
            @click="refreshPlayers"
            :color="themeAccentColor"
            :text-color="themeBaseColor"
            >Refresh Players</va-button
          >
        </div>
        <div class="v-flex">
          <va-checkbox
            v-model="darkMode"
            :color="themeAccentColor"
            label="Dark Mode"
          ></va-checkbox>
          <span class="spacer"></span>

          <va-checkbox
            v-model="excludeIfNoPoints"
            :color="themeAccentColor"
            label="Only list players that have points this year"
          >
          </va-checkbox>
        </div>
      </div>
      <div class="tableContainer" :style="containerStyles">
        <va-data-table
          :items="filteredPlayers"
          :columns="filteredColumns"
          :selected-color="teamSecondaryColor"
          :loading-color="teamSecondaryColor"
          hoverable
          clickable
          :loading="loading"
          @row:click="selectPlayer"
        />
      </div>
      <div
        v-if="selectedPlayer"
        class="playerContainer"
        :style="containerStyles"
      >
        <va-icon
          @click="closePlayer"
          class="material-icons playerClose"
          color="rgb(28, 36, 44)"
          size="medium"
          >close</va-icon
        >
        <h3>{{ selectedPlayer.name }}</h3>
        <img :src="selectedPlayer.expandedData.image" alt="" />

        {{ selectedPlayer }}
      </div>
    </div>
    <div
      @click="toggleDrawer"
      class="expandCollapse"
      :style="teamBackgroundColorStyle"
    >
      <va-icon class="material-icons" :color="teamSecondaryColor" size="large"
        >sports_hockey</va-icon
      >
    </div>
  </div>
</template>

<script>
import {
  INJURY_LIST,
  POSITION_OPTIONS,
  TEAM_LIST,
  TEAM_NAME_TO_ABBR,
  TEAM_ABBR_TO_COLORS,
} from "./contants";
import { getAllPlayers } from "./utils/flea";
import { getStore, setStore } from "./utils/storage";
import { getLeagueId } from "./utils/util";

export default {
  data() {
    return {
      filter: "",
      players: [],
      loading: true,
      teamOptions: TEAM_LIST,
      teamSelections: [],
      injuryOptions: INJURY_LIST,
      injurySelections: [],
      positionOptions: POSITION_OPTIONS,
      positionSelections: [],
      drawerExpanded: true,
      mustHaveGameToday: false,
      onlyFreeAgents: true,
      excludeIfNoPoints: true,
      settings: false,
      favoriteTeam: "Seattle Kraken",
      darkMode: true,
      columns: [
        {
          key: "name",
          sortable: true,
          headerStyle: this.headerStyles,
          style: this.rowStyles,
        },
        {
          key: "team",
          sortable: true,
          headerStyle: this.headerStyles,
          style: this.rowStyles,
        },
        {
          key: "owner",
          sortable: true,
          headerStyle: this.headerStyles,
          style: this.rowStyles,
        },
        {
          key: "todaysGame",
          sortable: true,
          headerStyle: this.headerStyles,
          style: this.rowStyles,
        },
        {
          key: "gamesThisWeek",
          sortable: true,
          headerStyle: this.headerStyles,
          style: this.rowStyles,
        },
        {
          key: "position",
          sortable: true,
          headerStyle: this.headerStyles,
          style: this.rowStyles,
        },
        {
          key: "injury",
          sortable: true,
          headerStyle: this.headerStyles,
          style: this.rowStyles,
        },
        {
          key: "points",
          sortable: true,
          headerStyle: this.headerStyles,
          style: this.rowStyles,
          sortingFn: this.numSortFn,
        },
        {
          key: "avg",
          sortable: true,
          headerStyle: this.headerStyles,
          style: this.rowStyles,
          sortingFn: this.numSortFn,
        },
        {
          key: "last1",
          sortable: true,
          headerStyle: this.headerStyles,
          style: this.rowStyles,
          sortingFn: this.numSortFn,
        },
        {
          key: "last5",
          sortable: true,
          headerStyle: this.headerStyles,
          style: this.rowStyles,
          sortingFn: this.numSortFn,
        },
        {
          key: "last10",
          sortable: true,
          headerStyle: this.headerStyles,
          style: this.rowStyles,
          sortingFn: this.numSortFn,
        },
      ],
      selectedPlayer: null,
    };
  },
  methods: {
    async loadPlayers(leagueId, forceRefresh) {
      this.loading = true;
      const result = await getAllPlayers(
        leagueId,
        this.excludeIfNoPoints,
        forceRefresh
      );
      console.log(result);
      this.players = result;
      this.loading = false;
    },
    toggleDrawer() {
      this.drawerExpanded = !this.drawerExpanded;
    },
    closePlayer() {
      this.selectedPlayer = null;
    },
    selectPlayer(event) {
      if (this.selectedPlayer !== event.item) {
        this.selectedPlayer = event.item;
      } else {
        this.selectedPlayer = null;
      }
    },
    numSortFn(a, b) {
      return b - a;
    },
    toggleSettings() {
      this.settings = !this.settings;
    },
    refreshPlayers() {
      this.loadPlayers(getLeagueId(), true);
    },
    headerStyles() {
      return {
        color: `${this.themeAccentColor}`,
        background: `${this.themeBaseColor}`,
        borderBottom: `2px ${this.themeAccentColor} solid`,
      };
    },
    rowStyles() {
      return {
        color: `${this.themeAccentColor}`,
        background: `${this.themeBaseColor}`,
      };
    },
  },
  created() {
    if (getStore("excludeIfNoPoints") !== undefined) {
      this.excludeIfNoPoints = getStore("excludeIfNoPoints");
    } else {
      this.excludeIfNoPoints = true;
    }
    this.favoriteTeam = getStore("favoriteTeam") || "Seattle Kraken";
  },
  mounted() {
    const leagueId = getLeagueId();
    this.loadPlayers(leagueId);
    console.log(this.players);
  },
  computed: {
    filteredPlayers() {
      const teamSelectionsAbbr = this.teamSelections.map(
        (sel) => TEAM_NAME_TO_ABBR[sel]
      );

      let filtered = this.players;

      if (this.teamSelections.length > 0) {
        filtered = filtered.filter((player) => {
          return teamSelectionsAbbr.includes(player.team);
        });
      }

      if (this.injurySelections.length > 0) {
        filtered = filtered.filter((player) => {
          if (!player.injury && this.injurySelections.includes("HEALTHY"))
            return true;
          return this.injurySelections.includes(player.injury);
        });
      }

      if (this.positionSelections.length > 0) {
        filtered = filtered.filter((player) => {
          const intersection = this.positionSelections.filter((pos) =>
            player.positions.includes(pos)
          );
          if (intersection.length > 0) return true;
        });
      }

      if (this.mustHaveGameToday) {
        filtered = filtered.filter((player) => {
          return player.hasGameToday;
        });
      }

      if (this.filter !== "") {
        filtered = filtered.filter((player) => {
          return player.name.toLowerCase().includes(this.filter.toLowerCase());
        });
      }

      if (this.onlyFreeAgents) {
        filtered = filtered.filter((player) => {
          return !player.owner;
        });
      }

      return filtered;
    },
    filteredColumns() {
      return this.columns.filter((col) => {
        if (this.onlyFreeAgents && col.key === "owner") {
          return false;
        }
        if (
          this.injurySelections.length === 1 &&
          this.injurySelections.includes("HEALTHY") &&
          col.key === "injury"
        ) {
          return false;
        }
        return true;
      });
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
      return this.darkMode ? "#333333" : "#f2f2f2";
    },
    themeAccentColor() {
      return this.darkMode ? "#f2f2f2" : "#333333";
    },
    teamBackgroundColorStyle() {
      return `background-color: ${this.teamMainColor}`;
    },
    teamBorderStyle() {
      return `border: 2px ${this.teamSecondaryColor} solid`;
    },
    // themeBackgroundStyle() {
    //   return `background-color: ${$this.themeBaseColor}`;
    // },
    themeColorStyle() {
      return `color: ${this.themeAccentColor}`;
    },
    containerStyles() {
      return {
        border: `2px ${this.teamSecondaryColor} solid`,
        color: `${this.themeAccentColor} !important`,
        background: `${this.themeBaseColor}`,
      };
    },
  },
  watch: {
    excludeIfNoPoints(val) {
      setStore("excludeIfNoPoints", val);
    },
    favoriteTeam(val) {
      setStore("favoriteTeam", val);
    },
  },
};
</script>

<style>
.drawer {
  z-index: 100;
  position: fixed;
  bottom: 0;
  transition: all 350ms;
  height: 100vh;
  width: calc(100vw - 100px);
  color: rgb(52, 73, 94);
}
.drawer.collapsed {
  right: calc(-100vw + 100px);
}
.drawer.expanded {
  right: 0;
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
}

.mainContent {
  box-shadow: -2px 0px 1px 0px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  padding: 1em;
}

.formContainer {
  display: flex;
  /* height: 120px; */
  margin-bottom: 1em;
}

.settingsContainer {
  display: flex;
  /* height: 120px; */
  margin-bottom: 1em;
}

.tableContainer {
  max-height: 100%;
  overflow-y: scroll;
}
.tableContainer table {
  background-color: unset;
}

.playerContainer {
  position: relative;
  height: 400px;
  margin-top: 1em;
}

.playerClose {
  position: absolute;
  top: 0;
  right: 0;
}

.v-flex {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
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

.lightTheme .va-input--bordered.va-input__container,
.darkTheme .va-input--bordered .va-input__container {
  background: unset;
}
.darkTheme .va-input__content__input {
  color: #f2f2f2 !important;
}
/* .lightTheme input,
select {
  color: #333333 !important;
  background: #f2f2f2 !important;
}
.lightTheme .va-checkbox__square,
.va-button {
  color: #333333 !important;
  background: #f2f2f2 !important;
  border-color: #333333;
}
.lightTheme .va-select-option-list,
.va-select-option-list__option,
.va-select-option-list__option i {
  color: #f2f2f2 !important;
  background: #333333 !important;
} */

.darkTheme .va-input--bordered .va-input__container .darkTheme input,
select {
  color: #f2f2f2 !important;
  background: #333333 !important;
}
.darkTheme .va-checkbox__square {
  color: #f2f2f2 !important;
  background: #333333 !important;
  border-color: #f2f2f2;
}
.darkTheme .va-select-option-list,
.va-select-option-list__option,
.va-select-option-list__option i {
  color: #333333 !important;
  background: #f2f2f2 !important;
}

/*
* VUESTIC OVERRIDES
*/
.va-select-option-list {
  color: rgb(52, 73, 94);
}
/* --va-select-dropdown-background: #fff;
    --va-select-scroll-color: grey;
    --va-select-box-shadow: 0 4px 8px rgba(59,63,73,0.15);
    --va-data-table-thead-border: 2px solid var(--va-vue-darkest-blue);
    --va-data-table-thead-color: var(--va-vue-darkest-blue);
    --va-input-color: var(--va-background,#f5f9fb);
    --va-input-text-color: var(--va-dark,#262824);
    --va-input-scroll-color: var(--va-divided,#e1e9f8);
    --va-input-bordered-color: var(--va-divided,#e1e9f8);
    --va-message-list-color: var(--va-gray);
    --va-input-success-color: var(--va-success);
    --va-input-success-background: #f1f7ee;
    --va-input-error-color: var(--va-danger);
    --va-input-error-background: #fdefef;
    --va-input-placeholder-text-color: #bac2bb;
    --va-input-container-label-color: #4ae387; */

/**
* Fleaflicker overrides
*/
.drawer h1,
h2,
h3,
h4,
h5,
h6 {
  text-shadow: unset !important;
}
</style>