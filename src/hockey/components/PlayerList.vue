<template>
  <div class="tableContainer containerColor">
    <va-inner-loading :loading="loading" :size="60" :color="teamSecondaryColor">
      <table class="va-table datatable" :class="{ tableLoading: loading }">
        <thead>
          <tr>
            <th v-for="column in columns" :key="column.key" @click="(event) => onHeaderClick(column, event)"
              class="headerStyles" :class="{ cursor: column.sortType }" :aria-sort="ariaSort(column)">
              <span class="colHeadContent">
                {{ column.name }}
                <template v-if="sortIndex(column) >= 0">
                  <va-icon class="material-icons" size="1em">{{
                    sorts[sortIndex(column)].direction === 'desc' ? 'expand_more' : 'expand_less'
                  }}</va-icon>
                  <span v-if="sorts.length > 1" class="sortOrder">{{ sortIndex(column) + 1 }}</span>
                </template>
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="player in visiblePlayers" :key="player.id" @click="$emit('playerSelected', player)"
            class="hoverEffects">
            <td v-for="column in columns" :key="`${column.key}-${player.id}`">
              <template v-if="column.key === 'gameDays'">
                <!-- Only show this week days -->
                {{ gamesByTeam && gamesByTeam[player?.team]?.filter((day) =>
                  ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].includes(day))?.join(", ") }}
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
import { mapState, mapGetters } from 'vuex';
import { filterPlayers } from "../collections/filtering";
import { sortPlayers, toggleSort } from "../collections/sorting";

const TABLE_COLUMNS = [
  { key: "name", name: "Name", sortType: "string" },
  { key: "team", name: "Team", sortType: "string" },
  { key: "owner", name: "Owner", sortType: "string" },
  { key: "todaysGame", name: "Today's Game", sortType: "string" },
  { key: "gamesThisWeek", name: "Games Remaining", sortType: "number" },
  { key: "gameDays", name: "Game Days" },
  { key: "position", name: "Position", sortType: "string" },
  { key: "injury", name: "Injury", sortType: "string" },
  { key: "points", name: "Points", sortType: "number" },
  { key: "avg", name: "Avg", sortType: "number" },
  { key: "last1", name: "Last 1", sortType: "number" },
  { key: "last5", name: "Last 5", sortType: "number" },
  { key: "last10", name: "Last 10", sortType: "number" },
];

const SORT_TYPES = Object.fromEntries(TABLE_COLUMNS.map(column => [column.key, column.sortType]));

export default {
  data() {
    return {
      sorts: [],
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
      filter: state => state.filter,
      positionSelections: state => state.positionSelections,
      injurySelections: state => state.injurySelections,
      gameDaysSelections: state => state.gameDaysSelections,
      ownership: state => state.ownership,
    }),
    ...mapGetters([
      'teamSecondaryColor',
    ]),
    columns() {
      return TABLE_COLUMNS.filter((col) => {
        if (this.ownership === "Free Agent" && col.key === "owner") {
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
    filteredPlayers() {
      return filterPlayers(this.players, {
        filter: this.filter,
        teamSelections: this.teamSelections,
        injurySelections: this.injurySelections,
        positionSelections: this.positionSelections,
        gameDaysSelections: this.gameDaysSelections,
        ownership: this.ownership,
      }, this.gamesByTeam);
    },
    visiblePlayers() {
      // Hidden columns have the same value for every player, so sorting on them does nothing
      const visibleKeys = this.columns.map(column => column.key);
      const sorts = this.sorts.filter(sort => visibleKeys.includes(sort.key));
      return sortPlayers(this.filteredPlayers, sorts, SORT_TYPES);
    },
  },
  methods: {
    sortIndex(column) {
      return this.sorts.findIndex(sort => sort.key === column.key);
    },
    ariaSort(column) {
      const sort = this.sorts.find(sort => sort.key === column.key);
      if (!sort) {
        return column.sortType ? "none" : null;
      }
      // "desc" is A to Z for text columns
      const descending = (sort.direction === "desc") === (column.sortType === "number");
      return descending ? "descending" : "ascending";
    },
    onHeaderClick(column, event) {
      if (!column.sortType) return;
      this.sorts = toggleSort(this.sorts, column.key, event.shiftKey);
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
  min-width: 100%;
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
  // Shift-click adds a sort, without this it also selects the header text
  user-select: none;

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
  align-items: center;
  font-size: 0.625rem;
}

.sortOrder {
  font-size: 0.75em;
}
</style>