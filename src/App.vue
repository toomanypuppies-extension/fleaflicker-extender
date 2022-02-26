<template>
  <div
    class="fleaflicker-extender-drawer"
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
            label="Search"
            placeholder="Johnny Hockey"
            bordered
            :color="themeAccentColor"
            v-model="filter"
            @update:model-value="debounceFiltering"
          />
          <span class="spacer"></span>
          <va-select
            label="Injury"
            :options="injuryOptions"
            v-model="injurySelections"
            @update:model-value="debounceFiltering"
            placeholder="OUT"
            maxHeight="300px"
            multiple
            :color="themeAccentColor"
            bordered
            clearable
          />
        </div>
        <div class="v-flex">
          <va-select
            label="Teams"
            :options="teamOptions"
            v-model="teamSelections"
            @update:model-value="debounceFiltering"
            placeholder="Seattle Kraken"
            maxHeight="300px"
            multiple
            :color="themeAccentColor"
            bordered
            clearable
          />
          <span class="spacer"></span>

          <va-select
            label="Position"
            :options="positionOptions"
            v-model="positionSelections"
            @update:model-value="debounceFiltering"
            placeholder="F"
            maxHeight="300px"
            multiple
            :color="themeAccentColor"
            bordered
            clearable
          />
        </div>
        <div class="h-flex">
          <div class="v-flex">
            <va-checkbox
              v-model="mustHaveGameToday"
              @update:model-value="debounceFiltering"
              label="Has Game Today"
              :color="themeAccentColor"
            />
            <span class="spacer"></span>

            <va-checkbox
              v-model="onlyFreeAgents"
              @update:model-value="debounceFiltering"
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
        <div class="h-flex">
          <div class="v-flex">
            <va-select
              label="Favorite Team"
              :options="favoriteTeamOptions"
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
              label="Only show players that have points this year (refresh if changed)"
            >
            </va-checkbox>
          </div>
        </div>
        <div class="notice">
          <p>
            Players are fetched once every hour if the extension is being used.
            Once fetched they are stored locally so that things perform faster
            on the page. The "Refresh Players" button will let you force a
            refresh of local data from fleaflicker. It is recommended to only
            show players who have points this year as that excludes about half
            the players which makes the search functions perform better.
          </p>
        </div>
      </div>
      <div class="tableContainer" :style="containerStyles">
        <!-- <table class="va-table datatable">
          <thead>
            <tr>
              <th>Name</th>
              <th>Team</th>
              <th>Owner</th>
              <th>Todays Game</th>
              <th>Games Remaining</th>
              <th>Position</th>
              <th>Injury</th>
              <th>Points</th>
              <th>Avg</th>
              <th>Last 1</th>
              <th>Last 5</th>
              <th>Last 10</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="player in filteredPlayers" :key="player.id">
              <td>{{ player.name }}</td>
              <td>{{ player.team }}</td>
              <td>{{ player.owner }}</td>
              <td>{{ player.todaysGame }}</td>
              <td>{{ player.gamesThisWeek }}</td>
              <td>{{ player.position }}</td>
              <td>{{ player.injury }}</td>
              <td>{{ player.points }}</td>
              <td>{{ player.avg }}</td>
              <td>{{ player.last1 }}</td>
              <td>{{ player.last5 }}</td>
              <td>{{ player.last10 }}</td>
            </tr>
          </tbody>
        </table> -->
        <PlayerTable
          ref="playerTable"
          :players="players"
          sport="hockey"
          :onlyFreeAgents="onlyFreeAgents"
          :injurySelections="injurySelections"
          :themeBaseColor="themeBaseColor"
          :themeAccentColor="themeAccentColor"
          :teamSelections="teamSelections"
          :positionSelections="positionSelections"
          :mustHaveGameToday="mustHaveGameToday"
          :excludeIfNoPoints="excludeIfNoPoints"
          :filter="filter"
          @playerSelected="(player) => (selectedPlayer = player)"
        />

        <!-- <va-data-table
          :items="filteredPlayers"
          :columns="columns"
          :selected-color="teamSecondaryColor"
          :loading-color="teamSecondaryColor"
          hoverable
          :animated="false"
          clickable
          :loading="loading"
          @row:click="selectPlayer"
        >
        </va-data-table> -->
      </div>
      <div
        v-if="selectedPlayer"
        class="playerContainer"
        :style="containerStyles"
      >
        <div class="playerContainerLeft">
          <va-icon
            @click="closePlayer"
            class="material-icons playerClose"
            :color="themeAccentColor"
            size="medium"
            >close</va-icon
          >
          <div class="v-flex">
            <h2>
              {{ selectedPlayer.name }} -
              {{ teamAbbrToName[selectedPlayer.team] }}
            </h2>
            <div class="h-flex">
              <img
                class="playerImage"
                :src="selectedPlayer.expandedData.image"
                alt="Player Image"
                v-if="selectedPlayer.expandedData.image"
              />
              <div
                class="playerImage playerImageDefault"
                v-if="!selectedPlayer.expandedData.image"
              ></div>
              <div class="playerStats">
                <div class="flex-spaceBetween">
                  <p>Position</p>
                  <p>{{ selectedPlayer.position }}</p>
                </div>
                <div class="flex-spaceBetween">
                  <p>Injured Status</p>
                  <p>{{ selectedPlayer.injury || "Healthy" }}</p>
                </div>
                <div class="flex-spaceBetween">
                  <p>Points</p>
                  <p>{{ selectedPlayer.points }}</p>
                </div>
                <div class="flex-spaceBetween">
                  <p>Average</p>
                  <p>{{ selectedPlayer.avg }}</p>
                </div>
                <div class="flex-spaceBetween">
                  <p>Last 1</p>
                  <p>{{ selectedPlayer.last1 }}</p>
                </div>
                <div class="flex-spaceBetween">
                  <p>Last 5</p>
                  <p>{{ selectedPlayer.last5 }}</p>
                </div>
                <div class="flex-spaceBetween">
                  <p>Last 10</p>
                  <p>{{ selectedPlayer.last10 }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="playerContainerRight">
          <div class="h-flex">
            <a
              :href="selectedPlayerFleaflickerLink"
              v-if="selectedPlayerFleaflickerLink"
              @click="toggleDrawer"
              :style="{ color: themeAccentColor }"
              >Fleaflicker player page
              <va-icon
                class="material-icons"
                :color="themeAccentColor"
                size="small"
                >link</va-icon
              ></a
            >
            <a
              :href="selectedPlayerDobberLink"
              v-if="selectedPlayerDobberLink"
              target="_blank"
              :style="{ color: themeAccentColor }"
              >Dobber player page
              <va-icon
                class="material-icons"
                :color="themeAccentColor"
                size="small"
                >link</va-icon
              ></a
            >
            <a
              :href="selectedPlayerDailyFaceoffTeamLink"
              v-if="selectedPlayerDailyFaceoffTeamLink"
              target="_blank"
              :style="{ color: themeAccentColor }"
              >{{ teamAbbrToName[selectedPlayer.team] }} daily faceoff lineup
              page
              <va-icon
                class="material-icons"
                :color="themeAccentColor"
                size="small"
                >link</va-icon
              ></a
            >
          </div>
          <div class="playerNews">
            <h2>
              {{ selectedPlayer.expandedData?.news?.title || "No player news"
              }}{{ selectedPlayerNewsTime }}
            </h2>
            <br />
            <p>{{ selectedPlayer.expandedData?.news?.contents }}</p>
            <br />
            <p>{{ selectedPlayer.expandedData?.news?.analysis }}</p>
          </div>
        </div>
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
  TEAM_ABBR_TO_NAME,
} from "./contants";
import { getAllPlayers } from "./api/flea";
import { getStore, setStore } from "./utils/storage";
import { getLeagueId } from "./utils/util";
import PlayerTable from "./components/PlayerTable.vue";

