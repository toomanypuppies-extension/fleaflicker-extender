<template>
  <div class="tableArea">
    <div class="tableHeader">
      <span class="resultCount" role="status">{{ resultCount }}</span>
      <button type="button" class="tableButton" @click="columnsOpen = true">
        <va-icon class="material-icons" size="1.1em">view_column</va-icon>
        Columns
      </button>
    </div>

    <div ref="scroller" class="tableContainer containerColor">
      <va-inner-loading :loading="loading" :size="60" :color="teamSecondaryColor">
        <table class="datatable" :class="{ tableLoading: loading }">
          <thead>
            <tr>
              <th v-for="column in columns" :key="column.key" @click="(event) => onHeaderClick(column, event)"
                @keydown.enter="(event) => onHeaderClick(column, event)" :tabindex="column.sortType ? 0 : null"
                class="headerStyles" :class="{ sortable: column.sortType }" :aria-sort="ariaSort(column)"
                :title="column.title">
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
            <tr v-for="player in renderedPlayers" :key="player.id" @click="$emit('playerSelected', player)"
              @keydown.enter="$emit('playerSelected', player)" tabindex="0" class="hoverEffects"
              :class="{ selected: player.id === selectedPlayerId }">
              <td v-for="column in columns" :key="column.key">
                <template v-if="column.key === 'gameDays'">{{ gameDays(player) }}</template>
                <template v-else>
                  {{ cellText(column, player) }}
                  <va-icon v-if="column.trendField && player[column.trendField]" class="material-icons trend"
                    :class="player[column.trendField]" size="1em"
                    :title="player[column.trendField] === 'hot' ? 'Well above their usual' : 'Well below their usual'">{{
                      player[column.trendField] === 'hot' ? 'trending_up' : 'trending_down'
                    }}</va-icon>
                </template>
              </td>
            </tr>
            <tr v-if="renderedPlayers.length < visiblePlayers.length" ref="sentinel" class="sentinel">
              <td :colspan="columns.length">Loading more players…</td>
            </tr>
            <tr v-if="!loading && visiblePlayers.length === 0" class="emptyState">
              <td :colspan="columns.length">
                <p class="emptyTitle">No players match your filters.</p>
                <p v-for="hint in emptyHints" :key="hint" class="emptyHint">{{ hint }}</p>
                <button type="button" class="tableButton" @click="$store.commit('clearFilters')">Clear filters</button>
              </td>
            </tr>
          </tbody>
        </table>
      </va-inner-loading>
    </div>

    <ColumnsModal v-model="columnsOpen" />
  </div>
</template>

<script>
import { mapState, mapGetters } from 'vuex';
import { filterPlayers } from "../collections/filtering";
import { sortPlayers, toggleSort } from "../collections/sorting";
import { visibleColumns, cellText, SORT_TYPES } from "../collections/columns";
import ColumnsModal from "./ColumnsModal.vue";

// Rows are added in pages as the table is scrolled, rendering every player at once is slow
const PAGE_SIZE = 100;
const WEEK_DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

