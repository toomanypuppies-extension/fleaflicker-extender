<template>
  <div class="scheduleView containerColor">
    <p v-if="!schedule?.length" class="unavailable">The NHL schedule couldn't be loaded. Use Refresh to try again.</p>

    <template v-else>
      <div class="scheduleHeader">
        <div class="weekPicker" role="tablist" aria-label="Week">
          <button v-for="(week, index) in schedule" :key="week.startDate" type="button" role="tab" class="weekButton"
            :class="{ active: index === weekIndex }" :aria-selected="index === weekIndex" @click="weekIndex = index">
            {{ weekLabel(week, index) }}
          </button>
        </div>
        <p class="legend">
          <span class="lightSwatch"></span>
          Light night: {{ lightNightMax }} or fewer games, so fewer players compete for lineup spots.
        </p>
      </div>

      <div class="pickBar" role="status">
        <span v-if="pickedTeams.size">
          {{ pickedTeams.size }} {{ pickedTeams.size === 1 ? 'team' : 'teams' }} picked for the Players tab's Teams filter
        </span>
        <span v-else class="pickHint">Check teams to filter the Players tab by them.</span>
        <button v-if="pickedTeams.size" type="button" class="weekButton active" @click="showPickedTeams">
          Show their players
        </button>
        <button v-if="pickedTeams.size" type="button" class="weekButton" @click="clearPickedTeams">Clear</button>
      </div>

      <div class="gridScroller">
        <table class="scheduleGrid">
          <thead>
            <tr>
              <th class="teamColumn sortable" tabindex="0" :aria-sort="ariaSort('team')" @click="sortBy('team')"
                @keydown.enter="sortBy('team')">Team {{ sortArrow('team') }}</th>
              <th v-for="(day, dayIndex) in grid.days" :key="day.date" class="dayColumn"
                :class="{ light: day.light, past: day.past, clickable: canFilterDay }"
                :title="canFilterDay ? `Show players on teams playing ${dayName(day)}` : null"
                :tabindex="canFilterDay ? 0 : null" @click="canFilterDay && showDay(dayIndex)"
                @keydown.enter="canFilterDay && showDay(dayIndex)">
                <span class="dayName">{{ dayName(day) }}</span>
                <span class="gameCount">{{ day.gameCount }} {{ day.gameCount === 1 ? 'game' : 'games' }}</span>
              </th>
              <th class="sortable total" :aria-sort="ariaSort('games')" tabindex="0" @click="sortBy('games')" @keydown.enter="sortBy('games')">Games {{ sortArrow('games') }}</th>
              <th class="sortable total" :aria-sort="ariaSort('lightGames')" tabindex="0" @click="sortBy('lightGames')" @keydown.enter="sortBy('lightGames')"
                title="Games on light nights">Light {{ sortArrow('lightGames') }}</th>
              <th v-if="weekIndex === 0" class="sortable total" :aria-sort="ariaSort('gamesLeft')" tabindex="0" @click="sortBy('gamesLeft')" @keydown.enter="sortBy('gamesLeft')"
                title="Games from today on">Left {{ sortArrow('gamesLeft') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in sortedTeams" :key="row.team" :class="{ picked: pickedTeams.has(row.team) }">
              <th scope="row" class="teamColumn">
                <label class="teamPick" :title="teamName(row.team)">
                  <input type="checkbox" :checked="pickedTeams.has(row.team)" @change="togglePickedTeam(row.team)" />
                  {{ row.team }}
                </label>
              </th>
              <td v-for="(cell, dayIndex) in row.cells" :key="dayIndex"
                :class="{ light: grid.days[dayIndex].light, past: grid.days[dayIndex].past, hasGame: !!cell }"
                :title="cell ? `${cell.home ? 'Home vs' : 'At'} ${teamName(cell.opponent)}` : null">
                {{ cell ? `${cell.home ? '' : '@'}${cell.opponent}` : '' }}
              </td>
              <td class="total">{{ row.games }}</td>
              <td class="total">{{ row.lightGames }}</td>
              <td v-if="weekIndex === 0" class="total">{{ row.gamesLeft }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<script>
import { HOCKEY_TEAM_ABBR_TO_NAME, HOCKEY_TEAM_NAME_TO_ABBR, DATE_MAP } from "../constants";
import { weekGrid, LIGHT_NIGHT_MAX_GAMES } from "../collections/schedule";

const MINUTE = 60 * 1000;

// "2026-10-12" without time zone shifts
const dateParts = (date) => {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export default {
  props: {
    // From convertSchedule, this week first
    schedule: Array,
  },
  data() {
    return {
      weekIndex: 0,
      sort: { key: 'games', desc: true },
      lightNightMax: LIGHT_NIGHT_MAX_GAMES,
      now: Date.now(),
      clock: null,
    };
  },
  computed: {
    // Teams checked here are the Players tab's Teams filter, by abbreviation
    pickedTeams() {
      return new Set(this.$store.state.teamSelections.map(name => HOCKEY_TEAM_NAME_TO_ABBR[name]).filter(Boolean));
    },
    grid() {
      return weekGrid(this.schedule?.[this.weekIndex], { now: this.now });
    },
    sortedTeams() {
      const { key, desc } = this.sort;
      const direction = desc ? -1 : 1;
      return this.grid.teams.slice().sort((a, b) => {
        if (key === 'team') {
          return direction * a.team.localeCompare(b.team);
        }
        // Ties go to the team with more light night games, then alphabetical
        return direction * (a[key] - b[key]) || b.lightGames - a.lightGames || a.team.localeCompare(b.team);
      });
    },
    // Game Days filters only cover this week and next
    canFilterDay() {
      return this.weekIndex < 2;
    },
  },
  methods: {
    weekLabel(week, index) {
      if (index === 0) return 'This week';
      if (index === 1) return 'Next week';
      const start = dateParts(week.startDate);
      return `Week of ${start.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
    },
    dayName(day) {
      return dateParts(day.date).toLocaleDateString([], { weekday: 'short', day: 'numeric' });
    },
    teamName(team) {
      return HOCKEY_TEAM_ABBR_TO_NAME[team] || team;
    },
    sortBy(key) {
      this.sort = this.sort.key === key
        ? { key, desc: !this.sort.desc }
        : { key, desc: key !== 'team' };
    },
    sortArrow(key) {
      if (this.sort.key !== key) return '';
      return this.sort.desc ? '▾' : '▴';
    },
    ariaSort(key) {
      if (this.sort.key !== key) return 'none';
      return this.sort.desc ? 'descending' : 'ascending';
    },
    togglePickedTeam(team) {
      const name = this.teamName(team);
      const selections = this.$store.state.teamSelections;
      const value = selections.includes(name) ? selections.filter(selected => selected !== name) : [...selections, name];
      this.$store.commit('setKeyValue', { key: 'teamSelections', value });
    },
    clearPickedTeams() {
      this.$store.commit('setKeyValue', { key: 'teamSelections', value: [] });
    },
    showPickedTeams() {
      this.$store.commit('setKeyValue', { key: 'activeTab', value: 'players' });
    },
    showDay(dayIndex) {
      this.$store.commit('setKeyValue', { key: 'gameDaysSelections', value: [DATE_MAP[this.weekIndex * 7 + dayIndex]] });
      this.$store.commit('setKeyValue', { key: 'activeTab', value: 'players' });
    },
  },
  mounted() {
    // Days move into the past
    this.clock = setInterval(() => { this.now = Date.now(); }, 10 * MINUTE);
  },
  beforeUnmount() {
    clearInterval(this.clock);
  },
};
</script>

<style lang="scss" scoped>
.scheduleView {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1 1 auto;
  padding: 0.75em;
  gap: 0.75em;
}

.unavailable {
  padding: 2em;
  text-align: center;
}

.scheduleHeader {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75em;
}

.weekPicker {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25em;
}

.weekButton {
  font: inherit;
  color: inherit;
  background: none;
  border: 1px solid currentColor;
  border-radius: 4px;
  padding: 0.35em 0.8em;
  min-height: 36px;
  cursor: pointer;
  opacity: 0.75;

  &.active {
    opacity: 1;
    background: var(--teamSecondaryColor30Opacity);
    border-color: var(--teamSecondaryColor);
    font-weight: 700;
  }

  &:focus-visible {
    outline: 2px solid var(--teamSecondaryColor);
  }
}

.legend {
  display: flex;
  align-items: center;
  gap: 0.4em;
  font-size: 0.9em;
  opacity: 0.85;
  margin: 0;
}

.lightSwatch {
  display: inline-block;
  width: 1em;
  height: 1em;
  background: var(--teamSecondaryColor30Opacity);
  border: 1px solid var(--teamSecondaryColor);
}

.gridScroller {
  overflow: auto;
  min-height: 0;
  flex: 1 1 auto;
}

.scheduleGrid {
  border-collapse: collapse;
  min-width: 100%;
  background: none;

  th,
  td {
    padding: 0.45em 0.6em;
    text-align: center;
    white-space: nowrap;
    border-bottom: 1px solid rgba(127, 127, 127, 0.2);
  }

  thead th {
    position: sticky;
    top: 0;
    z-index: 2;
    background: var(--themeBaseColor);
    box-shadow: inset 0 -2px 0 var(--themeAccentColor);
    font-weight: 700;
    vertical-align: bottom;
    user-select: none;
  }

  .teamColumn {
    position: sticky;
    left: 0;
    z-index: 1;
    background: var(--themeBaseColor);
    text-align: left;
  }

  thead .teamColumn {
    z-index: 3;
  }

  .light {
    background: var(--teamSecondaryColor30Opacity);
  }

  thead th.light {
    background: color-mix(in srgb, var(--teamSecondaryColor) 30%, var(--themeBaseColor));
  }

  td.past {
    opacity: 0.45;
  }

  // Not the header cell itself, its background has to cover rows scrolling under it
  thead th.past > span {
    opacity: 0.45;
  }

  td.hasGame {
    font-weight: 600;
  }

  .total {
    font-weight: 700;
  }

  .sortable,
  .clickable {
    cursor: pointer;

    &:hover {
      text-decoration: underline;
    }
  }
}

.dayName,
.gameCount {
  display: block;
}

.gameCount {
  font-size: 0.8em;
  font-weight: normal;
  opacity: 0.85;
}

.pickBar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5em;
  min-height: 36px;
}

.pickHint {
  opacity: 0.75;
  font-size: 0.9em;
}

.scheduleGrid tr.picked td,
.scheduleGrid tr.picked th {
  background-image: linear-gradient(var(--teamSecondaryColor30Opacity), var(--teamSecondaryColor30Opacity));
}

.teamPick {
  display: flex;
  align-items: center;
  gap: 0.4em;
  font-weight: 700;
  margin: 0;
  cursor: pointer;
  min-height: 32px;

  input {
    width: 18px;
    height: 18px;
    margin: 0;
    cursor: pointer;
    accent-color: var(--teamSecondaryColor);
  }
}

</style>