export default {
  data() {
    return {
      loading: true,
      teamOptions: TEAM_LIST,
      teamAbbrToName: TEAM_ABBR_TO_NAME,
      injuryOptions: INJURY_LIST,
      positionOptions: POSITION_OPTIONS,
      players: [],
      filteredPlayers: [],
      filter: "",
      // sortBy: "points",
      // sortingOrder: "asc",
      // perPage: 50,
      // currentPage: 1,
      drawerExpanded: true,
      teamSelections: [],
      injurySelections: [],
      positionSelections: [],
      mustHaveGameToday: false,
      onlyFreeAgents: true,
      excludeIfNoPoints: true,
      settings: false,
      favoriteTeam: "Seattle Kraken",
      darkMode: true,
      selectedPlayer: null,
      leagueId: null,
      filterBufferTimer: null,
      columns: [
        {
          key: "name",
          sortable: true,
          headerStyle: this.headerStyles,
          // style: this.rowStyles,
        },
        {
          key: "team",
          sortable: true,
          headerStyle: this.headerStyles,
          // style: this.rowStyles,
        },
        {
          key: "owner",
          sortable: true,
          headerStyle: this.headerStyles,
          // style: this.rowStyles,
        },
        {
          key: "todaysGame",
          sortable: true,
          headerStyle: this.headerStyles,
          // style: this.rowStyles,
        },
        {
          key: "gamesThisWeek",
          sortable: true,
          headerStyle: this.headerStyles,
          // style: this.rowStyles,
        },
        {
          key: "position",
          sortable: true,
          headerStyle: this.headerStyles,
          // style: this.rowStyles,
        },
        {
          key: "injury",
          sortable: true,
          headerStyle: this.headerStyles,
          // style: this.rowStyles,
        },
        {
          key: "points",
          sortable: true,
          headerStyle: this.headerStyles,
          // style: this.rowStyles,
          sortingFn: this.numSortFn,
        },
        {
          key: "avg",
          sortable: true,
          headerStyle: this.headerStyles,
          // style: this.rowStyles,
          sortingFn: this.numSortFn,
        },
        {
          key: "last1",
          sortable: true,
          headerStyle: this.headerStyles,
          // style: this.rowStyles,
          sortingFn: this.numSortFn,
        },
        {
          key: "last5",
          sortable: true,
          headerStyle: this.headerStyles,
          // style: this.rowStyles,
          sortingFn: this.numSortFn,
        },
        {
          key: "last10",
          sortable: true,
          headerStyle: this.headerStyles,
          // style: this.rowStyles,
          sortingFn: this.numSortFn,
        },
      ],
      stateToStore: [
        "filter",
        "sortBy",
        "drawerExpanded",
        "teamSelections",
        "injurySelections",
        "positionSelections",
        "mustHaveGameToday",
        "onlyFreeAgents",
        "excludeIfNoPoints",
        "settings",
        "favoriteTeam",
        "darkMode",
        "selectedPlayer",
      ],
    };
  },
  components: {
    PlayerTable,
  },
  methods: {
    async loadPlayers(forceRefresh) {
      this.loading = true;
      const result = await getAllPlayers(
        this.leagueId,
        this.excludeIfNoPoints,
        forceRefresh
      );
      this.players = result;
      console.log("GOT EM", this.players);
      // this.$refs.playerTable.setFilteredPlayers();
      // this.setFilteredPlayers();
      this.loading = false;
    },
    debounceFiltering() {
      if (this.filterBufferTimer) {
        clearTimeout(this.filterBufferTimer);
      }

      this.filterBufferTimer = setTimeout(() => {
        console.log("FILTERING PLAYERS");
        this.$refs.playerTable.setFilteredPlayers();
        // this.setFilteredPlayers();
      }, 500);
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
      this.loadPlayers(true);
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
    // setFilteredPlayers() {
    //   console.log("SETTING FILTERED PLAYERS");
    //   const teamSelectionsAbbr = this.teamSelections.map(
    //     (sel) => TEAM_NAME_TO_ABBR[sel]
    //   );

    //   this.filteredPlayers = this.players.filter((player) => {
    //     if (this.onlyFreeAgents && player.owner) {
    //       return false;
    //     }

    //     if (this.mustHaveGameToday && !player.hasGameToday) {
    //       return false;
    //     }

    //     if (
    //       this.teamSelections.length > 0 &&
    //       !teamSelectionsAbbr.includes(player.team)
    //     ) {
    //       return false;
    //     }

    //     if (this.injurySelections.length > 0) {
    //       if (!player.injury && this.injurySelections.includes("HEALTHY")) {
    //         // no-op
    //       } else if (!this.injurySelections.includes(player.injury)) {
    //         return false;
    //       }
    //     }

    //     if (this.positionSelections.length > 0) {
    //       const intersection = this.positionSelections.filter((pos) =>
    //         player.positions.includes(pos)
    //       );
    //       if (intersection.length === 0) {
    //         return false;
    //       }
    //     }

    //     if (
    //       this.filter !== "" &&
    //       !player.name.toLowerCase().includes(this.filter.toLowerCase())
    //     ) {
    //       return false;
    //     }

    //     return true;
    //   });
    // },
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
  },
  computed: {
    // filteredColumns() {
    //   return this.columns.filter((col) => {
    //     if (this.onlyFreeAgents && col.key === "owner") {
    //       return false;
    //     }
    //     if (
    //       this.injurySelections.length === 1 &&
    //       this.injurySelections.includes("HEALTHY") &&
    //       col.key === "injury"
    //     ) {
    //       return false;
    //     }
    //     return true;
    //   });
    // },
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
    teamBackgroundColorStyle() {
      return `background-color: ${this.teamMainColor}`;
    },
    teamBorderStyle() {
      return `border: 2px ${this.teamSecondaryColor} solid`;
    },
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
    selectedPlayerNewsTime() {
      const epoch = this.selectedPlayer.expandedData?.news?.timeEpochMilli;
      if (epoch) {
        const formattedTime = new Date(parseInt(epoch, 10)).toLocaleDateString(
          [],
          {
            hour: "2-digit",
            minute: "2-digit",
          }
        );
        return ` - ${formattedTime}`;
      }
      return null;
    },
    selectedPlayerDobberLink() {
      if (this.selectedPlayer?.name) {
        const kebabName = this.selectedPlayer.name?.split(" ")?.join("-");
        return `https://frozenpool.dobbersports.com/players/${kebabName.toLowerCase()}`;
      }
      return null;
    },
    selectedPlayerDailyFaceoffTeamLink() {
      if (
        this.selectedPlayer?.team &&
        this.selectedPlayer.team !== "FA" &&
        TEAM_ABBR_TO_NAME[this.selectedPlayer.team]
      ) {
        const kebabTeam = TEAM_ABBR_TO_NAME[this.selectedPlayer.team]
          ?.split(" ")
          ?.join("-");
        return `https://www.dailyfaceoff.com/teams/${kebabTeam.toLowerCase()}/line-combinations/`;
      }
      return null;
    },
    selectedPlayerFleaflickerLink() {
      if (this.selectedPlayer?.name) {
        const kebabName = this.selectedPlayer.name?.split(" ")?.join("-");
        return ` https://www.fleaflicker.com/nhl/leagues/${
          this.leagueId
        }/players/${kebabName.toLowerCase()}-${this.selectedPlayer.id}`;
      }
      return null;
    },
    favoriteTeamOptions() {
      return TEAM_LIST.filter((t) => t !== "Free Agent");
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
  color: rgb(52, 73, 94);
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
  margin-bottom: 1em;
}
.settingsContainer {
  margin-bottom: 1em;
}
.notice {
  background: rgba(0, 0, 0, 0.1);
  padding: 1em;
  margin: 0.5em;
}
.tableContainer {
  max-height: 100%;
  overflow-y: scroll;
}
.tableContainer .datatable {
  // Fix fleaflicker override here
  background-color: unset;
  width: 100%;
}
.playerContainer {
  position: relative;
  margin-top: 1em;
  display: grid;
  padding: 1em;
  grid-template-columns: repeat(3, 1fr);
  gap: 1em;
}
.playerContainerLeft {
  grid-column: 1;
}
.playerContainerRight {
  grid-column: 2 / span 2;
}
.playerNews {
  background: rgba(0, 0, 0, 0.1);
  padding: 0.5em;
}
.playerImage {
  height: 200px;
  width: 200px;
}
.playerImageDefault {
  background: url("data:image/png;base64,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");
  background-repeat: no-repeat;
  background-position: left center;
  background-size: contain;
}
.playerStats {
  display: flex;
  width: 100%;
  flex-direction: column;
  justify-content: space-between;
  margin-left: 1em;
}
.playerClose {
  position: absolute;
  top: 0;
  right: 0;
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