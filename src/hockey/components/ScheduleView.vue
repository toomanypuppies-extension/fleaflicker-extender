<template>
  <div class="scheduleView containerColor">
    <p v-if="!schedule?.length" class="unavailable">The NHL schedule couldn't be loaded. Use Refresh to try again.</p>

    <template v-else>
      <div class="scheduleHeader">
        <WeekPicker v-if="periods.length" :periods="periods" :selected="selectedPeriod" :currentOrdinal="currentOrdinal"
          @select="selectPeriod" />
        <div v-else class="weekPicker" role="tablist" aria-label="Week">
          <button v-for="(week, index) in upcomingWeeks" :key="week.startDate" type="button" role="tab" class="weekButton"
            :class="{ active: index === weekIndex }" :aria-selected="index === weekIndex" @click="weekIndex = index">
            {{ weekLabel(week, index) }}
          </button>
        </div>
        <p class="legend">
          <span class="lightSwatch"></span>
          <span class="legendText">Light night</span>
          <HelpTip label="light nights">
            {{ lightNightMax }} or fewer games, so fewer fantasy players compete for lineup spots: a good night to stream.
          </HelpTip>
        </p>
      </div>

      <p v-if="loadingWeek" class="loadingWeek" role="status">Loading the NHL schedule for this week…</p>

      <div class="pickBar" role="status">
        <span v-if="anyPicked">{{ pickedSummary }} picked for the Players tab's filters</span>
        <span v-else class="pickHint">Check teams or days to filter the Players tab by them.</span>
        <button v-if="anyPicked" type="button" class="weekButton active" @click="showPickedTeams">
          Show their players
        </button>
        <button v-if="anyPicked" type="button" class="weekButton" @click="clearPicks">Clear</button>
      </div>

      <div class="gridScroller">
        <table class="scheduleGrid">
          <thead>
            <tr>
              <th class="teamColumn sortable" tabindex="0" :aria-sort="ariaSort('team')" @click="sortBy('team')"
                @keydown.enter="sortBy('team')">Team {{ sortArrow('team') }}</th>
              <th v-for="day in grid.days" :key="day.date" class="dayColumn"
                :class="{ light: day.light, past: day.past, pickedDay: isDayPicked(day) }">
                <label v-if="filterIndex(day) !== null" class="dayPick" :title="`Filter the Players tab to teams playing ${dayName(day)}`">
                  <input type="checkbox" :checked="isDayPicked(day)" @change="togglePickedDay(day)" />
                  <span class="dayName">{{ dayName(day) }}</span>
                </label>
                <span v-else class="dayName" title="The Players tab's Game Days filter covers this week and next">{{ dayName(day) }}</span>
                <span class="gameCount">{{ day.gameCount }} {{ day.gameCount === 1 ? 'game' : 'games' }}</span>
              </th>
              <th class="sortable total" :aria-sort="ariaSort('games')" tabindex="0" @click="sortBy('games')" @keydown.enter="sortBy('games')">Games {{ sortArrow('games') }}</th>
              <th class="sortable total" :aria-sort="ariaSort('lightGames')" tabindex="0" @click="sortBy('lightGames')" @keydown.enter="sortBy('lightGames')"
                title="Games on light nights">Light {{ sortArrow('lightGames') }}</th>
              <th v-if="showLeft" class="sortable total" :aria-sort="ariaSort('gamesLeft')" tabindex="0" @click="sortBy('gamesLeft')" @keydown.enter="sortBy('gamesLeft')"
                title="Games from today on">Left {{ sortArrow('gamesLeft') }}</th>
              <th v-if="showPickedGames" class="sortable total" :aria-sort="ariaSort('pickedGames')" tabindex="0" @click="sortBy('pickedGames')"
                @keydown.enter="sortBy('pickedGames')" title="Games on the checked days">Picked {{ sortArrow('pickedGames') }}</th>
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
                :class="{ light: grid.days[dayIndex].light, past: grid.days[dayIndex].past, hasGame: !!cell, pickedDay: isDayPicked(grid.days[dayIndex]) }"
                :title="cell ? `${cell.home ? 'Home vs' : 'At'} ${teamName(cell.opponent)}, ${gameTime(cell.start)}` : null">
                <template v-if="cell">
                  <span class="opponent">{{ `${cell.home ? '' : '@'}${cell.opponent}` }}</span>
                  <span class="gameTime">{{ gameTime(cell.start) }}</span>
                </template>
              </td>
              <td class="total">{{ row.games }}</td>
              <td class="total">{{ row.lightGames }}</td>
              <td v-if="showLeft" class="total">{{ row.gamesLeft }}</td>
              <td v-if="showPickedGames" class="total">{{ row.pickedGames }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<script>
import { HOCKEY_TEAM_ABBR_TO_NAME, HOCKEY_TEAM_NAME_TO_ABBR, DATE_MAP } from "../constants";
import { weekGrid, easternDate, LIGHT_NIGHT_MAX_GAMES } from "../collections/schedule";
import { currentPeriod } from "../collections/league";
import { weekStart, periodDates, periodSchedule, coversPeriod } from "../collections/scheduleWeeks";
import WeekPicker from "./WeekPicker.vue";
import HelpTip from "./HelpTip.vue";

const MINUTE = 60 * 1000;

// "2026-10-12" without time zone shifts
const dateParts = (date) => {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const DAY = 24 * 60 * MINUTE;

export default {
  components: { WeekPicker, HelpTip },
  // From Hockey, loads schedule weeks
  inject: { ensureSchedule: { default: () => async () => {} } },
  props: {
    // From convertSchedule, by date
    schedule: Array,
    // For its matchup weeks. Without it the schedule's own weeks are shown.
    league: Object,
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
    periods() {
      return this.league?.scoreboard?.periods || [];
    },
    currentOrdinal() {
      return currentPeriod(this.league?.scoreboard, this.now)?.ordinal;
    },
    // Shared with the Matchups tab
    selectedPeriod() {
      const ordinal = this.$store.state.selectedPeriod ?? this.currentOrdinal;
      return this.periods.find(period => period.ordinal === ordinal) || null;
    },
    loadingWeek() {
      return !!this.selectedPeriod && !coversPeriod(this.schedule, this.selectedPeriod);
    },
    // The matchup week's days, or without matchup weeks the schedule's week
    shownWeek() {
      if (this.selectedPeriod) {
        return periodSchedule(this.schedule, this.selectedPeriod);
      }
      return this.upcomingWeeks[this.weekIndex];
    },
    // The schedule's weeks from this one on
    upcomingWeeks() {
      const thisWeek = weekStart(easternDate(this.now));
      return (this.schedule || []).filter(week => week.startDate >= thisWeek);
    },
    grid() {
      return weekGrid(this.shownWeek, { now: this.now });
    },
    // Games from today on, for the week that's under way
    showLeft() {
      return this.selectedPeriod ? this.selectedPeriod.ordinal === this.currentOrdinal : this.weekIndex === 0;
    },
    // Days checked here are the Players tab's Game Days filter, by DATE_MAP label
    pickedDays() {
      return new Set(this.$store.state.gameDaysSelections);
    },
    anyPicked() {
      return this.pickedTeams.size > 0 || this.pickedDays.size > 0;
    },
    pickedSummary() {
      const count = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
      return [
        this.pickedTeams.size && count(this.pickedTeams.size, 'team'),
        this.pickedDays.size && count(this.pickedDays.size, 'day'),
      ].filter(Boolean).join(' and ');
    },
    // Only when a checked day is in the week shown
    showPickedGames() {
      return this.grid.days.some(day => this.isDayPicked(day));
    },
    // Each team with its games on the checked days
    teamRows() {
      return this.grid.teams.map(row => ({
        ...row,
        pickedGames: row.cells.filter((cell, index) => cell && this.isDayPicked(this.grid.days[index])).length,
      }));
    },
    sortedTeams() {
      const { key, desc } = this.sort;
      const direction = desc ? -1 : 1;
      return this.teamRows.slice().sort((a, b) => {
        if (key === 'team') {
          return direction * a.team.localeCompare(b.team);
        }
        // Ties go to the team with more light night games, then alphabetical
        return direction * (a[key] - b[key]) || b.lightGames - a.lightGames || a.team.localeCompare(b.team);
      });
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
    // In the viewer's time zone, like 7:00 PM
    gameTime(start) {
      return start ? new Date(start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
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
    clearPicks() {
      this.$store.commit('setKeyValue', { key: 'teamSelections', value: [] });
      this.$store.commit('setKeyValue', { key: 'gameDaysSelections', value: [] });
    },
    showPickedTeams() {
      this.$store.commit('setKeyValue', { key: 'activeTab', value: 'players' });
    },
    // The Players tab's Game Days filter covers this week and next: the day's place in them, or null
    filterIndex(day) {
      const monday = weekStart(easternDate(this.now));
      const index = Math.round((dateParts(day.date) - dateParts(monday)) / DAY);
      return index >= 0 && index < 14 ? index : null;
    },
    isDayPicked(day) {
      const index = this.filterIndex(day);
      return index !== null && this.pickedDays.has(DATE_MAP[index]);
    },
    togglePickedDay(day) {
      const label = DATE_MAP[this.filterIndex(day)];
      const selections = this.$store.state.gameDaysSelections;
      const picked = selections.includes(label) ? selections.filter(selected => selected !== label) : [...selections, label];
      // In the filter's order, Monday first
      const value = Object.values(DATE_MAP).filter(option => picked.includes(option));
      this.$store.commit('setKeyValue', { key: 'gameDaysSelections', value });
    },
    selectPeriod(ordinal) {
      this.$store.commit('setKeyValue', { key: 'selectedPeriod', value: ordinal === this.currentOrdinal ? null : ordinal });
    },
    loadWeek() {
      if (this.selectedPeriod) {
        this.ensureSchedule(periodDates(this.selectedPeriod));
      }
    },
  },
  watch: {
    'selectedPeriod.ordinal'() {
      this.loadWeek();
    },
  },
  mounted() {
    this.loadWeek();
    // Days move into the past
    this.clock = setInterval(() => { this.now = Date.now(); }, 10 * MINUTE);
  },
  beforeUnmount() {
    clearInterval(this.clock);
  },
};
</script>

<style lang="scss" scoped>
.loadingWeek {
  font-size: 0.9em;
  opacity: 0.85;
  margin: 0;
}

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

// No opacity here: it would keep the help panel under the grid's sticky headers
.legend {
  display: flex;
  align-items: center;
  gap: 0.4em;
  font-size: 0.9em;
  margin: 0;
}

.legendText {
  opacity: 0.85;
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

  td.pickedDay {
    box-shadow: inset 2px 0 0 var(--teamSecondaryColor), inset -2px 0 0 var(--teamSecondaryColor);
  }

  thead th.pickedDay {
    box-shadow: inset 2px 0 0 var(--teamSecondaryColor), inset -2px 0 0 var(--teamSecondaryColor), inset 0 -2px 0 var(--themeAccentColor);
  }

  .sortable {
    cursor: pointer;

    &:hover {
      text-decoration: underline;
    }
  }
}

.dayName,
.gameCount,
.opponent,
.gameTime {
  display: block;
}

.gameTime {
  font-size: 0.75em;
  font-weight: normal;
  opacity: 0.8;
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

.dayPick {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.3em;
  margin: 0;
  cursor: pointer;
  min-height: 28px;

  input {
    width: 16px;
    height: 16px;
    margin: 0;
    cursor: pointer;
    accent-color: var(--teamSecondaryColor);
  }
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