export default {
  components: { ColumnsModal },
  emits: ['playerSelected'],
  data() {
    return {
      sorts: [],
      renderLimit: PAGE_SIZE,
      columnsOpen: false,
      observer: null,
    };
  },
  props: {
    loading: Boolean,
    players: Array,
    gamesByTeam: Object,
    sport: String,
    // Whether the league's waiver settings are known, so availability can be worked out
    availabilityKnown: Boolean,
  },
  computed: {
    ...mapState({
      teamSelections: state => state.teamSelections,
      filter: state => state.filter,
      positionSelections: state => state.positionSelections,
      injurySelections: state => state.injurySelections,
      gameDaysSelections: state => state.gameDaysSelections,
      gameDaysMode: state => state.gameDaysMode,
      statFilters: state => state.statFilters,
      ownership: state => state.ownership,
      visibleColumnKeys: state => state.visibleColumnKeys,
      excludeIfNoPoints: state => state.excludeIfNoPoints,
      selectedPlayerId: state => state.selectedPlayer?.id,
    }),
    ...mapGetters([
      'teamSecondaryColor',
    ]),
    columns() {
      // Columns that would be the same for every player shown
      const hidden = new Set();
      if (this.ownership === "Free Agent" || this.ownership === "Addable now") {
        hidden.add("owner");
      }
      if (this.ownership === "Owned") {
        hidden.add("availabilityLabel");
      }
      if (this.injurySelections.length === 1 && this.injurySelections.includes("HEALTHY")) {
        hidden.add("injury");
      }
      return visibleColumns(this.visibleColumnKeys).filter(column => !hidden.has(column.key));
    },
    filteredPlayers() {
      return filterPlayers(this.players, {
        filter: this.filter,
        teamSelections: this.teamSelections,
        injurySelections: this.injurySelections,
        positionSelections: this.positionSelections,
        gameDaysSelections: this.gameDaysSelections,
        gameDaysMode: this.gameDaysMode,
        statFilters: this.statFilters,
        ownership: this.ownership,
      }, this.gamesByTeam);
    },
    visiblePlayers() {
      // Hidden columns have the same value for every player, so sorting on them does nothing
      const visibleKeys = this.columns.map(column => column.key);
      const sorts = this.sorts.filter(sort => visibleKeys.includes(sort.key));
      return sortPlayers(this.filteredPlayers, sorts, SORT_TYPES);
    },
    renderedPlayers() {
      return this.visiblePlayers.slice(0, this.renderLimit);
    },
    resultCount() {
      if (this.loading) {
        return "Loading players…";
      }
      const total = this.players?.length || 0;
      const shown = this.visiblePlayers.length;
      return shown === total ? `${total} players` : `Showing ${shown} of ${total} players`;
    },
    emptyHints() {
      const hints = [];
      if (this.ownership === "Addable now" && !this.availabilityKnown) {
        hints.push("The league's waiver settings couldn't be loaded, so no one is known to be addable right now.");
      }
      if (this.gameDaysSelections.length > 1 && this.gameDaysMode === "all") {
        hints.push("Game Days shows teams playing on every day you picked. Switch it to any day to see more.");
      }
      if (this.statFilters.length) {
        hints.push("Players without a stat you're filtering on, like last season's for rookies, are left out.");
      }
      if (this.excludeIfNoPoints) {
        hints.push("Players without points this season are hidden, see Settings.");
      }
      return hints;
    },
  },
  methods: {
    cellText,
    gameDays(player) {
      // Only this week's days
      return this.gamesByTeam?.[player?.team]?.filter((day) => WEEK_DAYS.includes(day))?.join(", ");
    },
    sortIndex(column) {
      return this.sorts.findIndex(sort => sort.key === column.key);
    },
    ariaSort(column) {
      const sort = this.sorts.find(sort => sort.key === column.key);
      if (!sort) {
        return column.sortType ? "none" : null;
      }
      // "desc" is the first click's order: highest numbers first, but text and ranks lowest first
      const highFirst = column.sortType === "number";
      return (sort.direction === "desc") === highFirst ? "descending" : "ascending";
    },
    onHeaderClick(column, event) {
      if (!column.sortType) return;
      this.sorts = toggleSort(this.sorts, column.key, event.shiftKey);
    },
    observeSentinel() {
      this.observer?.disconnect();
      if (!this.$refs.sentinel || !window.IntersectionObserver) {
        return;
      }
      this.observer = new IntersectionObserver((entries) => {
        if (entries.some(entry => entry.isIntersecting)) {
          this.renderLimit += PAGE_SIZE;
        }
      }, { root: this.$refs.scroller, rootMargin: "400px" });
      this.observer.observe(this.$refs.sentinel);
    },
  },
  watch: {
    // A new list starts from the top
    visiblePlayers() {
      this.renderLimit = PAGE_SIZE;
      if (this.$refs.scroller) {
        this.$refs.scroller.scrollTop = 0;
      }
    },
    renderedPlayers() {
      this.$nextTick(this.observeSentinel);
    },
  },
  mounted() {
    this.observeSentinel();
  },
  beforeUnmount() {
    this.observer?.disconnect();
  },
};
</script>

<style lang="scss" scoped>
.tableArea {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1 1 auto;
}

.tableHeader {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5em;
  padding: 0 0.25em;
}

.resultCount {
  font-size: 0.9em;
  opacity: 0.85;
}

.tableButton {
  display: inline-flex;
  align-items: center;
  gap: 0.3em;
  font: inherit;
  color: inherit;
  background: none;
  border: 1px solid currentColor;
  border-radius: 4px;
  padding: 0.3em 0.75em;
  min-height: 32px;
  cursor: pointer;

  &:hover {
    background: var(--teamSecondaryColor30Opacity);
  }

  &:focus-visible {
    outline: 2px solid var(--teamSecondaryColor);
  }
}

.tableContainer {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
}

.tableContainer .datatable {
  // Fix fleaflicker override here
  background-color: unset;
  min-width: 100%;
  position: relative;

  th,
  td {
    text-align: left;
    padding: 0.625em;
    white-space: nowrap;
  }

  th {
    position: sticky;
    top: 0;
    z-index: 1;
    font-size: 0.7em;
    font-weight: 700;
    letter-spacing: 0.6px;
    line-height: 1.2;
    text-transform: uppercase;
  }

  td {
    vertical-align: top;
  }

  // Easier to follow a row across
  tbody tr:nth-child(even):not(.emptyState):not(.sentinel) {
    background: rgba(127, 127, 127, 0.07);
  }
}

.tableLoading {
  height: 200px;
}

.hoverEffects {
  cursor: pointer;

  &:hover,
  &.selected {
    background: var(--teamSecondaryColor30Opacity) !important;
  }

  &:focus-visible {
    outline: 2px solid var(--teamSecondaryColor);
    outline-offset: -2px;
  }
}

.headerStyles {
  color: var(--themeAccentColor);
  background: var(--themeBaseColor);
  box-shadow: inset 0 -2px 0 var(--themeAccentColor);
  border-bottom: unset;
  // Shift-click adds a sort, without this it also selects the header text
  user-select: none;

  &.sortable {
    cursor: pointer;

    &:hover {
      background: var(--themeAccentColor);
      color: var(--themeBaseColor);
    }
  }

  &:focus-visible {
    outline: 2px solid var(--teamSecondaryColor);
    outline-offset: -2px;
  }
}

.colHeadContent {
  display: flex;
  align-items: center;
}

.sortOrder {
  font-size: 0.75em;
}

.trend {
  margin-left: 0.2em;
  vertical-align: middle;

  &.hot {
    color: #4caf50;
  }

  &.cold {
    color: #ef5350;
  }
}

.sentinel td {
  text-align: center;
  opacity: 0.7;
}

.emptyState td {
  white-space: normal;
  text-align: center;
  padding: 2em 1em;
}

.emptyTitle {
  font-weight: 700;
  margin-bottom: 0.5em;
}

.emptyHint {
  opacity: 0.85;
  margin-bottom: 0.5em;
}
</style>
