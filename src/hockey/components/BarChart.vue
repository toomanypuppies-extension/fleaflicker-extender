<template>
  <figure class="barChart">
    <figcaption class="chartHeader">
      <span class="chartTitle">{{ title }}</span>
      <button type="button" class="tableToggle" :aria-pressed="showTable" @click="showTable = !showTable">
        {{ showTable ? 'Show chart' : 'Show table' }}
      </button>
    </figcaption>

    <ul v-if="series.length > 1" class="legend">
      <li v-for="(item, index) in series" :key="item.name">
        <span class="swatch" :style="{ background: seriesColor(index) }"></span>{{ item.name }}
      </li>
    </ul>

    <table v-if="showTable" class="chartTable">
      <thead>
        <tr>
          <th scope="col">{{ rowHeading }}</th>
          <th v-for="item in series" :key="item.name" scope="col">{{ item.name }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.key">
          <th scope="row">{{ row.label }}</th>
          <td v-for="(value, index) in row.values" :key="index">{{ format(value) }}</td>
        </tr>
      </tbody>
    </table>

    <div v-else class="plot" @pointerleave="hovered = null">
      <div v-for="row in rows" :key="row.key" class="row">
        <span class="rowLabel" :title="row.label">{{ row.label }}</span>
        <span class="track">
          <span class="baseline" :style="{ left: percent(zeroAt) }"></span>
          <span v-for="(value, index) in row.values" :key="index" class="barLine">
            <span class="bar" tabindex="0" role="img"
              :class="{ negative: value < 0, active: isHovered(row, index) }"
              :style="barStyle(value, index)"
              :aria-label="`${series[index].name}, ${row.label}: ${format(value)}`"
              @pointerenter="hover(row, index, $event)" @focus="hover(row, index, $event)" @blur="hovered = null"></span>
            <span class="value" :style="valueStyle(value)">{{ format(value) }}</span>
          </span>
        </span>
      </div>
      <div v-if="hovered" class="tooltip" role="status" :style="{ top: `${hovered.top}px` }">
        <strong>{{ format(hovered.value) }}</strong>
        <span class="tooltipKey" :style="{ background: seriesColor(hovered.index) }"></span>
        {{ series[hovered.index].name }} · {{ hovered.row.label }}
        <span v-if="hovered.detail" class="tooltipDetail">{{ hovered.detail }}</span>
      </div>
    </div>
  </figure>
</template>

<script>
import { mapState } from "vuex";
import { seriesColor } from "../chartColors";

export default {
  props: {
    title: String,
    // Heading of the label column in the table view
    rowHeading: { type: String, default: '' },
    // [{ name }], at most two
    series: Array,
    // [{ key, label, values: [number per series], details: [string per series] }]
    rows: Array,
    digits: { type: Number, default: 1 },
    // Colors start from this series slot, so a chart of only the second team uses its color
    colorOffset: { type: Number, default: 0 },
  },
  data() {
    return {
      showTable: false,
      hovered: null,
    };
  },
  computed: {
    ...mapState({
      darkMode: state => state.settings.darkMode,
    }),
    // Bars grow from zero, left for negative values
    domain() {
      const values = this.rows.flatMap(row => row.values);
      const min = Math.min(0, ...values);
      const max = Math.max(0, ...values);
      return { min, max, span: max - min || 1 };
    },
    zeroAt() {
      return -this.domain.min / this.domain.span;
    },
  },
  methods: {
    seriesColor(index) {
      return seriesColor(index + this.colorOffset, this.darkMode);
    },
    format(value) {
      return value === null || value === undefined ? '–' : value.toFixed(this.digits);
    },
    percent(fraction) {
      return `${fraction * 100}%`;
    },
    barStyle(value, index) {
      const width = Math.abs(value) / this.domain.span;
      const left = value < 0 ? this.zeroAt - width : this.zeroAt;
      return {
        left: this.percent(left),
        width: this.percent(width),
        background: this.seriesColor(index),
      };
    },
    // The value sits past the bar's end: right of positive bars, left of negative ones
    valueStyle(value) {
      const width = Math.abs(value) / this.domain.span;
      return value < 0
        ? { right: this.percent(1 - (this.zeroAt - width)) }
        : { left: this.percent(this.zeroAt + width) };
    },
    hover(row, index, event) {
      const plot = event.target.closest('.plot');
      const top = event.target.getBoundingClientRect().bottom - plot.getBoundingClientRect().top + 4;
      this.hovered = { row, index, value: row.values[index], detail: row.details?.[index], top };
    },
    isHovered(row, index) {
      return this.hovered?.row.key === row.key && this.hovered.index === index;
    },
  },
};
</script>

<style lang="scss" scoped>
.barChart {
  margin: 0;
  min-width: 0;
}

.chartHeader {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5em;
  margin-bottom: 0.4em;
}

.chartTitle {
  font-weight: 700;
}

.tableToggle {
  font: inherit;
  font-size: 0.85em;
  color: inherit;
  background: none;
  border: none;
  text-decoration: underline;
  cursor: pointer;
  padding: 0.25em;
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25em 1em;
  list-style: none;
  margin: 0 0 0.5em;
  padding: 0;
  font-size: 0.9em;

  li {
    display: flex;
    align-items: center;
    gap: 0.4em;
    min-width: 0;
  }
}

.swatch {
  flex: none;
  width: 12px;
  height: 12px;
  border-radius: 3px;
}

.plot {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.row {
  display: grid;
  grid-template-columns: minmax(4em, 13em) minmax(0, 1fr);
  align-items: center;
  gap: 0.5em;
}

.rowLabel {
  font-size: 0.9em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

// Room on both sides for values past the bar ends
.track {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0 3.5em;
}

.baseline {
  position: absolute;
  top: -2px;
  bottom: -2px;
  width: 1px;
  background: currentColor;
  opacity: 0.35;
}

.barLine {
  position: relative;
  height: 14px;
}

// 4px rounded data end, square at the baseline
.bar {
  position: absolute;
  top: 0;
  bottom: 0;
  min-width: 1px;
  border-radius: 0 4px 4px 0;
  outline-offset: 2px;

  &.negative {
    border-radius: 4px 0 0 4px;
  }

  &.active {
    filter: brightness(1.15);
    box-shadow: 0 0 0 2px currentColor;
  }
}

.value {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  padding: 0 0.35em;
  font-size: 0.8em;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  opacity: 0.85;
  pointer-events: none;
}

.tooltip {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.2em 0.5em;
  max-width: min(22em, 100%);
  padding: 0.4em 0.6em;
  font-size: 0.85em;
  color: var(--themeAccentColor);
  background: var(--themeBaseColor);
  border: 1px solid rgba(127, 127, 127, 0.5);
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  pointer-events: none;

  strong {
    font-size: 1.1em;
  }
}

.tooltipKey {
  width: 12px;
  height: 2px;
}

.tooltipDetail {
  flex-basis: 100%;
  opacity: 0.8;
}

.chartTable {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9em;

  th,
  td {
    padding: 0.25em 0.5em;
    border-bottom: 1px solid rgba(127, 127, 127, 0.3);
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  th:first-child {
    text-align: left;
  }
}
</style>
