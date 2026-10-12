<template>
  <div class="matchupView">
    <div class="viewHeader">
      <button type="button" class="backButton" @click="$emit('close')">
        <span class="material-icons" aria-hidden="true">arrow_back</span> All matchups
      </button>
      <h2>{{ teamName(teamIds[0]) }} vs {{ teamName(teamIds[1]) }}</h2>
      <a class="fleaLink" :href="matchupLink" :target="fleaTarget" @click="leavingForFleaflicker">
        Matchup on Fleaflicker <span class="material-icons" aria-hidden="true">open_in_new</span>
      </a>
    </div>

    <div class="weekPager">
      <button type="button" class="pageButton" :disabled="!previousPeriod" @click="page(-1)">
        <span class="material-icons" aria-hidden="true">chevron_left</span>
        <span>Week {{ previousPeriod?.ordinal ?? '' }}</span>
      </button>
      <span class="periodLabel">
        Matchup {{ period.ordinal }}: {{ formatDay(period.start) }} to {{ formatDay(period.lastDayStart) }}
        <span class="pagerNote">{{ teamName(teamIds[0]) }}, week by week</span>
      </span>
      <button type="button" class="pageButton" :disabled="!nextPeriod" @click="page(1)">
        <span>Week {{ nextPeriod?.ordinal ?? '' }}</span>
        <span class="material-icons" aria-hidden="true">chevron_right</span>
      </button>
    </div>

    <section class="projectionSection containerColor" aria-labelledby="projectionHeading">
      <div class="sectionHeader">
        <h3 id="projectionHeading">{{ phase === 'past' ? 'Result' : 'Projection' }}</h3>
        <div v-if="phase !== 'past'" class="pickers">
          <label class="methodPicker">
            Projected lineups
            <select :value="lineupChoice" @change="setKey('projectionLineup', $event.target.value)">
              <option v-for="(option, key) in lineups" :key="key" :value="key">{{ option.label }}</option>
            </select>
          </label>
          <label class="methodPicker">
            Points per game from
            <select :value="method" @change="setKey('projectionMethod', $event.target.value)">
              <option v-for="(option, key) in methods" :key="key" :value="key">{{ option.label }}</option>
            </select>
          </label>
        </div>
      </div>
      <template v-if="phase !== 'past'">
        <p class="note">
          {{ lineups[lineupChoice].description }} {{ methods[method].description }}
          Goalies count for the share of their team's games they've started. Injured players, day to day
          included, count as zero.
        </p>
        <template v-if="lineupChoice === 'set'">
          <p v-if="loadingLineups" class="note">Loading the lineups set for each day, using today's until then…</p>
          <p v-else-if="missingLineups" class="note">Some days' lineups couldn't be loaded, today's lineup is used for them.</p>
        </template>
        <p v-if="phase === 'current'" class="note">
          <template v-if="loadingLive">Updating scores…</template>
          <template v-else>Scores as of {{ formatTime(scoreAsOf) }}. Games already under way count only what they've scored so far.</template>
        </p>
      </template>

      <div class="scoreboard">
        <div v-for="(teamId, index) in teamIds" :key="teamId" class="teamScore" :class="{ right: index === 1 }">
          <button type="button" class="scoreTeam" :title="`${teamName(teamId)}: roster, projections and moves`"
            @click="$emit('openTeam', teamId)"><span class="swatch" :style="{ background: seriesColor(index) }"></span>{{ teamName(teamId) }}<span
              class="material-icons" aria-hidden="true">chevron_right</span></button>
          <template v-if="phase === 'past'">
            <span class="finalScore">{{ format(scores[index]) }}</span>
            <span class="scoreParts">final</span>
          </template>
          <template v-else>
            <span class="finalScore">{{ format(projectedFinal[index]) }}</span>
            <span class="scoreParts">
              <template v-if="phase === 'current'">{{ format(scores[index]) }} now + </template>{{ format(projections[index].expected) }} projected
            </span>
            <span class="scoreParts">{{ lineupGames(projections[index]) }}</span>
            <span v-if="projections[index].bench > 0" class="callout">
              {{ format(projections[index].bench) }} projected points on the bench
            </span>
            <span v-if="lineupChoice === 'set' && projections[index].best - projections[index].expected >= 0.1" class="callout">
              Best lineup each day: +{{ format(projections[index].best - projections[index].expected) }}
            </span>
          </template>
        </div>
      </div>

      <table class="startsTable">
        <caption>Starts{{ phase === 'current' ? ': so far + left' : phase === 'past' ? '' : ' left' }}</caption>
        <thead>
          <tr>
            <th scope="col">Position</th>
            <th v-for="(teamId, index) in teamIds" :key="teamId" scope="col">
              <span class="swatch" :style="{ background: seriesColor(index) }"></span>{{ teamName(teamId) }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in startRows" :key="row.position" :class="{ totalRow: row.position === 'Total' }">
            <th scope="row">{{ row.position }}</th>
            <td v-for="(cell, index) in row.cells" :key="index">{{ cell }}</td>
          </tr>
        </tbody>
      </table>

      <div v-if="phase !== 'past'" class="winChance">
        <div class="meter" role="img" :aria-label="`Win chance: ${teamName(teamIds[0])} ${chance(win)}, ${teamName(teamIds[1])} ${chance(1 - win)}`">
          <span :style="{ width: percent(win), background: seriesColor(0) }"></span>
          <span :style="{ width: percent(1 - win), background: seriesColor(1) }"></span>
        </div>
        <div class="meterLabels">
          <span>{{ chance(win) }} win chance</span>
          <span>{{ chance(1 - win) }}</span>
        </div>
      </div>

      <BarChart v-if="dayRows.length" class="chart" title="Points by day" rowHeading="Day"
        :series="chartSeries(teamIds)" :rows="dayRows" />

    </section>

    <section class="compareSection containerColor" aria-labelledby="compareHeading">
      <div class="sectionHeader">
        <h3 id="compareHeading">Where the points come from</h3>
      </div>
      <div class="compareFilters">
        <select :value="compareTeams[0]" aria-label="First team" @change="setCompareTeam(0, $event.target.value)">
          <option v-for="team in league.teams" :key="team.id" :value="team.id">{{ team.name }}</option>
        </select>
        <span>vs</span>
        <select :value="compareTeams[1]" aria-label="Second team" @change="setCompareTeam(1, $event.target.value)">
          <option v-for="team in league.teams" :key="team.id" :value="team.id">{{ team.name }}</option>
        </select>
        <span class="rangeButtons" role="group" aria-label="Range">
          <button v-for="(range, key) in ranges" :key="key" type="button" class="filterButton"
            :class="{ active: compareRange === key }" :aria-pressed="compareRange === key"
            @click="setKey('compareRange', key)">{{ range.label }}</button>
        </span>
      </div>
      <p class="note">
        Only points that counted: starters' points, not the bench's. Each team's page breaks them down by player.
        <template v-if="phase !== 'past'">The lighter part of each bar is what's projected for the rest of this matchup.</template>
        <template v-if="phase === 'future'">This matchup hasn't started: longer ranges count points scored up to now.</template>
        <template v-else-if="compareRange !== 'matchup'">Ranges end at this matchup.</template>
      </p>
      <p v-if="loadingCompare" class="note" role="status">
        Loading box scores{{ compareProgress.total ? ` ${compareProgress.done} of ${compareProgress.total}` : '' }}…
        <template v-if="compareProgress.total > 40">The first load of a long range takes a while, after that it's quick.</template>
      </p>
      <p v-if="compareFailed" class="note">{{ compareFailed }} box scores couldn't be loaded, so totals may be low. Use Refresh to try again.</p>

      <div class="compareBody" :class="{ stale: loadingCompare }">
        <div class="totals">
          <div v-for="(teamId, index) in compareTeams" :key="teamId" class="total">
            <span class="totalLabel"><span class="swatch" :style="{ background: seriesColor(index) }"></span>{{ teamName(teamId) }}</span>
            <span class="totalValue">{{ format(compareTotals[index]) }}</span>
            <span class="totalMeta">points over {{ compareDayCounts[index] }} days</span>
            <span v-if="compareProjections" class="totalMeta">+ {{ format(compareProjections[index].expected) }} projected this matchup</span>
          </div>
        </div>

        <BarChart class="chart" title="By position" rowHeading="Position" :series="chartSeries(compareTeams)" :rows="positionRows"
          :stacked="!!compareProjections" />

      </div>
    </section>
  </div>
</template>

<script>
import { mapState } from "vuex";
import BarChart from "./BarChart.vue";
import {
  projectTeam, teamGamesPlayed, winChance, formatChance, PROJECTION_METHODS, PROJECTION_LINEUPS,
} from "../collections/projection";
import {
  loadTeamDays, totalPoints, dayOrdinalAt, dayDate, COMPARE_RANGES,
} from "../collections/boxscores";
import { loadDayRosters } from "../collections/league";
import { primaryPosition, POSITIONS } from "../collections/boxscores";
import { periodDates } from "../collections/scheduleWeeks";
import { positionBreakdown, positionChartRows } from "../collections/breakdowns";

export default {
  components: { BarChart },
  // From Hockey, loads schedule weeks
  inject: { ensureSchedule: { default: () => async () => {} } },
  props: {
    leagueId: String,
    league: Object,
    // From groupByMatchup: { matchup, teams: [{ teamId, name }, ...] }, your team first
    group: Object,
    // The matchup's period (week)
    period: Object,
    // Today's rosters, used for days whose lineup isn't loaded
    rosters: Object,
    // The weeks before and after, for paging through the first team's matchups
    previousPeriod: Object,
    nextPeriod: Object,
    // The table's players
    players: Array,
    schedule: Array,
    now: Number,
  },
  emits: ['close', 'page', 'openPlayer', 'openTeam'],
  data() {
    return {
      methods: PROJECTION_METHODS,
      lineups: PROJECTION_LINEUPS,
      ranges: COMPARE_RANGES,
      // This matchup's days so far for both teams, for up to date scores
      liveDays: null,
      liveLoadedAt: null,
      // Loading starts on mount, saying so from the start avoids showing empty totals first
      loadingLive: true,
      // { [teamId]: { [day]: groups } }, the lineups set for the days left
      dayLineups: null,
      loadingLineups: false,
      compareDays: null,
      compareProgress: { done: 0, total: 0 },
      compareFailed: 0,
      loadingCompare: true,
      // Only the latest comparison load is shown
      compareLoadId: 0,
    };
  },
  computed: {
    ...mapState({
      method: state => state.projectionMethod,
      lineupChoice: state => state.projectionLineup,
      drawerExpanded: state => state.drawerExpanded,
      compareRange: state => state.compareRange,
      compareTeamIds: state => state.compareTeamIds,
    }),
    teamIds() {
      return this.group.teams.map(team => team.teamId);
    },
    // past, current or future
    phase() {
      if (this.period.end <= this.now) return 'past';
      return this.period.start > this.now ? 'future' : 'current';
    },
    compareTeams() {
      return this.compareTeamIds.length === 2 ? this.compareTeamIds : this.teamIds;
    },
    playersById() {
      return new Map((this.players || []).map(player => [player.id, player]));
    },
    teamGames() {
      return teamGamesPlayed(this.players || []);
    },
    // Box scores are up to date within minutes, the scoreboard within the hour
    scores() {
      if (this.phase === 'future') {
        return [0, 0];
      }
      if (this.liveDays) {
        return this.teamIds.map(teamId => totalPoints(this.liveDays[teamId] || []));
      }
      const { matchup } = this.group;
      return this.teamIds.map(teamId => parseFloat(teamId === matchup.homeId ? matchup.homeScore : matchup.awayScore) || 0);
    },
    scoreAsOf() {
      if (this.phase === 'future') return this.now;
      return this.liveDays ? this.liveLoadedAt : this.league.fetchedAt;
    },
    // The days left to project
    remainingDays() {
      if (this.phase === 'past') return [];
      const days = [];
      for (let day = dayOrdinalAt(this.period, this.scoreAsOf); day <= this.period.lastDay; day++) days.push(day);
      return days;
    },
    missingLineups() {
      return !!this.dayLineups && this.teamIds.some(teamId => this.remainingDays.some(day => !this.dayLineups[teamId]?.[day]));
    },
    projections() {
      return this.teamIds.map(this.projectionFor);
    },
    // The compared teams' projections for the rest of this matchup, null when it's over
    compareProjections() {
      if (this.phase === 'past') return null;
      return this.compareTeams.map(teamId => {
        const index = this.teamIds.indexOf(teamId);
        return index >= 0 ? this.projections[index] : this.projectionFor(teamId);
      });
    },
    projectionFor() {
      return (teamId) => projectTeam({
        // The best lineup only needs who's on the roster
        lineupFor: day => (this.lineupChoice === 'set' && this.dayLineups?.[teamId]?.[day]) || this.rosters[teamId]?.groups || null,
        lineup: this.lineupChoice,
        playersById: this.playersById,
        startSlots: this.league.rules?.startSlots,
        schedule: this.schedule,
        period: this.phase === 'past' ? null : this.period,
        method: this.method,
        teamGames: this.teamGames,
        scoreAsOf: this.scoreAsOf,
      });
    },
    projectedFinal() {
      return this.teamIds.map((_, index) => this.scores[index] + this.projections[index].expected);
    },
    win() {
      return winChance(this.scores[0], this.projections[0], this.scores[1], this.projections[1]);
    },
    // Each day of the matchup: points scored, then projected for the days left
    dayRows() {
      const rows = [];
      for (let day = this.period.firstDay; day <= this.period.lastDay; day++) {
        const parts = this.teamIds.map((teamId, index) => ({
          scored: this.liveDays?.[teamId]?.find(entry => entry.day === day)?.points,
          projected: this.projections[index].days.find(entry => entry.day === day)?.expected,
        }));
        const hasScored = parts.some(part => part.scored !== undefined);
        const hasProjected = parts.some(part => part.projected !== undefined);
        if (!hasScored && !hasProjected) continue;
        const date = dayDate(this.period, day);
        const suffix = hasProjected ? (hasScored ? ' (so far + projected)' : ' (projected)') : '';
        rows.push({
          key: date,
          label: `${this.dayLabel(date)}${suffix}`,
          values: parts.map(part => (part.scored ?? 0) + (part.projected ?? 0)),
          details: parts.map(part => [
            part.scored !== undefined && `${this.format(part.scored)} scored`,
            part.projected !== undefined && `${this.format(part.projected)} projected`,
          ].filter(Boolean).join(', ')),
        });
      }
      return rows;
    },
    // Starts by position for each team: so far from the box scores, left from the projection
    startRows() {
      const emptyCounts = () => Object.fromEntries(POSITIONS.map(position => [position, 0]));
      const soFar = this.teamIds.map(teamId => {
        const counts = emptyCounts();
        for (const day of this.liveDays?.[teamId] || []) {
          for (const slot of day.lineup) {
            const position = primaryPosition(slot.position, slot.eligibility);
            if (slot.group === 'START' && slot.games > 0 && position in counts) counts[position] += slot.games;
          }
        }
        return counts;
      });
      const left = this.projections.map(projection => {
        const counts = emptyCounts();
        for (const player of projection.players) {
          const position = primaryPosition(player.position, player.positions);
          if (position in counts) counts[position] += player.games;
        }
        return counts;
      });
      const total = (counts, position) => (position === 'Total'
        ? Object.values(counts).reduce((sum, count) => sum + count, 0)
        : counts[position]);
      const cell = (index, position) => {
        const done = total(soFar[index], position);
        const toCome = total(left[index], position);
        if (this.phase === 'past') return String(done);
        if (this.phase === 'future') return String(toCome);
        return `${done} + ${toCome} = ${done + toCome}`;
      };
      return [...POSITIONS, 'Total'].map(position => ({
        position,
        cells: this.teamIds.map((_, index) => cell(index, position)),
      }));
    },
    fleaTarget() {
      return process.env.STANDALONE ? '_blank' : '_self';
    },
    matchupLink() {
      return `https://www.fleaflicker.com/nhl/leagues/${this.leagueId}/scores/${this.group.matchup.gameId}`;
    },
    compareTotals() {
      return this.compareTeams.map(teamId => totalPoints(this.compareDays?.[teamId] || []));
    },
    compareDayCounts() {
      return this.compareTeams.map(teamId => (this.compareDays?.[teamId] || []).length);
    },
    positionRows() {
      const stacked = !!this.compareProjections;
      return positionChartRows(
        this.compareTeams.map((teamId, index) => positionBreakdown(this.compareDays?.[teamId], this.compareProjections?.[index])),
        { stacked },
      );
    },
  },
  methods: {
    setKey(key, value) {
      this.$store.commit('setKeyValue', { key, value });
    },
    // In the extension links open in this tab, so close the panel to show fleaflicker's page
    leavingForFleaflicker() {
      if (!process.env.STANDALONE && this.drawerExpanded) {
        this.$store.commit('toggleDrawer');
      }
    },
    page(delta) {
      this.$emit('page', { teamId: this.teamIds[0], delta });
    },
    setCompareTeam(index, value) {
      const teams = [...this.compareTeams];
      teams[index] = parseInt(value, 10);
      this.setKey('compareTeamIds', teams);
    },
    teamName(teamId) {
      return this.league.teams.find(team => team.id === teamId)?.name || 'Team';
    },
    seriesColor(index) {
      return this.$store.getters.chartColors[index];
    },
    chartSeries(teamIds) {
      return teamIds.map(teamId => ({ name: this.teamName(teamId) }));
    },
    format(value) {
      return (value ?? 0).toFixed(1);
    },
    percent(fraction) {
      return `${Math.round(fraction * 100)}%`;
    },
    chance(fraction) {
      return formatChance(fraction, this.projections.some(projection => projection.players.some(player => player.games)));
    },
    lineupGames(projection) {
      const games = projection.players.reduce((total, player) => total + player.games, 0);
      return games === 1 ? '1 start left' : `${games} starts left`;
    },
    formatDay(time) {
      return new Date(time).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    },
    formatTime(time) {
      return time ? new Date(time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'unknown';
    },
    dayLabel(date) {
      const [year, month, day] = date.split('-').map(Number);
      const today = new Date(this.now);
      if (today.getFullYear() === year && today.getMonth() === month - 1 && today.getDate() === day) {
        return 'Today';
      }
      return new Date(year, month - 1, day).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    },
    async loadLive() {
      if (this.phase === 'future') {
        this.loadingLive = false;
        return;
      }
      this.loadingLive = true;
      const loadedAt = Date.now();
      const { days } = await loadTeamDays(this.leagueId, {
        scoreboard: this.league.scoreboard, teamIds: this.teamIds, range: 'matchup', endPeriod: this.period.ordinal, now: loadedAt,
      });
      this.liveDays = days;
      this.liveLoadedAt = loadedAt;
      this.loadingLive = false;
    },
    async loadLineups() {
      if (!this.remainingDays.length || this.lineupChoice !== 'set' || this.dayLineups) return;
      this.loadingLineups = true;
      const teamIds = [...new Set([...this.teamIds, ...this.compareTeams])];
      this.dayLineups = await loadDayRosters(this.leagueId, teamIds, this.remainingDays, { now: Date.now() });
      this.loadingLineups = false;
    },
    async loadCompare() {
      const loadId = ++this.compareLoadId;
      this.loadingCompare = true;
      this.compareProgress = { done: 0, total: 0 };
      // A matchup that hasn't started has nothing scored yet
      const nothingScored = this.phase === 'future' && this.compareRange === 'matchup';
      const { days, failed } = nothingScored ? { days: {}, failed: 0 } : await loadTeamDays(this.leagueId, {
        scoreboard: this.league.scoreboard,
        teamIds: this.compareTeams,
        range: this.compareRange,
        endPeriod: this.period.ordinal,
        now: Date.now(),
        onProgress: (done, total) => {
          if (loadId === this.compareLoadId) this.compareProgress = { done, total };
        },
      });
      if (loadId !== this.compareLoadId) {
        return;
      }
      this.compareDays = days;
      this.compareFailed = failed;
      this.loadingCompare = false;
    },
  },
  watch: {
    lineupChoice() {
      this.loadLineups();
    },
    compareTeams(teams, previous) {
      if (teams.join() === previous.join()) return;
      this.loadCompare();
      // Their set lineups too, for their projections
      if (this.lineupChoice === 'set') {
        this.dayLineups = null;
        this.loadLineups();
      }
    },
    compareRange() {
      this.loadCompare();
    },
  },
  async mounted() {
    // Weeks far ahead aren't in the schedule loaded at start
    if (this.phase !== 'past') {
      this.ensureSchedule(periodDates(this.period));
    }
    // Scores first: they decide which days are left. The comparison's first range shares their box scores.
    await this.loadLive();
    await this.loadLineups();
    this.loadCompare();
  },
};
</script>

<style lang="scss" scoped>
.matchupView {
  display: flex;
  flex-direction: column;
  gap: 1em;
}

.viewHeader {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5em 1em;

  h2 {
    font-size: 1.2em;
    font-weight: 700;
    margin: 0;
    min-width: 0;
  }
}

.backButton {
  display: inline-flex;
  align-items: center;
  gap: 0.25em;
  font: inherit;
  color: inherit;
  background: none;
  border: 1px solid currentColor;
  border-radius: 4px;
  padding: 0.3em 0.6em;
  min-height: 32px;
  cursor: pointer;

  .material-icons {
    font-size: 1.1em;
  }
}

.projectionSection,
.compareSection {
  padding: 0.75em 1em;
  display: flex;
  flex-direction: column;
  gap: 0.75em;
}

.sectionHeader {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5em 1em;

  h3 {
    font-size: 1.1em;
    font-weight: 700;
    margin: 0;
  }
}

select {
  font: inherit;
  color: inherit;
  background: var(--themeBaseColor);
  border: 1px solid currentColor;
  border-radius: 4px;
  padding: 0.3em 0.5em;
  min-height: 32px;
  max-width: 100%;
}

.methodPicker {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5em;
  font-weight: normal;
  margin: 0;
}

.note {
  font-size: 0.9em;
  opacity: 0.85;
  margin: 0;
}

.swatch {
  display: inline-block;
  flex: none;
  width: 12px;
  height: 12px;
  border-radius: 3px;
  margin-right: 0.4em;
  vertical-align: -1px;
}

.scoreboard {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1em;
}

.teamScore {
  display: flex;
  flex-direction: column;
  gap: 0.15em;
  min-width: 0;

  &.right {
    align-items: flex-end;
    text-align: right;
  }
}

.scoreTeam {
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.finalScore {
  font-size: 2.2em;
  font-weight: 700;
  line-height: 1.1;
}

.scoreParts {
  font-size: 0.85em;
  opacity: 0.85;
}

.fleaLink {
  color: inherit;
  text-decoration: underline;
  text-decoration-color: rgba(127, 127, 127, 0.6);
}

button.scoreTeam {
  display: inline-flex;
  align-items: center;
  font: inherit;
  font-weight: 700;
  color: inherit;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  text-decoration: underline;
  text-decoration-color: rgba(127, 127, 127, 0.6);

  .material-icons {
    font-size: 1.2em;
    opacity: 0.7;
  }
}

.fleaLink {
  display: inline-flex;
  align-items: center;
  gap: 0.25em;
  font-size: 0.9em;

  .material-icons {
    font-size: 1.1em;
  }
}

.weekPager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75em;
  text-align: center;
}

.pageButton {
  display: inline-flex;
  align-items: center;
  flex: none;
  font: inherit;
  color: inherit;
  background: none;
  border: 1px solid rgba(127, 127, 127, 0.6);
  border-radius: 4px;
  padding: 0.25em 0.5em;
  min-height: 36px;
  cursor: pointer;

  &:disabled {
    opacity: 0.35;
    cursor: default;
  }
}

.pagerNote {
  display: block;
  font-size: 0.85em;
  opacity: 0.8;
}

.pickers {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5em 1.5em;
}

.startsTable {
  width: auto;
  min-width: min(28em, 100%);
  border-collapse: collapse;
  font-size: 0.9em;
  font-variant-numeric: tabular-nums;

  caption {
    text-align: left;
    font-weight: 700;
    padding-bottom: 0.25em;
  }

  th,
  td {
    padding: 0.25em 0.75em 0.25em 0;
    border-bottom: 1px solid rgba(127, 127, 127, 0.3);
    text-align: right;
  }

  th:first-child {
    text-align: left;
  }

  thead th {
    font-weight: 700;
    white-space: nowrap;
  }

  .totalRow {
    font-weight: 700;
  }
}

.callout {
  font-size: 0.85em;
  font-weight: 700;
}

.periodLabel {
  font-size: 0.9em;
  opacity: 0.85;
}

.meter {
  display: flex;
  gap: 2px;
  height: 10px;

  span {
    min-width: 2px;
    &:first-child { border-radius: 4px 0 0 4px; }
    &:last-child { border-radius: 0 4px 4px 0; }
  }
}

.meterLabels {
  display: flex;
  justify-content: space-between;
  font-size: 0.9em;
  margin-top: 0.25em;
}


.compareFilters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5em;
}

.rangeButtons {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 0.25em;
}

.filterButton {
  font: inherit;
  font-size: 0.9em;
  color: inherit;
  background: none;
  border: 1px solid rgba(127, 127, 127, 0.6);
  border-radius: 999px;
  padding: 0.25em 0.75em;
  min-height: 32px;
  cursor: pointer;

  &.active {
    border-color: var(--teamSecondaryColor);
    background: rgba(127, 127, 127, 0.25);
    font-weight: 700;
  }
}

.compareBody {
  display: flex;
  flex-direction: column;
  gap: 1.25em;
  transition: opacity 0.2s;

  // Keep the previous numbers while new ones load
  &.stale {
    opacity: 0.55;
  }
}

.totals {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1em;
}

.total {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.totalLabel {
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.totalValue {
  font-size: 1.8em;
  font-weight: 700;
}

.totalMeta {
  font-size: 0.85em;
  opacity: 0.85;
}

@media (max-width: 640px) {

  .finalScore {
    font-size: 1.7em;
  }
}
</style>
