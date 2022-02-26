<template>
  <va-inner-loading :loading="loading" :size="60" :color="teamSecondaryColor">
    <table
      class="va-table datatable"
      :class="{ tableLoading: loading }"
      :style="bindCssVars"
    >
      <thead>
        <tr>
          <th
            v-for="column in columns"
            :key="column.key"
            @click="() => sortColumn(column)"
            class="headerStyles hoverEffects"
          >
            {{ column.name }}
            <va-icon
              v-if="sortMap[column.key] === 'desc'"
              class="material-icons"
              size="1em"
              >expand_more</va-icon
            ><va-icon
              v-if="sortMap[column.key] === 'asc'"
              class="material-icons"
              size="1em"
              >expand_less</va-icon
            >
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
          <td v-for="column in columns" :key="`${column.key}-${player.id}`">
            {{ player[column.key] }}
          </td>
        </tr>
      </tbody>
    </table>
  </va-inner-loading>
</template>

// TODO
// Persist sorting to localStore so it stays between navigations

<script>
import { SPORT_HOCKEY, TEAM_NAME_TO_ABBR } from "../contants";
export default {
  data() {
    return {
      tableColumns: {
        hockey: [
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
          {
            key: "gamesThisWeek",
            name: "Games Remaining",
            sortable: true,
            sortingFn: this.numSortFn,
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
      },
      filteredPlayers: [],
      sortMap: {},
    };
  },
  props: {
    loading: Boolean,
    players: Array,
    sport: String,
    onlyFreeAgents: Boolean,
    teamSelections: Array,
    injurySelections: Array,
    positionSelections: Array,
    mustHaveGameToday: Boolean,
    excludeIfNoPoints: Boolean,
    filter: String,
  },
  computed: {
    columns() {
      const sportColumns = this.tableColumns[this.sport];

      if (this.sport === SPORT_HOCKEY) {
        return sportColumns.filter((col) => {
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
      }

      return sportColumns;
    },
  },
  methods: {
    setFilteredPlayers() {
      const teamSelectionsAbbr = this.teamSelections.map(
        (sel) => TEAM_NAME_TO_ABBR[sel]
      );

      // Reset sorts on filter changee
      this.sortMap = {};

      this.filteredPlayers = this.players.filter((player) => {
        if (this.onlyFreeAgents && player.owner) {
          return false;
        }

        if (this.mustHaveGameToday && !player.hasGameToday) {
          return false;
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
    },
    numSortFn(a, b) {
      return b - a;
    },
    stringSortFn(a, b) {
      return a?.localeCompare(b);
    },
    sortColumn(column) {
      // Allow for sorting of up to 2 or 3 columns. Shift sorting to as they are clicked through
      if (this.sortMap[column.key] === "desc") {
        this.sortMap[column.key] = "asc";
      } else {
        this.sortMap[column.key] = "desc";
      }

      this.filteredPlayers = this.filteredPlayers.sort((a, b) => {
        aVal =
          this.sortMap[column.key] === "desc" ? a[column.key] : b[column.key];
        bVal =
          this.sortMap[column.key] === "desc" ? b[column.key] : a[column.key];
        return column.sortingFn(aVal, bVal);
      });
    },
    setSelectedPlayer(player) {},
  },
  watch: {
    players(newPlayers, oldPlayers) {
      if (oldPlayers !== newPlayers) {
        this.setFilteredPlayers();
      }
    },
  },
};
</script>

<style scoped>
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
  border-bottom: 2px var(--themeAccentColor) solid;
}
</style>