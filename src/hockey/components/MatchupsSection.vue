<template>
  <MatchupView v-if="openGroup" :key="openGroup.matchup.gameId" :leagueId="leagueId" :league="league" :group="openGroup"
    :period="selectedPeriod" :rosters="rosters" :players="players" :schedule="schedule" :now="now"
    @close="openMatchup(null)" @openPlayer="$emit('openPlayer', $event)" />

  <section v-else class="matchupsSection containerColor" aria-labelledby="matchupsHeading">
    <h2 id="matchupsHeading" class="visuallyHidden">Matchups</h2>
    <div class="weekBar">
      <span class="weekPicker">
      <button type="button" class="iconButton" :disabled="!previousPeriod" aria-label="Previous week"
        @click="selectPeriod(previousPeriod.ordinal)">
        <span class="material-icons" aria-hidden="true">chevron_left</span>
      </button>
      <select :value="selectedPeriod?.ordinal" aria-label="Week" @change="selectPeriod(parseInt($event.target.value, 10))">
        <option v-for="period in periods" :key="period.ordinal" :value="period.ordinal">{{ periodLabel(period) }}</option>
      </select>
      <button type="button" class="iconButton" :disabled="!nextPeriod" aria-label="Next week"
        @click="selectPeriod(nextPeriod.ordinal)">
        <span class="material-icons" aria-hidden="true">chevron_right</span>
      </button>
      </span>
      <button v-if="selectedPeriod && selectedPeriod.ordinal !== currentOrdinal" type="button" class="textButton"
        @click="selectPeriod(null)">Back to this week</button>
    </div>

    <p class="note">{{ weekNote }}</p>
    <p v-if="loadingMatchups" class="note" role="status">Loading matchups…</p>
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
          <div class="matchupFooter">
            <span v-if="projectionFor(group)">
              Projected <strong>{{ projectionFor(group).finals[0] }}</strong> to <strong>{{ projectionFor(group).finals[1] }}</strong>
              · {{ projectionFor(group).winLabel }}
              <span v-if="!projectionFor(group).setLineups" class="basis"
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
import { currentPeriod, groupByMatchup, loadPeriodMatchups, loadDayRosters } from "../collections/league";
import { dayOrdinalAt } from "../collections/boxscores";
import { projectTeam, teamGamesPlayed, winChance, gamesLeft, formatChance } from "../collections/projection";

export default {
  components: { MatchupView },
  props: {
    leagueId: String,
    league: Object,
    rosters: Object,
    loadingRosters: Boolean,
    players: Array,
    schedule: Array,
    now: Number,
  },
  emits: ['openPlayer'],
  data() {
    return {
      // The selected week's matchups, when it isn't the current one
      periodMatchups: null,
      loadingMatchups: false,
      // { [teamId]: { [day]: groups } }: lineups set for the days left, for your matchup and any
      // matchup whose Details loaded them in the last few minutes
      dayLineups: {},
    };
  },
  computed: {
    ...mapState({
      myTeamId: state => state.myTeamId,
      selectedOrdinal: state => state.selectedPeriod,
      openMatchupId: state => state.openMatchupId,
      projectionMethod: state => state.projectionMethod,
    }),
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
      const lineups = 'Projections use the lineups teams have set for each day: always for your matchup, for others once '
        + "you've opened their Details. Until then they assume each team's best lineup.";
      if (this.phase === 'future') return `Starts ${this.formatDay(this.selectedPeriod.start)}. ${lineups}`;
      return `Scores as of ${this.formatTime(this.league.fetchedAt)}. ${lineups}`;
    },
    // Each matchup's projected final scores and who's favored, by game id
    projections() {
      const startSlots = this.league.rules?.startSlots;
      if (this.phase === 'past' || !startSlots || !this.players?.length || !this.schedule) {
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
        // Both teams on the same basis: the lineups they've set if both are loaded, else their best
        const setLineups = group.teams.every(team => this.remainingDays.every(day => this.dayLineups[team.teamId]?.[day]));
        const [first, second] = group.teams.map(team => projectTeam({
          lineupFor: day => (setLineups && this.dayLineups[team.teamId][day]) || this.rosters[team.teamId].groups,
          playersById,
          startSlots,
          schedule: this.schedule,
          period: this.selectedPeriod,
          method: this.projectionMethod,
          teamGames,
          scoreAsOf,
        }));
        // Nothing to project once the matchup's games are over
        if (gamesLeft(first) + gamesLeft(second) === 0) continue;
        // The projection to use, the set lineups' or the best lineups'
        const basis = (projection) => setLineups
          ? projection
          : { expected: projection.best, variance: projection.bestVariance };
        const [firstBasis, secondBasis] = [basis(first), basis(second)];
        const [firstExpected, secondExpected] = [firstBasis.expected, secondBasis.expected];
        const chance = winChance(scores[0], firstBasis, scores[1], secondBasis);
        const leader = chance >= 0.5 ? 0 : 1;
        projections[group.matchup.gameId] = {
          finals: [scores[0] + firstExpected, scores[1] + secondExpected].map(score => score.toFixed(1)),
          winLabel: `${group.teams[leader].name} ${formatChance(Math.max(chance, 1 - chance), true)} to win`,
          setLineups,
        };
      }
      return projections;
    },
  },
  methods: {
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
    periodLabel(period) {
      const dates = `${this.formatDay(period.start)} to ${this.formatDay(period.lastDayStart)}`;
      return `Matchup ${period.ordinal}: ${dates}${period.ordinal === this.currentOrdinal ? ' (this week)' : ''}`;
    },
    formatDay(time) {
      return new Date(time).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    },
    formatTime(time) {
      return time ? new Date(time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'unknown';
    },
    async loadLineups() {
      const days = this.remainingDays;
      if (!days.length) {
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
    },
    // Back from Details, which may have loaded lineups; or a different team picked as yours
    openMatchupId(id) {
      if (!id) this.loadLineups();
    },
    myTeamId() {
      this.loadLineups();
    },
  },
  mounted() {
    this.loadMatchups();
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

.weekBar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5em;

  select {
    flex: 0 1 auto;
    min-width: 0;
    text-overflow: ellipsis;
    max-width: 100%;
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
    background: #ef5350;
    color: #fff;
  }
}

.matchupFooter {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.25em 0.75em;
  font-size: 0.9em;
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

@media (max-width: 640px) {
  .matchups {
    grid-template-columns: minmax(0, 1fr);
  }

  .sideScore {
    font-size: 1.35em;
  }
}
</style>
