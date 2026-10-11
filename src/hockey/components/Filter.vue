<template>
  <div class="formContainer containerColor" :class="{ compact: narrow }">
    <div v-if="narrow" class="filterBar">
      <button type="button" class="clearButton" :aria-expanded="sheetOpen" @click="sheetOpen = true">
        <va-icon class="material-icons" size="1.1em">tune</va-icon>
        Filters<template v-if="activeFilterCount"> ({{ activeFilterCount }})</template>
      </button>
      <button v-if="activeFilterCount" type="button" class="clearButton" @click="clearFilters">Clear</button>
    </div>
    <div v-if="narrow && sheetOpen" class="sheetBackdrop" @click="sheetOpen = false"></div>

    <div v-show="!narrow || sheetOpen" :class="{ filterSheet: narrow }" :role="narrow ? 'dialog' : null"
      :aria-label="narrow ? 'Filters' : null">
    <div v-if="narrow" class="sheetHeader">
      <h2>Filters</h2>
      <button type="button" class="clearButton" @click="sheetOpen = false">Done</button>
    </div>
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
    <div class="statFilters">
      <span v-for="(statFilter, index) in statFilters" :key="index" class="chip">
        {{ statFilterLabel(statFilter) }}
        <button type="button" class="chipRemove" :aria-label="`Remove ${statFilterLabel(statFilter)}`"
          @click="removeStatFilter(index)">
          <va-icon class="material-icons" size="1em">close</va-icon>
        </button>
      </span>

      <form v-if="addingStatFilter" class="statFilterForm" @submit.prevent="addStatFilter">
        <va-select
          v-model="draft.key"
          :options="statOptions"
          text-by="text"
          value-by="value"
          :color="themeAccentColor"
          label="Stat"
          placeholder="Pick a stat"
          maxHeight="300px"
        />
        <va-input v-model="draft.min" :color="themeAccentColor" label="At least" inputmode="decimal" placeholder="Any" />
        <va-input v-model="draft.max" :color="themeAccentColor" label="At most" inputmode="decimal" placeholder="Any" />
        <div class="formButtons">
          <button type="submit" class="clearButton" :disabled="!draftValid">Add</button>
          <button type="button" class="clearButton" @click="addingStatFilter = false">Cancel</button>
        </div>
        <p v-if="draftError" class="draftError" role="alert">{{ draftError }}</p>
      </form>
      <button v-else type="button" class="clearButton" @click="startStatFilter">
        <va-icon class="material-icons" size="1.1em">add</va-icon>
        Stat filter
      </button>
    </div>

    <div class="filterFooter">
      <div v-if="gameDaysSelections.length > 1" class="gameDaysMode" role="radiogroup" aria-label="Game Days match">
        <span>Teams playing on</span>
        <button v-for="mode in gameDaysModes" :key="mode.value" type="button" role="radio"
          :aria-checked="gameDaysMode === mode.value" class="modeButton" :class="{ active: gameDaysMode === mode.value }"
          @click="emitUpdate('gameDaysMode', mode.value)">{{ mode.text }}</button>
      </div>
      <button type="button" class="clearButton" :disabled="activeFilterCount === 0" @click="clearFilters">
        <va-icon class="material-icons" size="1.1em">clear</va-icon>
        Clear filters<template v-if="activeFilterCount"> ({{ activeFilterCount }})</template>
      </button>
    </div>
    </div>
  </div>
</template>

<script>
import { mapGetters, mapState } from "vuex";
import { STAT_FILTER_COLUMNS, COLUMNS_BY_KEY } from "../collections/columns";
import { GAME_DAYS_MODES } from "../collections/filtering";
import { isNarrow } from "../../utils/narrow";
import {
  DAYS_ARRAY,
  HOCKEY_INJURY_LIST,
  HOCKEY_POSITION_OPTIONS,
  HOCKEY_TEAM_ABBR_TO_NAME,
  HOCKEY_TEAM_LIST,
  OWNERSHIP_OPTIONS,
} from "../constants";

const SEARCH_DELAY = 250;

// Short names like GP get their description, e.g. "GP: Games played"
const statOptionText = (column) => (
  column.title && column.name.length <= 4 ? `${column.name}: ${column.title.split('.')[0]}` : column.name
);

