<template>
  <div class="formContainer containerColor">
    <div class="v-flex">
      <va-input
        v-model="search"
        @update:model-value="debounceSearch"
        :color="themeAccentColor"
        label="Search"
        placeholder="Nils Hoglander"
        bordered
      />
      <span class="spacer"></span>
      <va-select
        :model-value="injurySelections"
        @update:model-value="(val) => emitUpdate('injurySelections', val)"
        :options="injuryOptions"
        :color="themeAccentColor"
        label="Injury"
        placeholder="OUT"
        maxHeight="300px"
        multiple
        bordered
        clearable
      />
    </div>
    <div class="v-flex">
      <va-select
        :model-value="teamSelections"
        @update:model-value="(val) => emitUpdate('teamSelections', val)"
        :options="teamOptions"
        :color="themeAccentColor"
        label="Teams"
        placeholder="Seattle Kraken"
        maxHeight="300px"
        multiple
        bordered
        clearable
      />
      <span class="spacer"></span>

      <va-select
        :model-value="positionSelections"
        @update:model-value="(val) => emitUpdate('positionSelections', val)"
        :options="positionOptions"
        :color="themeAccentColor"
        label="Position"
        placeholder="F"
        maxHeight="300px"
        multiple
        bordered
        clearable
      />
    </div>
    <div class="v-flex">
      <va-select
        :model-value="gameDaysSelections"
        @update:model-value="(val) => emitUpdate('gameDaysSelections', val)"
        :options="daysOptions"
        :color="themeAccentColor"
        label="Game Days"
        placeholder="Mo, Tu"
        maxHeight="300px"
        multiple
        bordered
        clearable
      />

      <span class="spacer"></span>

      <va-select
        :model-value="ownership"
        @update:model-value="(val) => emitUpdate('ownership', val)"
        :options="ownershipOptions"
        :color="themeAccentColor"
        label="Ownership"
        placeholder="All"
        maxHeight="300px"
        bordered
        clearable
      />

    </div>
    <div class="settings-icon">
      <va-icon
        @click="clearFilters"
        :color="themeAccentColor"
        class="material-icons"
        size="medium"
      >delete</va-icon>
      <va-icon
        @click="toggleSettings"
        :color="themeAccentColor"
        class="material-icons"
        size="medium"
      >settings</va-icon>
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
    toggleSettings() {
      this.$store.commit('toggleKeyValue', { key: 'openSettings' })
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
    ownershipOptions() {
      return [...OWNERSHIP_OPTIONS, ...this.owners]
    }
  }
};
</script>

<style scoped>
.formContainer {
  display: flex;
  margin-bottom: 1em;
}

.settings-icon {
  display: flex;
  flex-shrink: 1;
  padding: 0.5em;
  flex-direction: column;
  justify-content: space-between;
  height: 100%;
}

.tall-checkbox {
  height: 38px;
  display: flex;
}
</style>