<template>
  <div class="formContainer containerColor">
    <div class="v-flex">
      <va-input
        v-model="filter"
        @update:model-value="(val) => emitUpdate('filter', val)"
        :color="themeAccentColor"
        label="Search"
        placeholder="Nils Hoglander"
        bordered
      />
      <span class="spacer"></span>
      <va-select
        v-model="injurySelections"
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
        v-model="teamSelections"
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
        v-model="positionSelections"
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
        v-model="gameDaysSelections"
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
        v-model="ownership"
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

export default {
  data() {
    return {
      teamOptions: HOCKEY_TEAM_LIST,
      teamAbbrToName: HOCKEY_TEAM_ABBR_TO_NAME,
      injuryOptions: HOCKEY_INJURY_LIST,
      positionOptions: HOCKEY_POSITION_OPTIONS,
      daysOptions: DAYS_ARRAY,
    };
  },
  methods: {
    clearFilters() {
      this.$store.commit('clearFilters');
      this.emitFilterHash();
    },
    emitUpdate(key, val) {
      this.$store.commit('setKeyValue', {key, value: val})
      this.emitFilterHash();
      // this.$emit("update", key, val);
    },
    emitFilterHash() {
      this.$store.commit('setKeyValue', { key: 'filterHash', value: performance.now() })
    },
    toggleSettings() {
      this.$store.commit('toggleKeyValue', { key: 'openSettings' })
    },
  },
  computed: {
    ...mapGetters([
      'themeBaseColor',
      'themeAccentColor'
    ]),
    ...mapState({
      filter: state => state.filter,
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