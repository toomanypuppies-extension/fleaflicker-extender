<template>
  <div class="matchupView">
    <section class="pageHeader containerColor" aria-label="Matchup">
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
    </section>

    <section class="projectionSection containerColor" aria-labelledby="projectionHeading">
      <div class="sectionHeader">
        <span class="titleWithHelp">
          <h3 id="projectionHeading">{{ phase === 'past' ? 'Result' : 'Projection' }}</h3>
          <HelpTip v-if="phase !== 'past'" label="projections">
            <p>{{ lineups[lineupChoice].description }} {{ methods[method].description }}</p>
            <p>Goalies count for the share of their team's games they've started. Injured players, day to day included, count as zero.</p>
            <p v-if="phase === 'current'">Games already under way count only what they've scored so far.</p>
            <p>Starts are games in the lineup: so far, plus what's left.</p>
          </HelpTip>
        </span>
        <div v-if="phase !== 'past'" class="pickers">
          <label class="methodPicker">
            <span class="pickerLabel">Lineups</span>
            <select :value="lineupChoice" @change="setKey('projectionLineup', $event.target.value)">
              <option v-for="(option, key) in lineups" :key="key" :value="key">{{ option.label }}</option>
            </select>
          </label>
          <label class="methodPicker">
            <span class="pickerLabel">Points per game</span>
            <select :value="method" @change="setKey('projectionMethod', $event.target.value)">
              <option v-for="(option, key) in methods" :key="key" :value="key">{{ option.label }}</option>
            </select>
          </label>
        </div>
      </div>
      <template v-if="phase !== 'past'">
        <template v-if="lineupChoice === 'set'">
          <p v-if="loadingLineups" class="note">Loading the lineups set for each day, using today's until then…</p>
          <p v-else-if="missingLineups" class="note">Some days' lineups couldn't be loaded, today's lineup is used for them.</p>
        </template>
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
          </template>
        </div>
      </div>

      <table class="startsTable">
        <caption>Starts{{ phase === 'current' ? ': so far + left' : phase === 'past' ? '' : ' left' }}</caption>
        <thead>
          <tr>
            <th scope="col">Slot</th>
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

      <p v-if="phase === 'current'" class="asOf" role="status">
        <template v-if="loadingLive">Updating scores…</template>
        <template v-else>Scores as of {{ formatTime(scoreAsOf) }}.</template>
      </p>

    </section>

    <section v-if="phase !== 'past'" class="benchSection containerColor" aria-labelledby="benchHeading">
      <div class="sectionHeader">
        <span class="titleWithHelp">
          <h3 id="benchHeading">Bench management</h3>
          <HelpTip label="bench management">
            <p v-if="lineupChoice === 'set'">Players with a game who sit in the lineup each team has set for the rest of the week,
              and the points they're projected to score in those games.</p>
            <p v-else>Players with a game who don't fit the best lineup that day, usually because too many players
              at their position play, and the points they're projected to score in those games.</p>
            <p>Injured players aren't listed, they're projected to score nothing.</p>
          </HelpTip>
        </span>
      </div>
      <div class="benchTeams">
        <div v-for="(teamId, index) in teamIds" :key="teamId" class="benchTeam">
          <span class="totalLabel"><span class="swatch" :style="{ background: seriesColor(index) }"></span>{{ teamName(teamId) }}</span>
          <span class="benchPoints"><strong>{{ benchGames(projections[index]) }}</strong> {{ benchGames(projections[index]) === 1 ? 'game' : 'games' }} benched,
            <strong>{{ format(projections[index].bench) }}</strong> projected points</span>
          <span v-if="lineupChoice === 'set' && projections[index].best - projections[index].expected >= 0.1" class="callout">
            Best lineup each day: +{{ format(projections[index].best - projections[index].expected) }}
          </span>
          <ul v-if="benched(projections[index]).length" class="benchList" :aria-label="`${teamName(teamId)}: projected to sit`">
            <li v-for="player in benched(projections[index])" :key="player.id">
              <button type="button" class="playerButton" @click="$emit('openPlayer', player.id)">{{ player.name }}</button>
              <span class="benchDetail">{{ benchText(player) }}</span>
            </li>
          </ul>
          <p v-else class="note">No one projected to sit.</p>
        </div>
      </div>
    </section>

    <section v-if="phase !== 'past'" class="plannerSection containerColor" aria-labelledby="plannerHeading">
      <div class="sectionHeader">
        <span class="titleWithHelp">
          <h3 id="plannerHeading">Lineup planner</h3>
          <HelpTip label="lineup planner">
            <p v-if="lineupChoice === 'set'">The lineup each team has set for each day left, as the projection counts it.
              Open slots have no one with a game in them.</p>
            <p v-else>The best lineup for each day left, as the projection counts it: the players expected to score
              the most. Open slots are ones no one on the roster with a game can fill, room to stream a player.</p>
            <p>Players whose game has begun are locked in, shown in italics. Benched is who has a game but doesn't start.</p>
          </HelpTip>
        </span>
        <span class="rangeButtons" role="group" aria-label="Team">
          <button v-for="(teamId, index) in teamIds" :key="teamId" type="button" class="filterButton"
            :class="{ active: plannerIndex === index }" :aria-pressed="plannerIndex === index"
            @click="plannerIndex = index"><span class="swatch" :style="{ background: seriesColor(index) }"></span>{{ teamName(teamId) }}</button>
        </span>
      </div>
      <div v-if="plannerDays.length" class="plannerScroller">
        <!-- Every day as wide as the others, names that don't fit are cut short -->
        <table class="plannerTable" :style="{ minWidth: `${4.5 + plannerDays.length * 6.5}em` }">
          <colgroup>
            <col class="slotCol" />
            <col v-for="day in plannerDays" :key="day.day" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col" class="slotColumn">Slot</th>
              <th v-for="day in plannerDays" :key="day.day" scope="col">
                <span class="plannerDay">{{ shortDay(day.date) }}</span>
                <span class="plannerOpen" :class="{ hasOpen: openCount(day) }">{{ day.hasLineup ? `${openCount(day)} open` : 'unknown' }}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(slot, slotIndex) in plannerSlots" :key="slotIndex">
              <th scope="row" class="slotColumn">{{ slot.label }}</th>
              <td v-for="day in plannerDays" :key="day.day" :class="plannerCellClass(day, day.slots[slotIndex])">
                <template v-if="!day.hasLineup">–</template>
                <button v-else type="button" class="spotButton" :aria-pressed="isSpotPicked(day.date, slot.label)"
                  :title="plannerCellTitle(day.slots[slotIndex])" @click="toggleSpot(day.date, slot.label)">
                  {{ day.slots[slotIndex].player ? shortName(day.slots[slotIndex].player.name) : 'Open' }}
                </button>
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" class="slotColumn">Benched</th>
              <td v-for="day in plannerDays" :key="day.day" class="sittingCell">
                <template v-for="player in day.sitting" :key="player.id">
                  <button type="button" class="playerButton" :title="`${player.name}, ${format(player.expected)} pts expected`"
                    @click="$emit('openPlayer', player.id)">{{ shortName(player.name) }}</button>
                </template>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div v-if="plannerDays.length" class="spotBar" role="status">
        <span v-if="spotFilters.length">
          {{ spotFilters.length }} {{ spotFilters.length === 1 ? 'spot' : 'spots' }} picked: players who fit all of them
        </span>
        <span v-else class="note">Select cells to find players who fit those spots.</span>
        <button v-if="spotFilters.length" type="button" class="filterButton active" @click="findSpotPlayers">Find players</button>
        <button v-if="spotFilters.length" type="button" class="filterButton" @click="setKey('spotFilters', [])">Clear</button>
      </div>
    </section>

    <section class="compareSection containerColor" aria-labelledby="compareHeading">
      <div class="sectionHeader">
        <span class="titleWithHelp">
          <h3 id="compareHeading">Where the points come from</h3>
          <HelpTip label="where the points come from">
            <p>Only points that counted: starters' points, not the bench's. Each team's page breaks them down by player.</p>
            <p v-if="phase !== 'past'">The lighter part of each bar is what's projected for the rest of this matchup.</p>
            <p v-if="phase === 'future'">This matchup hasn't started: longer ranges count points scored up to now.</p>
            <p v-else>Longer ranges end at this matchup.</p>
          </HelpTip>
        </span>
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
import HelpTip from "./HelpTip.vue";
import {
  projectTeam, teamGamesPlayed, winChance, formatChance, PROJECTION_METHODS, PROJECTION_LINEUPS,
} from "../collections/projection";
import {
  loadTeamDays, totalPoints, dayOrdinalAt, dayDate, COMPARE_RANGES,
} from "../collections/boxscores";
import { loadDayRosters } from "../collections/league";
import { startsBySlot } from "../collections/boxscores";
import { periodDates } from "../collections/scheduleWeeks";
import { positionBreakdown, positionChartRows } from "../collections/breakdowns";

