<template>
  <div class="formContainer containerColor">
    <div class="v-flex">
      <va-input
        v-model="filter"
        @update:model-value="(val) => emitUpdate('filter', val)"
        :color="themeAccentColor"
        label="Search"
        placeholder="Johnny Hockey"
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

      <va-checkbox
        class="tall-checkbox"
        v-model="onlyFreeAgents"
        @update:model-value="(val) => emitUpdate('onlyFreeAgents', val)"
        :color="themeAccentColor"
        label="Only Free Agents"
      />
    </div>
    <div class="settings-icon">
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
import {
  DAYS_ARRAY,
  HOCKEY_INJURY_LIST,
  HOCKEY_POSITION_OPTIONS,
  HOCKEY_TEAM_ABBR_TO_NAME,
  HOCKEY_TEAM_LIST,
} from "../constants";
import { getLocalStorage, setLocalStorage } from "../../utils/storage";

export default {
  props: {
    themeAccentColor: String,
  },
  data() {
    return {
      teamOptions: HOCKEY_TEAM_LIST,
      teamAbbrToName: HOCKEY_TEAM_ABBR_TO_NAME,
      injuryOptions: HOCKEY_INJURY_LIST,
      positionOptions: HOCKEY_POSITION_OPTIONS,
      daysOptions: DAYS_ARRAY,
      filter: "",
      teamSelections: [],
      injurySelections: [],
      positionSelections: [],
      gameDaysSelections: [],
      onlyFreeAgents: true,
      stateToStore: [
        // This may be redundant since it happens in above app area
        // I should move to vuex :P
        "filter",
        "teamSelections",
        "injurySelections",
        "positionSelections",
        "gameDaysSelections",
        "onlyFreeAgents",
      ],
    };
  },
  created() {
    this.stateToStore.forEach((item) => {
      // load state from store
      const val = getLocalStorage(item);
      if (val !== undefined && val !== null) {
        this[item] = val;
      }

      // Setup watcher to store info
      this.$watch(item, (val) => {
        setLocalStorage(item, val);
      });
    });
  },
  methods: {
    emitUpdate(key, val) {
      this.$emit("update", key, val);
    },
    toggleSettings() {
      this.$store.commit('toggleKeyValue', { key: 'nhl.openSettings' })
    }
  },
};
</script>

<style scoped>
.formContainer {
  display: flex;
  margin-bottom: 1em;
}

.settings-icon {
  flex-shrink: 1;
  padding: 0.5em;
}

.tall-checkbox {
  height: 38px;
}
</style>