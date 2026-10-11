<template>
  <div class="formContainer containerColor">
    <div class="filterGrid">
      <va-input
        v-model="search"
        @update:model-value="debounceSearch"
        :color="themeAccentColor"
        label="Search"
        placeholder="Player name"
        clearable
      />
      <va-select
        :model-value="teamSelections"
        @update:model-value="(val) => emitUpdate('teamSelections', val)"
        :options="teamOptions"
        :color="themeAccentColor"
        label="Teams"
        placeholder="Any"
        maxHeight="300px"
        multiple
        clearable
      />
      <va-select
        :model-value="gameDaysSelections"
        @update:model-value="(val) => emitUpdate('gameDaysSelections', val)"
        :options="daysOptions"
        :color="themeAccentColor"
        label="Game Days"
        placeholder="Any"
        maxHeight="300px"
        multiple
        clearable
      />
      <va-select
        :model-value="injurySelections"
        @update:model-value="(val) => emitUpdate('injurySelections', val)"
        :options="injuryOptions"
        :color="themeAccentColor"
        label="Injury"
        placeholder="Any"
        maxHeight="300px"
        multiple
        clearable
      />
      <va-select
        :model-value="positionSelections"
        @update:model-value="(val) => emitUpdate('positionSelections', val)"
        :options="positionOptions"
        :color="themeAccentColor"
        label="Position"
        placeholder="Any"
        maxHeight="300px"
        multiple
        clearable
      />
      <va-select
        :model-value="ownership"
        @update:model-value="(val) => emitUpdate('ownership', val)"
        :options="ownershipOptions"
        :color="themeAccentColor"
        label="Ownership"
        placeholder="All"
        maxHeight="300px"
        clearable
      />
    </div>
    <div class="filterFooter">
      <button type="button" class="clearButton" :disabled="activeFilterCount === 0" @click="clearFilters">
        <va-icon class="material-icons" size="1.1em">clear</va-icon>
        Clear filters<template v-if="activeFilterCount"> ({{ activeFilterCount }})</template>
      </button>
    </div>
  </div>
</template>

<script>
import { mapGetters, mapState } from "vuex";
import {
  DAYS_ARRAY,
  HOCKEY_INJURY_LIST,
  HOCKEY_POSITION_OPTIONS,
  HOCKEY_TEAM_ABBR_TO_NAME,
  HOCKEY_TEAM_LIST,
  OWNERSHIP_OPTIONS,
} from "../constants";

const SEARCH_DELAY = 250;

export default {
  data() {
    return {
      teamOptions: HOCKEY_TEAM_LIST,
      teamAbbrToName: HOCKEY_TEAM_ABBR_TO_NAME,
      injuryOptions: HOCKEY_INJURY_LIST,
      positionOptions: HOCKEY_POSITION_OPTIONS,
      daysOptions: DAYS_ARRAY,
      // Typed text, the store's filter catches up once typing pauses
      search: this.$store.state.filter,
      searchTimer: null,
    };
  },
  methods: {
    clearFilters() {
      clearTimeout(this.searchTimer);
      this.$store.commit('clearFilters');
      this.search = "";
    },
    emitUpdate(key, val) {
      this.$store.commit('setKeyValue', { key, value: val })
    },
    debounceSearch(val) {
      clearTimeout(this.searchTimer);
      this.searchTimer = setTimeout(() => this.emitUpdate('filter', val), SEARCH_DELAY);
    },
  },
  beforeUnmount() {
    clearTimeout(this.searchTimer);
  },
  computed: {
    ...mapGetters([
      'themeBaseColor',
      'themeAccentColor'
    ]),
    ...mapState({
      teamSelections: state => state.teamSelections,
      injurySelections: state => state.injurySelections,
      positionSelections: state => state.positionSelections,
      gameDaysSelections: state => state.gameDaysSelections,
      owners: state => state.owners,
      ownership: state => state.ownership,
    }),
    activeFilterCount() {
      return [
        this.search?.trim(),
        this.teamSelections.length,
        this.gameDaysSelections.length,
        this.injurySelections.length,
        this.positionSelections.length,
        this.ownership && this.ownership !== "All",
      ].filter(Boolean).length;
    },
    ownershipOptions() {
      return [...OWNERSHIP_OPTIONS, ...this.owners]
    }
  }
};
</script>

<style lang="scss" scoped>
.formContainer {
  margin-bottom: 1em;
  padding: 0.75em;
}

.filterGrid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.75em;
}

.filterFooter {
  display: flex;
  justify-content: flex-end;
  margin-top: 0.5em;
}

.clearButton {
  display: flex;
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

  &:disabled {
    opacity: 0.4;
    cursor: default;
  }

  &:hover:not(:disabled) {
    background: var(--teamSecondaryColor30Opacity);
  }

  &:focus-visible {
    outline: 2px solid var(--teamSecondaryColor);
  }
}
</style>
