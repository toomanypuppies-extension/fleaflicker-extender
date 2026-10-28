<template>
  <MatchupView v-if="openGroup" :key="openGroup.matchup.gameId" :leagueId="leagueId" :league="league" :group="openGroup"
    :period="selectedPeriod" :rosters="rosters" :players="players" :schedule="schedule" :now="now"
    :previousPeriod="previousPeriod" :nextPeriod="nextPeriod"
    @close="openMatchup(null)" @page="pageMatchup" @openPlayer="$emit('openPlayer', $event)"
    @openTeam="$emit('openTeam', $event)" />

  <section v-else class="matchupsSection containerColor" aria-labelledby="matchupsHeading">
    <h2 id="matchupsHeading" class="visuallyHidden">Matchups</h2>
    <WeekPicker :periods="periods" :selected="selectedPeriod" :currentOrdinal="currentOrdinal" @select="selectPeriod" />

    <div class="projectionControls">
      <label>
        <span class="pickerLabel">Lineups</span>
        <select :value="projectionLineup" @change="setKey('projectionLineup', $event.target.value)">
          <option v-for="(option, key) in lineupOptions" :key="key" :value="key">{{ option.label }}</option>
        </select>
      </label>
      <label>
        <span class="pickerLabel">Points per game</span>
        <select :value="projectionMethod" @change="setKey('projectionMethod', $event.target.value)">
          <option v-for="(option, key) in methodOptions" :key="key" :value="key">{{ option.label }}</option>
        </select>
      </label>
      <label>
        <span class="pickerLabel">DTD players</span>
        <select :value="projectionCountsDayToDay ? 'play' : 'sit'" @change="setKey('projectionCountsDayToDay', $event.target.value === 'play')">
          <option value="sit">Sit</option>
          <option value="play">Play</option>
        </select>
      </label>
      <HelpTip label="projections" class="controlsHelp">
        <p>{{ lineupOptions[projectionLineup].description }} {{ methodOptions[projectionMethod].description }}</p>
        <p v-if="projectionLineup === 'set'">
          Your matchup always uses the lineups teams have set for each day. Other matchups use them once you've
          opened their Details, and until then show each team's best lineup, marked "best lineups".
        </p>
        <p>Goalies count for the share of their team's games they've started. Injured players count as zero,
          day to day (DTD) ones too unless DTD players is set to Play.</p>
      </HelpTip>
    </div>
    <p class="note">{{ weekNote }}</p>
    <LoadingIndicator v-if="loadingText" :text="loadingText" />
    <p v-else-if="!matchups" class="note">This week's matchups couldn't be loaded. Use Refresh to try again.</p>

    <div class="matchups">
      <section v-for="group in groups" :key="group.matchup?.gameId || 'none'" class="matchup"
        :class="{ myMatchup: group.teams.some(team => team.teamId === myTeamId) }"
        :aria-label="group.matchup ? group.teams.map(team => team.name).join(' vs ') : 'No matchup this week'">
        <template v-if="group.matchup">
          <div class="matchupTeams">
            <div v-for="(team, index) in group.teams" :key="team.teamId" class="side" :class="{ right: index === 1 }">
              <span class="sideName">
                <span class="teamName">{{ team.name }}</span>
                <span v-if="team.teamId === myTeamId" class="badge">You</span>
                <span v-if="team.teamId === opponentId" class="badge opponentBadge">Your opponent</span>
              </span>
              <span class="sideScore">{{ phase === 'future' ? '–' : scoreFor(group, index) ?? '–' }}</span>
            </div>
            <span class="status">{{ statusLabel(group) }}</span>
          </div>
          <div v-if="projectionFor(group)" class="winBar" role="img"
            :aria-label="`Win chance: ${group.teams[0].name} ${projectionFor(group).chances[0]}, ${group.teams[1].name} ${projectionFor(group).chances[1]}`">
            <span :style="{ width: percent(projectionFor(group).chance), background: chartColors[0] }"></span>
            <span :style="{ width: percent(1 - projectionFor(group).chance), background: chartColors[1] }"></span>
          </div>
          <div v-if="projectionFor(group)" class="winLabels" aria-hidden="true">
            <span>{{ projectionFor(group).chances[0] }}</span>
            <span>{{ projectionFor(group).chances[1] }}</span>
          </div>
          <div class="matchupFooter">
            <span v-if="projectionFor(group)">
              Projected <strong>{{ projectionFor(group).finals[0] }}</strong> to <strong>{{ projectionFor(group).finals[1] }}</strong>
              · {{ projectionFor(group).winLabel }}
              <span v-if="projectionFor(group).fallback" class="basis"
                title="These teams' lineups for the days left aren't loaded yet. Details loads them.">(best lineups)</span>
            </span>
            <span v-else-if="phase !== 'past' && loadingRosters">Projecting…</span>
            <span v-else-if="phase === 'past'">{{ resultLabel(group) }}</span>
            <button type="button" class="detailsButton" @click="openMatchup(group.matchup.gameId)">
              Details <span class="material-icons" aria-hidden="true">chevron_right</span>
            </button>
          </div>
        </template>
        <p v-else class="note">No matchup this week: {{ group.teams.map(team => team.name).join(', ') }}</p>
      </section>
    </div>
  </section>