// Blank is no bound, null. Anything else that isn't a number is NaN.
const parseBound = (text) => {
  const trimmed = String(text ?? "").trim();
  return trimmed === "" ? null : Number(trimmed);
};

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
      statOptions: STAT_FILTER_COLUMNS.map(column => ({ text: statOptionText(column), value: column.key })),
      gameDaysModes: [
        { value: GAME_DAYS_MODES.all, text: "every day" },
        { value: GAME_DAYS_MODES.any, text: "any day" },
      ],
      addingStatFilter: false,
      // On phones the filters open in a sheet
      sheetOpen: false,
      draft: { key: null, min: "", max: "" },
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
    closeSheetOnEscape(event) {
      if (event.key === 'Escape' && this.sheetOpen && !event.target.closest?.('.va-dropdown__content')) {
        // Handled, so the extension's panel doesn't close as well
        event.preventDefault();
        this.sheetOpen = false;
      }
    },
    startStatFilter() {
      this.draft = { key: null, min: "", max: "" };
      this.addingStatFilter = true;
    },
    addStatFilter() {
      if (!this.draftValid) return;
      this.emitUpdate('statFilters', [...this.statFilters, {
        key: this.draft.key,
        min: parseBound(this.draft.min),
        max: parseBound(this.draft.max),
      }]);
      this.addingStatFilter = false;
    },
    removeStatFilter(index) {
      this.emitUpdate('statFilters', this.statFilters.filter((_, i) => i !== index));
    },
    statFilterLabel({ key, min, max }) {
      const name = COLUMNS_BY_KEY[key]?.name || key;
      if (min !== null && max !== null) return `${name} ${min} to ${max}`;
      if (min !== null) return `${name} at least ${min}`;
      return `${name} at most ${max}`;
    },
    debounceSearch(val) {
      clearTimeout(this.searchTimer);
      this.searchTimer = setTimeout(() => this.emitUpdate('filter', val), SEARCH_DELAY);
    },
  },
  mounted() {
    document.addEventListener('keydown', this.closeSheetOnEscape);
  },
  beforeUnmount() {
    clearTimeout(this.searchTimer);
    document.removeEventListener('keydown', this.closeSheetOnEscape);
  },
  watch: {
    // Filters cleared from elsewhere, like the empty table's Clear filters
    "$store.state.filter"(filter) {
      if (filter === "" && this.search !== "") {
        clearTimeout(this.searchTimer);
        this.search = "";
      }
    },
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
      statFilters: state => state.statFilters,
      gameDaysMode: state => state.gameDaysMode,
    }),
    narrow() {
      return isNarrow.value;
    },
    draftError() {
      const min = parseBound(this.draft.min);
      const max = parseBound(this.draft.max);
      if (Number.isNaN(min) || Number.isNaN(max)) return "Enter numbers, like 2.5";
      if (min !== null && max !== null && min > max) return "At least is more than at most";
      return null;
    },
    draftValid() {
      const min = parseBound(this.draft.min);
      const max = parseBound(this.draft.max);
      return !!this.draft.key && !this.draftError && (min !== null || max !== null);
    },
    activeFilterCount() {
      return [
        this.search?.trim(),
        this.teamSelections.length,
        this.gameDaysSelections.length,
        this.injurySelections.length,
        this.positionSelections.length,
        this.ownership && this.ownership !== "All",
      ].filter(Boolean).length + this.statFilters.length;
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

.filterBar {
  display: flex;
  gap: 0.5em;

  .clearButton {
    min-height: 44px;
  }
}

.formContainer.compact {
  padding: 0.5em;
}

.sheetBackdrop {
  position: absolute;
  inset: 0;
  z-index: 19;
  background: rgba(0, 0, 0, 0.5);
}

.filterSheet {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 20;
  max-height: 85%;
  overflow-y: auto;
  padding: 1em;
  background: var(--themeBaseColor);
  border-top: 2px solid var(--teamSecondaryColor);
  border-radius: 12px 12px 0 0;
  box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.4);

  .clearButton,
  .modeButton {
    min-height: 44px;
  }
}

.sheetHeader {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75em;

  h2 {
    font-size: 1.2em;
    font-weight: 700;
    margin: 0;
  }
}

.filterGrid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.75em;
}

.filterFooter {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 1em;
  flex-wrap: wrap;
  margin-top: 0.75em;
}

.statFilters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5em;
  margin-top: 0.75em;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25em;
  padding: 0.2em 0.3em 0.2em 0.75em;
  border-radius: 1em;
  background: var(--teamSecondaryColor30Opacity);
  border: 1px solid var(--teamSecondaryColor);
}

.chipRemove {
  display: inline-flex;
  font: inherit;
  color: inherit;
  background: none;
  border: none;
  border-radius: 50%;
  padding: 0.2em;
  cursor: pointer;

  &:hover {
    background: var(--teamSecondaryColor30Opacity);
  }
}

.statFilterForm {
  display: grid;
  grid-template-columns: minmax(200px, 2fr) minmax(90px, 1fr) minmax(90px, 1fr) auto;
  align-items: end;
  gap: 0.5em;
  width: 100%;
}

.formButtons {
  display: flex;
  gap: 0.5em;
}

.draftError {
  grid-column: 1 / -1;
  color: #ef5350;
  font-size: 0.9em;
}

@media (max-width: 640px) {
  .statFilterForm {
    grid-template-columns: 1fr 1fr;
  }
}

.gameDaysMode {
  display: flex;
  align-items: center;
  gap: 0.4em;
  margin-right: auto;
}

.modeButton {
  font: inherit;
  color: inherit;
  background: none;
  border: 1px solid currentColor;
  border-radius: 4px;
  padding: 0.2em 0.6em;
  cursor: pointer;
  opacity: 0.7;

  &.active {
    opacity: 1;
    background: var(--teamSecondaryColor30Opacity);
    border-color: var(--teamSecondaryColor);
  }
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
