<template>
  <div class="weekBar">
    <span class="weekPicker">
      <button type="button" class="iconButton" :disabled="!previous" aria-label="Previous week"
        @click="$emit('select', previous.ordinal)">
        <span class="material-icons" aria-hidden="true">chevron_left</span>
      </button>
      <select :value="selected?.ordinal" aria-label="Week" @change="$emit('select', parseInt($event.target.value, 10))">
        <option v-for="period in periods" :key="period.ordinal" :value="period.ordinal">{{ label(period) }}</option>
      </select>
      <button type="button" class="iconButton" :disabled="!next" aria-label="Next week"
        @click="$emit('select', next.ordinal)">
        <span class="material-icons" aria-hidden="true">chevron_right</span>
      </button>
    </span>
    <button v-if="selected && selected.ordinal !== currentOrdinal" type="button" class="textButton"
      @click="$emit('select', currentOrdinal)">Back to this week</button>
  </div>
</template>

<script>
/**
 * Picks a matchup period (week) of the season. The Matchups tab and the Schedule tab
 * share it, through the store's selectedPeriod.
 */
export default {
  props: {
    // The scoreboard's periods
    periods: Array,
    selected: Object,
    currentOrdinal: Number,
  },
  emits: ['select'],
  computed: {
    index() {
      return this.periods.indexOf(this.selected);
    },
    previous() {
      return this.index > 0 ? this.periods[this.index - 1] : null;
    },
    next() {
      return this.index >= 0 ? this.periods[this.index + 1] || null : null;
    },
  },
  methods: {
    label(period) {
      const day = (time) => new Date(time).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
      const current = period.ordinal === this.currentOrdinal ? ' (this week)' : '';
      return `Matchup ${period.ordinal}: ${day(period.start)} to ${day(period.lastDayStart)}${current}`;
    },
  },
};
</script>

<style lang="scss" scoped>
.weekBar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5em;
  // As a flex item (the Schedule tab's header) it would otherwise stay as wide as the longest
  // week's name and overflow on phones
  min-width: 0;
  max-width: 100%;

  select {
    flex: 0 1 auto;
    min-width: 0;
    max-width: 100%;
    text-overflow: ellipsis;
    font: inherit;
    font-weight: 700;
    color: inherit;
    background: var(--themeBaseColor);
    border: 1px solid currentColor;
    border-radius: 4px;
    padding: 0.3em 0.5em;
    min-height: 36px;
  }
}

// The arrows stay beside the week on phones, the week's name shrinks instead
.weekPicker {
  display: flex;
  align-items: center;
  gap: 0.5em;
  min-width: 0;
  max-width: 100%;
}

.iconButton {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  font: inherit;
  color: inherit;
  background: none;
  border: 1px solid rgba(127, 127, 127, 0.6);
  border-radius: 4px;
  cursor: pointer;

  &:disabled {
    opacity: 0.35;
    cursor: default;
  }
}

.textButton {
  font: inherit;
  color: inherit;
  background: none;
  border: none;
  text-decoration: underline;
  cursor: pointer;
  padding: 0.25em;
}
</style>
