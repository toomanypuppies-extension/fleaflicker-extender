<template>
  <figure class="barChart">
    <figcaption class="chartHeader">
      <span class="chartTitle">{{ title }}</span>
      <button type="button" class="tableToggle" :aria-pressed="showTable" @click="showTable = !showTable">
        {{ showTable ? 'Show chart' : 'Show table' }}
      </button>
    </figcaption>

    <ul v-if="series.length > 1 || stacked" class="legend">
      <li v-for="(item, index) in series" v-show="series.length > 1" :key="item.name">
        <span class="swatch" :style="{ background: seriesColor(index) }"></span>{{ item.name }}
      </li>
      <template v-if="stacked">
        <li v-for="(label, part) in partLabels" :key="label">
          <span class="swatch partSwatch" :class="{ projected: part === 1 }"></span>{{ label }}
        </li>
      </template>
    </ul>

    <table v-if="showTable" class="chartTable">
      <thead>
        <tr>
          <th scope="col">{{ rowHeading }}</th>
          <template v-for="item in series" :key="item.name">
            <template v-if="stacked">
              <th v-for="label in partLabels" :key="label" scope="col">
                {{ series.length > 1 ? `${item.name}: ` : '' }}{{ label }}
              </th>
            </template>
            <th v-else scope="col">{{ item.name }}</th>
          </template>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.key">
          <th scope="row">{{ row.label }}</th>
          <template v-for="(value, index) in row.values" :key="index">
            <template v-if="stacked">
              <td v-for="(part, partIndex) in parts(value)" :key="partIndex">{{ format(part) }}</td>
            </template>
            <td v-else>{{ format(value) }}</td>
          </template>
        </tr>
      </tbody>
    </table>

    <div v-else class="plot" @pointerleave="hovered = null">
      <div v-for="row in rows" :key="row.key" class="row">
        <span class="rowLabel" :title="row.label">{{ row.label }}</span>
        <span class="track">
          <span class="baseline" :style="{ left: percent(zeroAt) }"></span>
          <span v-for="(value, index) in row.values" :key="index" class="barLine">
            <template v-for="(segment, part) in segments(value)" :key="part">
              <span v-if="segment.value !== 0 || part === 0" class="bar" tabindex="0" role="img"
                :class="{
                  negative: segment.value < 0,
                  projected: part === 1,
                  inner: part === 0 && segments(value)[1]?.value > 0,
                  active: isHovered(row, index, part),
                }"
                :style="segmentStyle(segment, index)"
                :aria-label="`${series[index].name}, ${row.label}: ${format(segment.value)}${stacked ? ` ${partLabels[part].toLowerCase()}` : ''}`"
                @pointerenter="hover(row, index, part, $event)" @focus="hover(row, index, part, $event)" @blur="hovered = null"></span>
            </template>
            <span class="value" :style="valueStyle(total(value))">{{ format(total(value)) }}</span>
          </span>
        </span>
      </div>
      <div v-if="hovered" class="tooltip" role="status" :style="hovered.position">
        <strong>{{ format(hovered.value) }}</strong>
        <span class="tooltipKey" :class="{ projected: hovered.part === 1 }" :style="{ background: seriesColor(hovered.index) }"></span>
        {{ series[hovered.index].name }} · {{ hovered.row.label }}<template v-if="stacked"> · {{ partLabels[hovered.part].toLowerCase() }}</template>
        <span v-if="hovered.detail" class="tooltipDetail">{{ hovered.detail }}</span>
      </div>
    </div>
  </figure>
</template>

<script>
export default {
  props: {
    title: String,
    // Heading of the label column in the table view
    rowHeading: { type: String, default: '' },
    // [{ name }], at most two
    series: Array,
    // [{ key, label, values: [one per series], details: [string per series] }]. A value is a number,
    // or with `stacked` a [scored, projected] pair drawn as one bar, the projected part lighter.
    rows: Array,
    stacked: Boolean,
    partLabels: { type: Array, default: () => ['Scored', 'Projected'] },
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
    // Bars grow from zero, left for negative values. Stacked parts follow each other.
    domain() {
      const ends = this.rows.flatMap(row => row.values.flatMap(value => this.segments(value).map(segment => segment.end)));
      const min = Math.min(0, ...ends);
      const max = Math.max(0, ...ends);
      return { min, max, span: max - min || 1 };
    },
    zeroAt() {
      return -this.domain.min / this.domain.span;
    },
  },
  methods: {
    seriesColor(index) {
      return this.$store.getters.chartColors[index + this.colorOffset];
    },
    parts(value) {
      return Array.isArray(value) ? value : [value, 0];
    },
    total(value) {
      return this.parts(value).reduce((sum, part) => sum + (part || 0), 0);
    },
    // Each part from where the one before it ended: [{ value, start, end }]
    segments(value) {
      let start = 0;
      return (this.stacked ? this.parts(value) : [value]).map(part => {
        const segment = { value: part || 0, start, end: start + (part || 0) };
        start = segment.end;
        return segment;
      });
    },
    format(value) {
      return value === null || value === undefined ? '–' : value.toFixed(this.digits);
    },
    percent(fraction) {
      return `${fraction * 100}%`;
    },
    position(value) {
      return (value - this.domain.min) / this.domain.span;
    },
    segmentStyle(segment, index) {
      const [from, to] = [segment.start, segment.end].map(this.position).sort((a, b) => a - b);
      return {
        left: this.percent(from),
        width: this.percent(to - from),
        background: this.seriesColor(index),
      };
    },
    // The value sits past the bar's end: right of positive bars, left of negative ones
    valueStyle(value) {
      const end = this.position(value);
      return value < 0 ? { right: this.percent(1 - end) } : { left: this.percent(end) };
    },
    hover(row, index, part, event) {
      const plot = event.target.closest('.plot');
      const plotBox = plot.getBoundingClientRect();
      const bar = event.target.getBoundingClientRect();
      // Below bars in the top half, above those in the bottom half, so the tooltip stays over the
      // chart. One that hung past the bottom could make the page scroll, move the bar away from the
      // pointer and flicker.
      const position = bar.top - plotBox.top < plotBox.height / 2
        ? { top: `${bar.bottom - plotBox.top + 4}px` }
        : { bottom: `${plotBox.bottom - bar.top + 4}px` };
      const value = this.stacked ? this.parts(row.values[index])[part] : row.values[index];
      const detail = this.stacked ? row.details?.[index]?.[part] : row.details?.[index];
      this.hovered = { row, index, part, value, detail, position };
    },
    isHovered(row, index, part) {
      return this.hovered?.row.key === row.key && this.hovered.index === index && this.hovered.part === part;
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

// Scored and projected apply to every series, so their key is neutral
.partSwatch {
  background: currentColor;
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
  overflow-wrap: anywhere;
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

// A stacked bar's first part ends square against the next, which starts after a 2px gap
.bar.inner {
  border-radius: 0;
}

.bar.projected {
  border-left: 2px solid var(--themeBaseColor);
  background-clip: padding-box;
}

// Projected points: the series' color, lighter, so the scored part reads first
.bar.projected,
.swatch.projected,
.tooltipKey.projected {
  opacity: 0.45;
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