export default {
  components: { BarChart, HelpTip },
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
      // Which team the lineup planner shows
      plannerIndex: 0,
    };
  },
  computed: {
    ...mapState({
      method: state => state.projectionMethod,
      lineupChoice: state => state.projectionLineup,
      drawerExpanded: state => state.drawerExpanded,
      compareRange: state => state.compareRange,
      compareTeamIds: state => state.compareTeamIds,
      spotFilters: state => state.spotFilters,
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
    // The planner's team's days left
    plannerDays() {
      return this.projections[this.plannerIndex]?.days || [];
    },
    plannerSlots() {
      return this.plannerDays.find(day => day.hasLineup)?.slots || [];
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
    // Starts by lineup slot for each team: so far from the box scores, left from the projection
    startRows() {
      const labels = (this.league.rules?.startSlots || []).map(slot => slot.label);
      const soFar = this.teamIds.map(teamId => startsBySlot(this.liveDays?.[teamId] || []));
      const left = this.projections.map(projection => {
        const counts = {};
        for (const player of projection.players) {
          for (const [label, slot] of Object.entries(player.slots || {})) {
            counts[label] = (counts[label] || 0) + slot.games;
          }
        }
        return counts;
      });
      const count = (counts, label) => (label === 'Total'
        ? Object.values(counts).reduce((sum, games) => sum + games, 0)
        : counts[label] || 0);
      const cell = (index, label) => {
        const done = count(soFar[index], label);
        const toCome = count(left[index], label);
        if (this.phase === 'past') return String(done);
        if (this.phase === 'future') return String(toCome);
        return `${done} + ${toCome} = ${done + toCome}`;
      };
      return [...labels, 'Total'].map(label => ({
        position: label,
        cells: this.teamIds.map((_, index) => cell(index, label)),
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
    // Players projected to sit for at least one game, most points lost first
    benched(projection) {
      return projection.players
        .filter(player => player.benchGames > 0)
        .sort((a, b) => b.benchExpected - a.benchExpected);
    },
    openCount(day) {
      return day.slots.filter(slot => !slot.player).length;
    },
    shortDay(date) {
      return this.dayLabel(date) === 'Today'
        ? 'Today'
        : new Date(`${date}T12:00:00`).toLocaleDateString([], { weekday: 'short', day: 'numeric' });
    },
    // Last name, the table is narrow
    shortName(name) {
      const parts = name.split(' ');
      return parts.length > 1 ? parts.slice(1).join(' ') : name;
    },
    plannerCellClass(day, slot) {
      if (!slot) return null;
      return { open: !slot.player, locked: slot.locked, picked: this.isSpotPicked(day.date, slot.label) };
    },
    plannerCellTitle(slot) {
      if (!slot.player) return `${slot.label}: open. Select to find players for it`;
      return `${slot.player.name}, ${slot.locked ? 'game under way' : `${this.format(slot.player.expected)} pts expected`}. Select to find players for it`;
    },
    // A spot is a slot on a day, two C slots the same day are the same spot
    isSpotPicked(date, label) {
      return this.spotFilters.some(spot => spot.date === date && spot.label === label);
    },
    toggleSpot(date, label) {
      if (this.isSpotPicked(date, label)) {
        this.setKey('spotFilters', this.spotFilters.filter(spot => spot.date !== date || spot.label !== label));
        return;
      }
      const eligibility = this.league.rules?.startSlots?.find(slot => slot.label === label)?.eligibility || [label];
      const spots = [...this.spotFilters, { date, label, eligibility }];
      this.setKey('spotFilters', spots.sort((a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label)));
    },
    findSpotPlayers() {
      this.setKey('activeTab', 'players');
    },
    benchGames(projection) {
      return projection.players.reduce((total, player) => total + player.benchGames, 0);
    },
    benchText(player) {
      const total = player.games + player.benchGames;
      return `${player.benchGames} of ${total} ${total === 1 ? 'game' : 'games'}, ${this.format(player.benchExpected)} pts`;
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

.pageHeader {
  display: flex;
  flex-direction: column;
  gap: 0.6em;
  padding: 0.6em 1em;
}

// The week pager sits under the title, set off by a hairline
.pageHeader .weekPager {
  padding-top: 0.6em;
  border-top: 1px solid rgba(127, 127, 127, 0.3);
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
.benchSection,
.plannerSection,
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

.plannerScroller {
  overflow-x: auto;
}

.plannerTable {
  border-collapse: collapse;
  font-size: 0.85em;
  width: 100%;
  table-layout: fixed;

  .slotCol {
    width: 4.5em;
  }

  th,
  td {
    padding: 0.3em 0.4em;
    border-bottom: 1px solid rgba(127, 127, 127, 0.3);
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .playerButton {
    display: block;
    max-width: 100%;
    margin: 0 auto;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  thead th {
    font-weight: 700;
    vertical-align: bottom;
  }

  // Above the day cells scrolling under it: the see-through ones (locked, benched) would
  // otherwise be drawn over it
  .slotColumn {
    position: sticky;
    left: 0;
    z-index: 1;
    background: var(--themeBaseColor);
    text-align: left;
    font-weight: 700;
  }

  td.open {
    background: var(--teamSecondaryColor30Opacity);
    font-weight: 700;
  }

  td.locked {
    font-style: italic;
    opacity: 0.75;
  }

  td.picked {
    box-shadow: inset 0 0 0 2px var(--teamSecondaryColor);
    background: var(--teamSecondaryColor30Opacity);
  }

  tfoot td,
  tfoot th {
    vertical-align: top;
    border-bottom: none;
  }
}

.spotButton {
  font: inherit;
  color: inherit;
  background: none;
  border: none;
  padding: 0.15em 0;
  width: 100%;
  min-height: 28px;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  &:focus-visible {
    outline: 2px solid var(--teamSecondaryColor);
  }
}

.spotBar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5em;
  font-size: 0.9em;
}

.plannerDay,
.plannerOpen {
  display: block;
}

.plannerOpen {
  font-weight: normal;
  font-size: 0.85em;
  opacity: 0.8;

  &.hasOpen {
    font-weight: 700;
    opacity: 1;
  }
}

.sittingCell {
  font-size: 0.9em;
  opacity: 0.85;
  line-height: 1.5;
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

.titleWithHelp {
  display: inline-flex;
  align-items: center;
  gap: 0.15em;
}

.asOf {
  font-size: 0.85em;
  font-style: italic;
  opacity: 0.8;
  margin: 0;
}

.callout {
  font-size: 0.85em;
  font-weight: 700;
}

.benchList {
  list-style: none;
  margin: 0;
  padding: 0;
  font-size: 0.9em;
  line-height: 1.5;

  li {
    display: flex;
    flex-wrap: wrap;
    gap: 0 0.4em;
  }
}

.benchTeams {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1em;
}

.benchTeam {
  display: flex;
  flex-direction: column;
  gap: 0.3em;
  min-width: 0;
}

.benchPoints {
  font-size: 0.9em;
}

.playerButton {
  font: inherit;
  color: inherit;
  background: none;
  border: none;
  padding: 0;
  text-align: inherit;
  text-decoration: underline;
  text-decoration-color: rgba(127, 127, 127, 0.6);
  cursor: pointer;
}

.benchDetail {
  opacity: 0.8;
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

// Phones: the pickers side by side, labels above them
@media (max-width: 640px) {
  .pickers {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: end;
    gap: 0.5em;
    width: 100%;
  }

  .pickers label {
    flex-direction: column;
    align-items: stretch;
    flex-wrap: nowrap;
    gap: 0.15em;
    min-width: 0;
  }

  .pickerLabel {
    font-size: 0.8em;
    opacity: 0.85;
  }

  .pickers select {
    width: 100%;
    font-size: 0.9em;
    padding: 0.2em 0.3em;
  }
}

// Each team's list on its own rows, the lines are long
@media (max-width: 480px) {
  .benchTeams {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