</template>

<script>
import { mapState } from "vuex";
import MatchupView from "./MatchupView.vue";
import WeekPicker from "./WeekPicker.vue";
import HelpTip from "./HelpTip.vue";
import LoadingIndicator from "./LoadingIndicator.vue";
import { periodDates, coversPeriod } from "../collections/scheduleWeeks";
import { currentPeriod, groupByMatchup, loadPeriodMatchups, loadDayRosters } from "../collections/league";
import { dayOrdinalAt } from "../collections/boxscores";
import {
  projectTeam, teamGamesPlayed, winChance, gamesLeft, formatChance, PROJECTION_LINEUPS, PROJECTION_METHODS,
} from "../collections/projection";

export default {
  components: { MatchupView, WeekPicker, HelpTip, LoadingIndicator },
  // From Hockey, loads schedule weeks
  inject: { ensureSchedule: { default: () => async () => {} } },
  props: {
    leagueId: String,
    league: Object,
    rosters: Object,
    loadingRosters: Boolean,
    // Projections need the players' stats
    loadingPlayers: Boolean,
    players: Array,
    schedule: Array,
    now: Number,
  },
  emits: ['openPlayer', 'openTeam'],
  data() {
    return {
      // The selected week's matchups, when it isn't the current one
      periodMatchups: null,
      loadingMatchups: false,
      // { [teamId]: { [day]: groups } }: lineups set for the days left, for your matchup and any
      // matchup whose Details loaded them in the last few minutes
      dayLineups: {},
      lineupOptions: PROJECTION_LINEUPS,
      methodOptions: PROJECTION_METHODS,
    };
  },
  computed: {
    ...mapState({
      myTeamId: state => state.myTeamId,
      selectedOrdinal: state => state.selectedPeriod,
      openMatchupId: state => state.openMatchupId,
      projectionMethod: state => state.projectionMethod,
      projectionLineup: state => state.projectionLineup,
      projectionCountsDayToDay: state => state.projectionCountsDayToDay,
    }),
    chartColors() {
      return this.$store.getters.chartColors;
    },
    periods() {
      return this.league.scoreboard?.periods || [];
    },
    currentOrdinal() {
      return currentPeriod(this.league.scoreboard, this.now)?.ordinal;
    },
    selectedPeriod() {
      const ordinal = this.selectedOrdinal ?? this.currentOrdinal;
      return this.periods.find(period => period.ordinal === ordinal) || null;
    },
    previousPeriod() {
      return this.periods[this.periods.indexOf(this.selectedPeriod) - 1] || null;
    },
    nextPeriod() {
      const index = this.periods.indexOf(this.selectedPeriod);
      return index >= 0 ? this.periods[index + 1] || null : null;
    },
    // past, current or future
    phase() {
      const period = this.selectedPeriod;
      if (!period || period.end <= this.now) return 'past';
      return period.start > this.now ? 'future' : 'current';
    },
    matchups() {
      return this.selectedPeriod?.ordinal === this.league.scoreboard?.currentOrdinal
        ? this.league.scoreboard.matchups
        : this.periodMatchups;
    },
    // Your matchup first, then the scoreboard's order
    groups() {
      if (!this.matchups) return [];
      const teams = this.league.teams.map(team => ({ teamId: team.id, name: team.name }));
      return groupByMatchup(teams, { matchups: this.matchups }, this.myTeamId);
    },
    opponentId() {
      const mine = this.matchups?.find(m => m.awayId === this.myTeamId || m.homeId === this.myTeamId);
      return mine ? (mine.awayId === this.myTeamId ? mine.homeId : mine.awayId) : null;
    },
    openGroup() {
      return this.openMatchupId ? this.groups.find(group => group.matchup?.gameId === this.openMatchupId) : null;
    },
    // What the page is waiting on, matchups first, then what projections need
    loadingText() {
      if (this.loadingMatchups) return 'Loading matchups…';
      if (this.phase === 'past') return null;
      if (!this.scheduleReady) return 'Loading the NHL schedule for this week…';
      if (this.loadingPlayers && !this.players?.length) return 'Loading players for projections…';
      if (this.loadingRosters) return 'Loading rosters for projections…';
      return null;
    },
    // The NHL schedule has every day of the week, so projections are complete
    scheduleReady() {
      return !!this.selectedPeriod && coversPeriod(this.schedule, this.selectedPeriod);
    },
    // The days left to project, from the score's time
    remainingDays() {
      if (this.phase === 'past' || !this.selectedPeriod) return [];
      const from = this.phase === 'future' ? this.selectedPeriod.firstDay : dayOrdinalAt(this.selectedPeriod, this.league.fetchedAt);
      const days = [];
      for (let day = from; day <= this.selectedPeriod.lastDay; day++) days.push(day);
      return days;
    },
    myMatchupTeamIds() {
      return this.myTeamId && this.opponentId ? [this.myTeamId, this.opponentId] : [];
    },
    weekNote() {
      if (this.phase === 'past') return 'Final scores.';
      if (this.phase === 'future') return `Starts ${this.formatDay(this.selectedPeriod.start)}.`;
      return `Scores as of ${this.formatTime(this.league.fetchedAt)}.`;
    },
    // Each matchup's projected final scores and who's favored, by game id
    projections() {
      const startSlots = this.league.rules?.startSlots;
      if (this.phase === 'past' || !startSlots || !this.players?.length || !this.scheduleReady) {
        return {};
      }
      const teamGames = teamGamesPlayed(this.players);
      const playersById = new Map(this.players.map(player => [player.id, player]));
      // Future weeks start from nothing
      const scoreAsOf = this.phase === 'future' ? this.now : this.league.fetchedAt;
      const projections = {};
      for (const group of this.groups) {
        if (!group.matchup || group.teams.some(team => !this.rosters[team.teamId])) continue;
        const scores = group.teams.map((_, index) => this.phase === 'future' ? 0 : parseFloat(this.scoreFor(group, index)) || 0);
        // Both teams on the same basis: the lineups they've set if asked for and both are loaded,
        // else their best
        const setLineups = this.projectionLineup === 'set'
          && group.teams.every(team => this.remainingDays.every(day => this.dayLineups[team.teamId]?.[day]));
        const [first, second] = group.teams.map(team => projectTeam({
          lineupFor: day => (setLineups && this.dayLineups[team.teamId][day]) || this.rosters[team.teamId].groups,
          playersById,
          startSlots,
          schedule: this.schedule,
          period: this.selectedPeriod,
          method: this.projectionMethod,
          teamGames,
          scoreAsOf,
          lineup: setLineups ? 'set' : 'best',
          countDayToDay: this.projectionCountsDayToDay,
        }));
        // Nothing to project once the matchup's games are over
        if (gamesLeft(first) + gamesLeft(second) === 0) continue;
        const [firstExpected, secondExpected] = [first.expected, second.expected];
        const chance = winChance(scores[0], first, scores[1], second);
        const leader = chance >= 0.5 ? 0 : 1;
        projections[group.matchup.gameId] = {
          finals: [scores[0] + firstExpected, scores[1] + secondExpected].map(score => score.toFixed(1)),
          winLabel: `${group.teams[leader].name} ${formatChance(Math.max(chance, 1 - chance), true)} to win`,
          // The first team's, for the bar
          chance,
          chances: [formatChance(chance, true), formatChance(1 - chance, true)],
          // Set lineups were asked for but aren't loaded
          fallback: this.projectionLineup === 'set' && !setLineups,
        };
      }
      return projections;
    },
  },
  methods: {
    percent(fraction) {
      return `${Math.round(fraction * 1000) / 10}%`;
    },
    setKey(key, value) {
      this.$store.commit('setKeyValue', { key, value });
    },
    // From a matchup's Details, the same team's matchup a week earlier or later
    async pageMatchup({ teamId, delta }) {
      const target = delta < 0 ? this.previousPeriod : this.nextPeriod;
      if (!target) return;
      const matchups = await loadPeriodMatchups(this.leagueId, this.league.scoreboard, target.ordinal, { now: Date.now() });
      const matchup = matchups?.find(m => m.awayId === teamId || m.homeId === teamId);
      // Shown right away, rather than the week's list while its matchups load again
      this.periodMatchups = target.ordinal === this.league.scoreboard?.currentOrdinal ? null : matchups;
      this.selectPeriod(target.ordinal);
      this.$store.commit('setKeyValue', { key: 'openMatchupId', value: matchup?.gameId ?? null });
    },
    // Projections need the week's games
    loadSchedule() {
      if (this.selectedPeriod && this.phase !== 'past') {
        this.ensureSchedule(periodDates(this.selectedPeriod));
      }
    },
    selectPeriod(ordinal) {
      this.$store.commit('setKeyValue', { key: 'selectedPeriod', value: ordinal === this.currentOrdinal ? null : ordinal });
    },
    openMatchup(gameId) {
      this.$store.commit('setKeyValue', { key: 'openMatchupId', value: gameId });
      // Compare the matchup's teams until others are picked
      this.$store.commit('setKeyValue', { key: 'compareTeamIds', value: [] });
    },
    projectionFor(group) {
      return this.projections[group.matchup.gameId];
    },
    // A team's score; groups list your team first, which may be the home team
    scoreFor(group, index) {
      const { matchup } = group;
      return group.teams[index]?.teamId === matchup.homeId ? matchup.homeScore : matchup.awayScore;
    },
    statusLabel(group) {
      if (this.phase === 'future') return 'upcoming';
      return group.matchup.final || this.phase === 'past' ? 'final' : 'vs';
    },
    resultLabel(group) {
      const [first, second] = [0, 1].map(index => parseFloat(this.scoreFor(group, index)) || 0);
      if (first === second) return 'Tied';
      const winner = group.teams[first > second ? 0 : 1].name;
      return `${winner} won by ${Math.abs(first - second).toFixed(1)}`;
    },
    formatDay(time) {
      return new Date(time).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    },
    formatTime(time) {
      return time ? new Date(time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'unknown';
    },
    async loadLineups() {
      const days = this.remainingDays;
      if (!days.length || this.projectionLineup !== 'set') {
        this.dayLineups = {};
        return;
      }
      const teamIds = this.league.teams.map(team => team.id);
      const stored = await loadDayRosters(this.leagueId, teamIds, days, { fetch: false });
      this.dayLineups = stored;
      if (this.myMatchupTeamIds.length) {
        const mine = await loadDayRosters(this.leagueId, this.myMatchupTeamIds, days);
        this.dayLineups = { ...stored, ...mine };
      }
    },
    async loadMatchups() {
      const ordinal = this.selectedPeriod?.ordinal;
      if (ordinal === undefined || ordinal === this.league.scoreboard?.currentOrdinal) {
        this.periodMatchups = null;
        this.loadLineups();
        return;
      }
      this.loadingMatchups = true;
      const matchups = await loadPeriodMatchups(this.leagueId, this.league.scoreboard, ordinal, { now: Date.now() });
      // Another week may have been picked meanwhile
      if (ordinal === this.selectedPeriod?.ordinal) {
        this.periodMatchups = matchups;
        this.loadingMatchups = false;
        this.loadLineups();
      }
    },
  },
  watch: {
    'selectedPeriod.ordinal'() {
      this.loadMatchups();
      this.loadSchedule();
    },
    // Back from Details, which may have loaded lineups; or a different team picked as yours
    openMatchupId(id) {
      if (!id) this.loadLineups();
    },
    myTeamId() {
      this.loadLineups();
    },
    projectionLineup() {
      this.loadLineups();
    },
    // Refreshed: a team's move drops its stored lineups
    rosters() {
      this.loadLineups();
    },
  },
  mounted() {
    this.loadMatchups();
    this.loadSchedule();
  },
};
</script>

<style lang="scss" scoped>
.matchupsSection {
  padding: 0.75em 1em;
  display: flex;
  flex-direction: column;
  gap: 0.75em;
}

.visuallyHidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

.note {
  font-size: 0.9em;
  opacity: 0.85;
  margin: 0;
}

.matchups {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(420px, 1fr));
  gap: 0.75em;
}

