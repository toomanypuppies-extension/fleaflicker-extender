<template>
  <div class="tableContainer containerColor">
    <va-inner-loading
      :loading="loading"
      :size="60"
      :color="teamSecondaryColor"
    >
      <table
        class="va-table datatable"
        :class="{ tableLoading: loading }"
      >
        <thead>
          <tr>
            <th
              v-for="column in columns"
              :key="column.key"
              @click="() => handledSortSingleClick(column)"
              @dblclick="() => handledSortDoubleClick(column)"
              class="headerStyles"
              :class="{ cursor: column.sortable }"
            >
              <span class="colHeadContent">
                {{ column.name }}
                <va-icon
                  v-if="sortMap[column.key] === 'desc'"
                  class="material-icons"
                  size="1em"
                >expand_more</va-icon>
                <va-icon
                  v-if="
                    sortMap[column.key] === 'desc' &&
                    sortColumns[1] === column.key
                  "
                  class="material-icons"
                  size="1em"
                >expand_more</va-icon>
                <va-icon
                  v-if="sortMap[column.key] === 'asc'"
                  class="material-icons"
                  size="1em"
                >expand_less</va-icon>
                <va-icon
                  v-if="
                    sortMap[column.key] === 'asc' &&
                    sortColumns[1] === column.key
                  "
                  class="material-icons"
                  size="1em"
                >expand_less</va-icon>
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="player in filteredPlayers"
            :key="player.id"
            @click="$emit('playerSelected', player)"
            class="hoverEffects"
          >
            <td
              v-for="column in columns"
              :key="`${column.key}-${player.id}`"
            >
              <template v-if="column.key === 'gameDays'">
                <!-- Only show this week days -->
                {{ gamesByTeam && gamesByTeam[player?.team]?.filter((day) => ['Mo','Tu','We','Th','Fr','Sa','Su'].includes(day))?.join(", ") }}
              </template>
              <template v-else>
                {{ player[column.key] }}
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </va-inner-loading>
  </div>
</template>

