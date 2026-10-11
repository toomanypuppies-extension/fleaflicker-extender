<template>
  <div class="matchupView">
    <div class="viewHeader">
      <button type="button" class="backButton" @click="$emit('close')">
        <span class="material-icons" aria-hidden="true">arrow_back</span> All matchups
      </button>
      <h2>{{ teamName(teamIds[0]) }} vs {{ teamName(teamIds[1]) }}</h2>
    </div>

    <section class="projectionSection containerColor" aria-labelledby="projectionHeading">
      <div class="sectionHeader">
        <h3 id="projectionHeading">Projection</h3>
        <label class="methodPicker">
          Points per game from
          <select :value="method" @change="setKey('projectionMethod', $event.target.value)">
            <option v-for="(option, key) in methods" :key="key" :value="key">{{ option.label }}</option>
          </select>
        </label>
      </div>
      <p class="note">
        {{ methods[method].description }}
        Each team is expected to start its best lineup each remaining day. Goalies count for the share of
        their team's games they've started. Injured players, day to day included, count as zero.
      </p>
      <p class="note">
        <template v-if="loadingLive">Updating scores…</template>
        <template v-else>Scores as of {{ formatTime(scoreAsOf) }}. Games already under way count only what they've scored so far.</template>
      </p>

      <div class="scoreboard">
        <div v-for="(teamId, index) in teamIds" :key="teamId" class="teamScore" :class="{ right: index === 1 }">
          <span class="scoreTeam"><span class="swatch" :style="{ background: seriesColor(index) }"></span>{{ teamName(teamId) }}</span>
          <span class="finalScore">{{ format(projectedFinal[index]) }}</span>
          <span class="scoreParts">{{ format(scores[index]) }} now + {{ format(projections[index].expected) }} to come</span>
          <span class="scoreParts">{{ gamesLeft(projections[index]) }}</span>
        </div>
      </div>

      <div class="winChance">
        <div class="meter" role="img" :aria-label="`Win chance: ${teamName(teamIds[0])} ${chance(win)}, ${teamName(teamIds[1])} ${chance(1 - win)}`">
          <span :style="{ width: percent(win), background: seriesColor(0) }"></span>
          <span :style="{ width: percent(1 - win), background: seriesColor(1) }"></span>
        </div>
        <div class="meterLabels">
          <span>{{ chance(win) }} win chance</span>
          <span>{{ chance(1 - win) }}</span>
        </div>
      </div>

      <BarChart v-if="dayRows.length" class="chart" title="Expected points by day" rowHeading="Day"
        :series="chartSeries(teamIds)" :rows="dayRows" />

      <div class="playerTables">
        <div v-for="(teamId, index) in teamIds" :key="teamId" class="playerTable">
          <h4><span class="swatch" :style="{ background: seriesColor(index) }"></span>{{ teamName(teamId) }}</h4>
          <table>
            <thead>
              <tr>
                <th scope="col">Player</th>
                <th scope="col" title="Games they're expected to start">Games</th>
                <th scope="col">Pts/game</th>
                <th scope="col">Expected</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="player in projections[index].players" :key="player.id" :class="{ idle: !player.games }">
                <th scope="row">
                  <button type="button" class="playerButton" @click="$emit('openPlayer', player.id)">{{ player.name }}</button>
                  <span class="playerMeta">
                    {{ player.position }} · {{ player.team }}
                    <template v-if="player.injured"> · out ({{ player.injury }})</template>
                    <template v-else-if="player.startRate < 1"> · starts {{ percent(player.startRate) }}</template>
                  </span>
                </th>
                <td>{{ player.games }}</td>
                <td>{{ format(player.rate) }}</td>
                <td>{{ format(player.expected) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
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
      <p class="note">Only points that counted: starters' points, not the bench's.</p>
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
          </div>
        </div>

        <BarChart class="chart" title="By position" rowHeading="Position" :series="chartSeries(compareTeams)" :rows="positionRows" />

        <div class="playerCharts">
          <BarChart v-for="(teamId, index) in compareTeams" :key="teamId" class="chart"
            :title="`By player: ${teamName(teamId)}`" rowHeading="Player"
            :series="[{ name: teamName(teamId) }]" :rows="playerRows[index]" :colorOffset="index" />
        </div>
      </div>
    </section>
  </div>
</template>

<script>
import { mapState } from "vuex";
import BarChart from "./BarChart.vue";
import {
  projectTeam, teamGamesPlayed, winChance, gamesLeft, formatChance, PROJECTION_METHODS,
} from "../collections/projection";
import { loadTeamDays, pointsByPlayer, pointsByPosition, totalPoints, COMPARE_RANGES } from "../collections/boxscores";
import { seriesColor } from "../chartColors";
// Players shown in each team's chart
const TOP_PLAYERS = 12;

export default {
  components: { BarChart },
  props: {
    leagueId: String,
    league: Object,
    // From groupByMatchup: { matchup, teams: [summary, summary] }, your team first
    group: Object,
    period: Object,
    rosters: Object,
    // The table's players
    players: Array,
    schedule: Array,
    now: Number,
  },
  emits: ['close', 'openPlayer'],
  data() {
    return {
      methods: PROJECTION_METHODS,
      ranges: COMPARE_RANGES,
      // This matchup's days so far for both teams, for up to date scores
      liveDays: null,
      liveLoadedAt: null,
      loadingLive: false,
      compareDays: null,
      compareProgress: { done: 0, total: 0 },
      compareFailed: 0,
      loadingCompare: false,
      // Only the latest comparison load is shown
      compareLoadId: 0,
    };
  },
  computed: {
    ...mapState({
      method: state => state.projectionMethod,
      compareRange: state => state.compareRange,
      compareTeamIds: state => state.compareTeamIds,
      darkMode: state => state.settings.darkMode,
    }),
    teamIds() {
      return this.group.teams.map(team => team.teamId);
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
      if (this.liveDays) {
        return this.teamIds.map(teamId => totalPoints(this.liveDays[teamId] || []));
      }
      const { matchup } = this.group;
      return this.teamIds.map(teamId => parseFloat(teamId === matchup.homeId ? matchup.homeScore : matchup.awayScore) || 0);
    },
    scoreAsOf() {
      return this.liveDays ? this.liveLoadedAt : this.league.fetchedAt;
    },
    projections() {
      return this.teamIds.map(teamId => projectTeam({
        roster: this.rosters[teamId],
        playersById: this.playersById,
        startSlots: this.league.rules?.startSlots,
        schedule: this.schedule,
        period: this.period,
        method: this.method,
        teamGames: this.teamGames,
        scoreAsOf: this.scoreAsOf,
      }));
    },
    projectedFinal() {
      return this.teamIds.map((_, index) => this.scores[index] + this.projections[index].expected);
    },
    win() {
      return winChance(this.scores[0], this.projections[0], this.scores[1], this.projections[1]);
    },
    dayRows() {
      const [first, second] = this.projections;
      return first.days.map((day, index) => ({
        key: day.date,
        label: this.dayLabel(day.date),
        values: [day.expected, second.days[index]?.expected ?? 0],
      }));
    },
    compareTotals() {
      return this.compareTeams.map(teamId => totalPoints(this.compareDays?.[teamId] || []));
    },
    compareDayCounts() {
      return this.compareTeams.map(teamId => (this.compareDays?.[teamId] || []).length);
    },
    positionRows() {
      const [first, second] = this.compareTeams.map(teamId => pointsByPosition(this.compareDays?.[teamId] || []));
      return first.map((position, index) => ({
        key: position.position,
        label: position.position,
        values: [position.points, second[index].points],
        details: [first, second].map(totals => `${totals[index].games} games started`),
      }));
    },
    playerRows() {
      return this.compareTeams.map(teamId => {
        const players = pointsByPlayer(this.compareDays?.[teamId] || []);
        const rows = players.slice(0, TOP_PLAYERS).map(player => ({
          key: player.playerId,
          label: player.name,
          values: [player.points],
          details: [`${player.position} · ${player.games} games started · ${this.format(player.points / player.games)} per game`],
        }));
        const rest = players.slice(TOP_PLAYERS);
        if (rest.length) {
          const points = rest.reduce((total, player) => total + player.points, 0);
          rows.push({ key: 'others', label: `${rest.length} others`, values: [points], details: [rest.map(player => player.name).join(', ')] });
        }
        return rows;
      });
    },
  },
  methods: {
    setKey(key, value) {
      this.$store.commit('setKeyValue', { key, value });
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
      return seriesColor(index, this.darkMode);
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
      return formatChance(fraction, this.projections.some(projection => gamesLeft(projection) > 0));
    },
    gamesLeft(projection) {
      const games = gamesLeft(projection);
      return games === 1 ? '1 game left to start' : `${games} games left to start`;
    },
    formatTime(time) {
      return time ? new Date(time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'unknown';
    },
    dayLabel(date) {
      const [year, month, day] = date.split('-').map(Number);
      const label = new Date(year, month - 1, day).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
      const today = new Date(this.now);
      const isToday = today.getFullYear() === year && today.getMonth() === month - 1 && today.getDate() === day;
      return isToday ? `Today` : label;
    },
    async loadLive() {
      this.loadingLive = true;
      const loadedAt = Date.now();
      const { days } = await loadTeamDays(this.leagueId, {
        scoreboard: this.league.scoreboard, teamIds: this.teamIds, range: 'matchup', now: loadedAt,
      });
      this.liveDays = days;
      this.liveLoadedAt = loadedAt;
      this.loadingLive = false;
    },
    async loadCompare() {
      const loadId = ++this.compareLoadId;
      this.loadingCompare = true;
      this.compareProgress = { done: 0, total: 0 };
      const { days, failed } = await loadTeamDays(this.leagueId, {
        scoreboard: this.league.scoreboard,
        teamIds: this.compareTeams,
        range: this.compareRange,
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
    compareTeams(teams, previous) {
      if (teams.join() !== previous.join()) this.loadCompare();
    },
    compareRange() {
      this.loadCompare();
    },
  },
  async mounted() {
    // The live scores first, the comparison's first range shares their box scores
    await this.loadLive();
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

.playerTables,
.playerCharts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1em;
}

.playerTable {
  min-width: 0;
  overflow-x: auto;

  h4 {
    font-size: 1em;
    font-weight: 700;
    margin: 0 0 0.25em;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9em;
  }

  th,
  td {
    padding: 0.3em 0.4em;
    border-bottom: 1px solid rgba(127, 127, 127, 0.3);
    text-align: right;
    font-variant-numeric: tabular-nums;
    vertical-align: top;
  }

  th:first-child {
    text-align: left;
    font-weight: normal;
  }

  thead th {
    font-weight: 700;
    font-size: 0.85em;
  }

  .idle {
    opacity: 0.6;
  }
}

.playerButton {
  font: inherit;
  color: inherit;
  background: none;
  border: none;
  padding: 0;
  text-align: left;
  text-decoration: underline;
  text-decoration-color: rgba(127, 127, 127, 0.6);
  cursor: pointer;
}

.playerMeta {
  display: block;
  font-size: 0.85em;
  opacity: 0.8;
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
  .playerTables,
  .playerCharts {
    grid-template-columns: minmax(0, 1fr);
  }

  .finalScore {
    font-size: 1.7em;
  }
}
</style>