.matchup {
  display: flex;
  flex-direction: column;
  gap: 0.5em;
  border: 1px solid rgba(127, 127, 127, 0.3);
  border-radius: 8px;
  padding: 0.75em;

  &.myMatchup {
    border-color: var(--teamSecondaryColor);
    border-width: 2px;
  }
}

.matchupTeams {
  position: relative;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1em;
}

.side {
  display: flex;
  flex-direction: column;
  gap: 0.15em;
  min-width: 0;

  &.right {
    align-items: flex-end;
    text-align: right;
  }
}

.sideName {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.3em;
  min-width: 0;
  max-width: 100%;
}

.right .sideName {
  justify-content: flex-end;
}

.teamName {
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.sideScore {
  font-size: 1.6em;
  font-weight: 700;
  line-height: 1.1;
}

.status {
  position: absolute;
  left: 50%;
  bottom: 0.3em;
  transform: translateX(-50%);
  font-size: 0.75em;
  text-transform: uppercase;
  opacity: 0.7;
}

.badge {
  font-size: 0.75em;
  font-weight: 700;
  padding: 0 0.4em;
  border-radius: 3px;
  background: var(--teamSecondaryColor);
  color: var(--teamMainColor);
  white-space: nowrap;

  &.opponentBadge {
    background: var(--opponentColor);
    color: var(--opponentTextColor);
  }
}

.winBar {
  display: flex;
  gap: 2px;
  height: 8px;

  span {
    min-width: 2px;

    &:first-child {
      border-radius: 4px 0 0 4px;
    }

    &:last-child {
      border-radius: 0 4px 4px 0;
    }
  }
}

.winLabels {
  display: flex;
  justify-content: space-between;
  margin-top: -0.3em;
  font-size: 0.8em;
  opacity: 0.85;
}

.matchupFooter {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.25em 0.75em;
  font-size: 0.9em;
}

.projectionControls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5em 1.5em;

  label {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5em;
    font-weight: normal;
    margin: 0;
  }

  select {
    font: inherit;
    color: inherit;
    background: var(--themeBaseColor);
    border: 1px solid currentColor;
    border-radius: 4px;
    padding: 0.3em 0.5em;
    min-height: 32px;
  }
}

.basis {
  opacity: 0.75;
}

.detailsButton {
  display: inline-flex;
  align-items: center;
  margin-left: auto;
  font: inherit;
  color: inherit;
  background: none;
  border: 1px solid rgba(127, 127, 127, 0.6);
  border-radius: 4px;
  padding: 0.15em 0.25em 0.15em 0.6em;
  min-height: 32px;
  cursor: pointer;

  .material-icons {
    font-size: 1.2em;
  }
}

// Phones: the pickers side by side, labels above them
@media (max-width: 640px) {
  .projectionControls {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr)) auto;
    align-items: end;
    gap: 0.5em;
    width: 100%;
  }

  .projectionControls label {
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

  .projectionControls select {
    width: 100%;
    font-size: 0.9em;
    padding: 0.2em 0.3em;
  }

  // Beside the first two pickers, the third goes on the next row
  .controlsHelp {
    grid-column: 3;
    grid-row: 1;
  }
}

@media (max-width: 640px) {
  .matchups {
    grid-template-columns: minmax(0, 1fr);
  }

  .sideScore {
    font-size: 1.35em;
  }
}
</style>
