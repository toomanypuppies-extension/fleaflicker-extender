<template>
  <va-modal
    :model-value="modelValue"
    @update:model-value="(value) => $emit('update:modelValue', value)"
    title="Columns"
    hide-default-actions
    close-button
    disable-attachment
    max-width="640px"
    :background-color="themeBaseColor"
  >
    <div class="columnsBody" :style="{ color: themeAccentColor }">
      <fieldset v-for="group in groups" :key="group.name" class="columnGroup">
        <legend>{{ group.name }}</legend>
        <p v-if="group.name === lastSeasonGroup" class="hint">Loaded from fleaflicker the first time you show one.</p>
        <div class="columnOptions">
          <va-checkbox
            v-for="column in group.columns"
            :key="column.key"
            :model-value="column.required || chosen.includes(column.key)"
            @update:model-value="(value) => setColumn(column.key, value)"
            :disabled="column.required"
            :color="themeAccentColor"
            :label="column.name"
            :title="column.title"
          />
        </div>
      </fieldset>
      <div class="actions">
        <va-button preset="secondary" :color="themeAccentColor" @click="reset">Reset to defaults</va-button>
      </div>
    </div>
  </va-modal>
</template>

<script>
import { mapGetters } from "vuex";
import { COLUMNS, COLUMN_GROUPS, DEFAULT_COLUMN_KEYS } from "../collections/columns";

export default {
  props: {
    modelValue: Boolean,
  },
  emits: ["update:modelValue"],
  data() {
    return {
      lastSeasonGroup: COLUMN_GROUPS.lastSeason,
    };
  },
  computed: {
    ...mapGetters([
      'themeBaseColor',
      'themeAccentColor'
    ]),
    groups() {
      return Object.values(COLUMN_GROUPS).map(name => ({
        name,
        columns: COLUMNS.filter(column => column.group === name),
      }));
    },
    chosen() {
      const keys = this.$store.state.visibleColumnKeys;
      return keys?.length ? keys : DEFAULT_COLUMN_KEYS;
    },
  },
  methods: {
    setColumn(key, shown) {
      const keys = this.chosen.filter(chosenKey => chosenKey !== key);
      this.$store.commit('setKeyValue', { key: 'visibleColumnKeys', value: shown ? [...keys, key] : keys });
    },
    reset() {
      this.$store.commit('setKeyValue', { key: 'visibleColumnKeys', value: [] });
    },
  },
};
</script>

<style scoped>
.columnGroup {
  border: none;
  padding: 0;
  margin: 0 0 1.25em;
}

.columnGroup legend {
  font-weight: 700;
  margin-bottom: 0.5em;
}

.columnOptions {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 0.6em;
}

.hint {
  font-size: 0.85em;
  opacity: 0.8;
  margin-bottom: 0.5em;
}

.actions {
  display: flex;
  justify-content: flex-end;
}
</style>