<script>
import { HOCKEY_TEAM_NAME_TO_ABBR } from "../constants";
import { containsAll } from "../../utils/util";
import { mapState, mapGetters } from 'vuex';
export default {
  data() {
    return {
      tableColumns: [
        {
          key: "name",
          name: "Name",
          sortable: true,
          sortingFn: this.stringSortFn,
        },
        {
          key: "team",
          name: "Team",
          sortable: true,
          sortingFn: this.stringSortFn,
        },
        {
          key: "owner",
          name: "Owner",
          sortable: true,
          sortingFn: this.stringSortFn,
        },
        {
          key: "todaysGame",
          name: "Todays Game",
          sortable: true,
          sortingFn: this.stringSortFn,
        },
        // {
        //   key: "gamesThisWeek",
        //   name: "Games Remaining",
        //   sortable: true,
        //   sortingFn: this.numSortFn,
        // },
        {
          key: "gameDays",
          name: "Game Days",
          sortable: false,
        },
        {
          key: "position",
          name: "Position",
          sortable: true,
          sortingFn: this.stringSortFn,
        },
        {
          key: "injury",
          name: "Injury",
          sortable: true,
          sortingFn: this.stringSortFn,
        },
        {
          key: "points",
          name: "Points",
          sortable: true,
          sortingFn: this.numSortFn,
        },
        {
          key: "avg",
          name: "Avg",
          sortable: true,
          sortingFn: this.numSortFn,
        },
        {
          key: "last1",
          name: "Last 1",
          sortable: true,
          sortingFn: this.numSortFn,
        },
        {
          key: "last5",
          name: "Last 5",
          sortable: true,
          sortingFn: this.numSortFn,
        },
        {
          key: "last10",
          name: "Last 10",
          sortable: true,
          sortingFn: this.numSortFn,
        },
      ],
      filteredPlayers: [],
      sortMap: {},
      sortColumns: [],
      dblClickTimer: null,
    };
  },
  props: {
    loading: Boolean,
    players: Array,
    gamesByTeam: Object,
    sport: String,
  },
  computed: {
    ...mapState({
      teamSelections: state => state.teamSelections,
      excludeIfNoPoints: state => state.excludeIfNoPoints,
      filter: state => state.filter,
      positionSelections: state => state.positionSelections,
      injurySelections: state => state.injurySelections,
      gameDaysSelections: state => state.gameDaysSelections,
      onlyFreeAgents: state => state.onlyFreeAgents,
      filterHash: state => state.filterHash,
    }),
    ...mapGetters([
      'teamSecondaryColor',
    ]),
    columns() {
      return this.tableColumns.filter((col) => {
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
    teamsMatchingGamesDaysSelection() {
      if (!this.gameDaysSelections || this.gameDaysSelections.length === 0)
        return [];
      const matchedTeams = [];

      for (const [teamAbbr, teamGames] of Object.entries(this.gamesByTeam)) {
        if (containsAll(teamGames, this.gameDaysSelections)) {
          matchedTeams.push(teamAbbr);
        }
      }

      return matchedTeams;
    },
  },
  methods: {
    setFilteredPlayers() {
      const teamSelectionsAbbr = this.teamSelections.map(
        (sel) => HOCKEY_TEAM_NAME_TO_ABBR[sel]
      );

      this.filteredPlayers = this.players.filter((player) => {
        if (this.onlyFreeAgents && player.owner) {
          return false;
        }

        if (this.gameDaysSelections && this.gameDaysSelections.length > 0) {
          if (!this.teamsMatchingGamesDaysSelection.includes(player.team)) {
            return false;
          }
        }

        if (
          this.teamSelections.length > 0 &&
          !teamSelectionsAbbr.includes(player.team)
        ) {
          return false;
        }

        if (this.injurySelections.length > 0) {
          if (!player.injury && this.injurySelections.includes("HEALTHY")) {
            // no-op
          } else if (!this.injurySelections.includes(player.injury)) {
            return false;
          }
        }

        if (this.positionSelections.length > 0) {
          const intersection = this.positionSelections.filter((pos) =>
            player.positions.includes(pos)
          );
          if (intersection.length === 0) {
            return false;
          }
        }

        if (
          this.filter !== "" &&
          !player.name.toLowerCase().includes(this.filter.toLowerCase())
        ) {
          return false;
        }

        return true;
      });

      // Re-apply sort after filtering
      if (this.sortColumns.length > 0) {
        this.sortPlayerList();
      }
    },
    numSortFn(a, b) {
      const aA = a || 0;
      const bB = b || 0;
      return bB - aA;
    },
    stringSortFn(a, b) {
      const aA = a || "";
      const bB = b || "";
      return aA.localeCompare(bB);
    },
    handledSortSingleClick(column) {
      if (!column.sortable) return;

      if (this.dblClickTimer) {
        clearTimeout(this.dblClickTimer);
      }
      this.dblClickTimer = setTimeout(() => {
        this.configureSortColumn(column);
      }, 300);
    },
    handledSortDoubleClick(column) {
      if (!column.sortable) return;

      if (this.dblClickTimer) {
        clearTimeout(this.dblClickTimer);
      }
      this.removeSortColumn(column);
    },
    configureSortColumn(column) {
      if (
        this.sortColumns.length >= 2 &&
        !this.sortColumns.includes(column.key)
      ) {
        return;
      }

      if (!this.sortColumns.includes(column.key)) {
        this.sortColumns.push(column.key);
      }

      if (!this.sortMap[column.key]) {
        this.sortMap[column.key] = "desc";
      } else if (this.sortMap[column.key] === "desc") {
        this.sortMap[column.key] = "asc";
      } else {
        this.removeSortColumn(column);
      }

      this.sortPlayerList();
    },
    removeSortColumn(column) {
      this.sortMap[column.key] = null;
      this.sortColumns = this.sortColumns.filter((col) => col !== column.key);
    },
    sortPlayerList() {
      this.sortColumns
        .slice()
        .reverse()
        .forEach((col) => {
          const column = this.columns.find((c) => c.key === col);

          this.filteredPlayers = this.filteredPlayers.sort((a, b) => {
            aVal = this.sortMap[col] === "desc" ? a[col] : b[col];
            bVal = this.sortMap[col] === "desc" ? b[col] : a[col];

            return column.sortingFn(aVal, bVal);
          });
        });
    },
  },
  watch: {
    players(newPlayers, oldPlayers) {
      if (oldPlayers !== newPlayers) {
        this.setFilteredPlayers();
      }
    },
    filterHash(newVal, oldVal) {
      if (oldVal !== newVal) {
        this.setFilteredPlayers();
      }
    },
  },
};
</script>

<style lang="scss" scoped>
.tableContainer {
  max-height: 100%;
  overflow-y: scroll;
}

.tableContainer .datatable {
  // Fix fleaflicker override here
  background-color: unset;
  width: 100%;
  position: relative;

  th {
    position: sticky;
    top: 0;
  }
}

.tableLoading {
  height: 200px;
}

.hoverEffects:hover {
  cursor: pointer;
  background: var(--teamSecondaryColor30Opacity);
}

.headerStyles {
  color: var(--themeAccentColor);
  background: var(--themeBaseColor);
  box-shadow: inset 0 -2px 0 var(--themeAccentColor);
  border-bottom: unset;

  &:hover {
    background: var(--themeAccentColor);
    color: var(--themeBaseColor);
  }
}

.cursor {
  &:hover {
    cursor: pointer;
  }
}

.colHeadContent {
  display: flex;
  font-size: 0.625rem;
}
</style>