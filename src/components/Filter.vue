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
    <div class="h-flex">
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

        <va-checkbox
          v-model="mustHaveGameToday"
          @update:model-value="(val) => emitUpdate('mustHaveGameToday', val)"
          :color="themeAccentColor"
          label="Has Game Today"
        />
        <span class="spacer"></span>

        <va-checkbox
          v-model="onlyFreeAgents"
          @update:model-value="(val) => emitUpdate('onlyFreeAgents', val)"
          :color="themeAccentColor"
          label="Only Free Agents"
        />
      </div>
      <div>
        <va-icon
          @click="$emit('toggleSettings')"
          :color="themeAccentColor"
          class="material-icons"
          size="medium"
          >settings</va-icon
        >
      </div>
    </div>
  </div>
</template>

<script>
import {
  DAYS_ARRAY,
  INJURY_LIST,
  POSITION_OPTIONS,
  TEAM_ABBR_TO_NAME,
  TEAM_LIST,
} from "../contants";
import { getStore, setStore } from "../utils/storage";

export default {
  props: {
    themeAccentColor: String,
  },
  data() {
    return {
      teamOptions: TEAM_LIST,
      teamAbbrToName: TEAM_ABBR_TO_NAME,
      injuryOptions: INJURY_LIST,
      positionOptions: POSITION_OPTIONS,
      daysOptions: DAYS_ARRAY,
      filter: "",
      teamSelections: [],
      injurySelections: [],
      positionSelections: [],
      gameDaysSelections: [],
      mustHaveGameToday: false,
      onlyFreeAgents: true,
      stateToStore: [
        // This may be redundant since it happens in above app area
        // I should move to vuex :P
        "filter",
        "teamSelections",
        "injurySelections",
        "positionSelections",
        "gameDaysSelections",
        "mustHaveGameToday",
        "onlyFreeAgents",
      ],
    };
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
  },
  methods: {
    emitUpdate(key, val) {
      this.$emit("update", key, val);
    },
  },
};
</script>

<style scoped>
.formContainer {
  display: flex;
  margin-bottom: 1em;
}
</style>