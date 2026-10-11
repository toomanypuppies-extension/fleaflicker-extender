<template>
  <div class="leagueView">
    <p v-if="!league" class="notice containerColor">League info couldn't be loaded. Use Refresh to try again.</p>

    <MatchupView v-else-if="openGroup" :leagueId="leagueId" :league="league" :group="openGroup" :period="period"
      :rosters="rosters" :players="players" :schedule="schedule" :now="now"
      @close="openMatchup(null)" @openPlayer="openPlayer" />

    <template v-else>
      <section class="teamsSection containerColor" aria-labelledby="teamsHeading">
        <div class="sectionHeader">
          <h2 id="teamsHeading">Teams</h2>
          <label class="myTeamPicker">
            Your team
            <select :value="myTeamId ?? ''" @change="setMyTeam($event.target.value)">
              <option value="">Not picked</option>
              <option v-for="team in league.teams" :key="team.id" :value="team.id">{{ team.name }}</option>
            </select>
          </label>
        </div>
        <p v-if="period" class="periodNote">
          Matchup {{ period.ordinal }}: {{ formatDay(period.start) }} to {{ formatDay(period.lastDayStart) }}.
          <template v-if="acquisitionLimit === null && !league.settings">
            The league's add limit couldn't be loaded.
          </template>
        </p>
        <p v-if="loadingRosters" class="loading" role="status">Loading rosters…</p>

        <div class="matchups">
          <section v-for="group in matchupGroups" :key="group.teams.map(team => team.teamId).join('-')" class="matchup"
            :class="{ myMatchup: group.teams.some(team => team.teamId === myTeamId) }"
            :aria-label="group.matchup ? group.teams.map(team => team.name).join(' vs ') : 'No matchup this period'">
          <h3 class="matchupHeader">
            <template v-if="group.matchup">
              <span class="matchupSide">
                <span class="matchupTeam">{{ group.teams[0].name }}</span>
                <span v-if="group.matchup.awayScore !== null" class="matchupScore">{{ scoreFor(group, 0) }}</span>
              </span>
              <span class="matchupVs">{{ group.matchup.inProgress ? 'vs' : 'final' }}</span>
              <span class="matchupSide right">
                <span v-if="group.matchup.homeScore !== null" class="matchupScore">{{ scoreFor(group, 1) }}</span>
                <span class="matchupTeam">{{ group.teams[1]?.name }}</span>
              </span>
            </template>
            <template v-else>No matchup this period</template>
          </h3>
          <div v-if="group.matchup" class="matchupProjection">
            <span v-if="projectionFor(group)">
              Projected <strong>{{ projectionFor(group).finals[0] }}</strong> to <strong>{{ projectionFor(group).finals[1] }}</strong>
              · {{ projectionFor(group).winLabel }}
            </span>
            <span v-else-if="loadingRosters">Projecting…</span>
            <span v-else-if="rosters[group.teams[0].teamId]">No games left to project</span>
            <button type="button" class="detailsButton" @click="openMatchup(group.matchup.gameId)">
              Details <span class="material-icons" aria-hidden="true">chevron_right</span>
            </button>
          </div>
          <div class="teamCards">
          <button v-for="summary in group.teams" :key="summary.teamId" type="button" class="teamCard"
            :class="{ mine: summary.teamId === myTeamId, opponent: summary.teamId === opponentId, selected: summary.teamId === timelineTeamId }"
            :aria-pressed="summary.teamId === timelineTeamId"
            :title="summary.teamId === timelineTeamId ? 'Show every team\'s moves' : `Show ${summary.name}'s moves`"
            @click="toggleTimelineTeam(summary.teamId)">
            <span class="cardTitle">
              <span class="teamName">{{ summary.name }}</span>
              <span v-if="summary.teamId === myTeamId" class="badge">You</span>
              <span v-if="summary.teamId === opponentId" class="badge opponentBadge">Your opponent</span>
            </span>
            <span class="cardMeta">{{ summary.record }} · waiver #{{ summary.waiverPosition }}</span>
            <span class="cardStats">
              <span v-if="!activityLoaded" class="stat pending">Counting adds…</span>
              <span v-else class="stat" :class="{ warn: summary.acquisitionsLeft === 0 }">
                <strong>{{ summary.acquisitionLimit === null ? summary.acquisitions : summary.acquisitionsLeft }}</strong>
                {{ summary.acquisitionLimit === null ? 'adds' : `of ${summary.acquisitionLimit} adds left` }}
              </span>
              <span v-if="summary.hasRoster" class="stat" :class="{ good: summary.openActiveSpots > 0, warn: summary.openActiveSpots < 0 }">
                <strong>{{ Math.abs(summary.openActiveSpots) }}</strong>
                {{ summary.openActiveSpots < 0 ? 'over the roster limit' : summary.openActiveSpots === 1 ? 'open spot' : 'open spots' }}
              </span>
              <span v-if="summary.hasRoster" class="stat">
                <strong>{{ summary.irCount }}/{{ summary.irSlots }}</strong> IR
              </span>
            </span>
            <span v-if="summary.irEligible.length" class="cardLine irEligible">
              Could go on IR: {{ summary.irEligible.map(player => `${player.name} (${player.injury})`).join(', ') }}
            </span>
          </button>
          </div>
          </section>
        </div>
      </section>

      <section class="timelineSection containerColor" aria-labelledby="timelineHeading">
        <div class="sectionHeader">
          <h2 id="timelineHeading">Last 14 days</h2>
          <div class="timelineFilters">
            <select :value="timelineTeamId ?? ''" aria-label="Team" @change="setTimelineTeam($event.target.value)">
              <option value="">Every team</option>
              <option v-for="team in league.teams" :key="team.id" :value="team.id">{{ team.name }}</option>
            </select>
            <button v-for="(filter, key) in timelineFilterOptions" :key="key" type="button" class="filterButton"
              :class="{ active: timelineFilters.includes(key) }" :aria-pressed="timelineFilters.includes(key)"
              @click="toggleFilter(key)">{{ filter.label }}</button>
          </div>
        </div>
        <p class="legendNote"><span class="periodSwatch"></span> In the current matchup</p>

        <p v-if="loadingActivity" class="loading" role="status">Loading league activity…</p>
        <p v-else-if="activityError" class="notice">League activity couldn't be loaded. Use Refresh to try again.</p>
        <p v-else-if="!timeline.length" class="notice">No moves match.</p>

        <ol class="timeline">
          <li v-for="day in timeline" :key="day.date" class="timelineDay">
            <h3>{{ dayLabel(day.date) }}</h3>
            <ul>
              <li v-for="row in day.rows" :key="row.key" class="timelineRow" :class="{ inPeriod: row.inPeriod }">
                <span class="rowTime">{{ formatTime(row.time) }}</span>
                <span class="rowTeam">{{ row.teamName || 'League' }}</span>
                <span class="rowText">
                  <template v-if="row.kind === 'swap'">
                    {{ row.added.kind === 'claim' ? 'claimed' : 'added' }}
                    <PlayerName :item="row.added" :players="playersById" @open="openPlayer" />,
                    dropped
                    <PlayerName :item="row.dropped" :players="playersById" @open="openPlayer" />
                    <span v-if="claimNote(row.added)" class="note">{{ claimNote(row.added) }}</span>
                  </template>
                  <template v-else-if="playerVerbs[row.kind]">
                    {{ playerVerbs[row.kind] }}
                    <PlayerName :item="row" :players="playersById" @open="openPlayer" />
                    <template v-if="row.kind === 'irOn'"> on IR</template>
                    <template v-if="row.kind === 'irOff'"> off IR</template>
                    <span v-if="claimNote(row)" class="note">{{ claimNote(row) }}</span>
                  </template>
                  <template v-else-if="row.kind === 'trade'">made a trade</template>
                  <template v-else-if="row.kind === 'membership'">team or owner change</template>
                  <template v-else>league change</template>
                </span>
              </li>
            </ul>
          </li>
        </ol>
      </section>
    </template>
  </div>
</template>

<script>
import { mapState } from "vuex";
import { syncActivity, TIMELINE_WINDOW } from "../collections/activity";
import {
  loadTeamRosters, summarizeTeam, currentPeriod, currentMatchup, acquisitionLimit, groupByMatchup,
} from "../collections/league";
import { buildTimeline, TIMELINE_FILTERS } from "../collections/timeline";
import PlayerName from "./PlayerName.vue";
import MatchupView from "./MatchupView.vue";
import { projectTeam, teamGamesPlayed, winChance, gamesLeft, formatChance } from "../collections/projection";

const PLAYER_VERBS = {
  add: 'added',
  claim: 'claimed',
  drop: 'dropped',
  irOn: 'moved',
  irOff: 'moved',
};

export default {
  components: { PlayerName, MatchupView },
  props: {
    leagueId: String,
    // From loadLeagueInfo
    league: Object,
    // The table's players, for opening player details
    players: Array,
    // The NHL schedule, for projections
    schedule: Array,
    now: Number,
  },
  emits: ['activityUpdated', 'openPlayer'],
  data() {
    return {
      activityItems: [],
      // Adds can't be counted until the activity has been read
      activityLoaded: false,
      rosters: {},
      loadingActivity: false,
      loadingRosters: false,
      activityError: false,
      playerVerbs: PLAYER_VERBS,
      timelineFilterOptions: TIMELINE_FILTERS,
    };
  },
  computed: {
    ...mapState({
      myTeamId: state => state.myTeamId,
      timelineTeamId: state => state.timelineTeamId,
      timelineFilters: state => state.timelineFilters,
      openMatchupId: state => state.openMatchupId,
      projectionMethod: state => state.projectionMethod,
    }),
    // The open matchup, if it's still in this period's scoreboard
    openGroup() {
      return this.openMatchupId ? this.matchupGroups.find(group => group.matchup?.gameId === this.openMatchupId) : null;
    },
    // Each matchup's projected final scores and win chance, by game id
    projections() {
      const startSlots = this.league?.rules?.startSlots;
      if (!startSlots || !this.players?.length || !this.schedule || !this.period) {
        return {};
      }
      const teamGames = teamGamesPlayed(this.players);
      const projections = {};
      for (const group of this.matchupGroups) {
        if (!group.matchup || group.teams.some(team => !this.rosters[team.teamId])) continue;
        const scores = group.teams.map((_, index) => parseFloat(this.scoreFor(group, index)) || 0);
        const [first, second] = group.teams.map(team => projectTeam({
          roster: this.rosters[team.teamId],
          playersById: this.playersById,
          startSlots,
          schedule: this.schedule,
          period: this.period,
          method: this.projectionMethod,
          teamGames,
          scoreAsOf: this.league.fetchedAt,
        }));
        // Nothing to project once the matchup's games are over
        if (gamesLeft(first) + gamesLeft(second) === 0) continue;
        const chance = winChance(scores[0], first, scores[1], second);
        const leader = chance >= 0.5 ? 0 : 1;
        projections[group.matchup.gameId] = {
          finals: [scores[0] + first.expected, scores[1] + second.expected].map(score => score.toFixed(1)),
          winLabel: `${group.teams[leader].name} ${formatChance(Math.max(chance, 1 - chance), true)} to win`,
        };
      }
      return projections;
    },
    period() {
      return currentPeriod(this.league?.scoreboard, this.now);
    },
    // Your team's opponent in the current matchup
    opponentId() {
      return this.myTeamId ? currentMatchup(this.league?.scoreboard, this.myTeamId)?.opponentId ?? null : null;
    },
    acquisitionLimit() {
      return acquisitionLimit(this.league?.settings);
    },
    playersById() {
      return new Map((this.players || []).map(player => [player.id, player]));
    },
    summaries() {
      const summaries = (this.league?.teams || []).map(team => ({
        ...summarizeTeam({
          team,
          roster: this.rosters[team.id],
          rules: this.league.rules,
          period: this.period,
          activityItems: this.activityItems,
          acquisitionLimit: this.acquisitionLimit,
        }),
        record: team.record,
        rank: team.rank,
        waiverPosition: team.waiverPosition,
      }));
      return summaries.sort((a, b) => a.rank - b.rank);
    },
    // Your matchup first, then the scoreboard's order
    matchupGroups() {
      return groupByMatchup(this.summaries, this.league?.scoreboard, this.myTeamId);
    },
    timeline() {
      return buildTimeline(this.activityItems, {
        since: this.now - TIMELINE_WINDOW,
        teamId: this.timelineTeamId,
        filters: this.timelineFilters,
        period: this.period,
      });
    },
  },
  methods: {
    async load() {
      if (!this.league || !this.leagueId) return;
      this.loadingActivity = true;
      this.activityError = false;
      try {
        // Back far enough for the timeline and for counting adds this matchup
        const since = Math.min(this.now - TIMELINE_WINDOW, this.period?.start ?? Infinity);
        const log = await syncActivity(this.leagueId, { since, now: this.now });
        this.activityItems = log.items;
        this.activityLoaded = true;
        this.$emit('activityUpdated', log);
      } catch (err) {
        console.error(err);
        this.activityError = true;
      }
      this.loadingActivity = false;

      this.loadingRosters = true;
      this.rosters = await loadTeamRosters(this.leagueId, this.league.teams.map(team => team.id), this.activityItems, { now: this.now });
      this.loadingRosters = false;
    },
    // A team's score in its matchup, groups list your team first, which may be the home team
    scoreFor(group, index) {
      const { matchup } = group;
      return group.teams[index]?.teamId === matchup.homeId ? matchup.homeScore : matchup.awayScore;
    },
    projectionFor(group) {
      return this.projections[group.matchup.gameId];
    },
    openMatchup(gameId) {
      this.$store.commit('setKeyValue', { key: 'openMatchupId', value: gameId });
      // Compare the matchup's teams until others are picked
      this.$store.commit('setKeyValue', { key: 'compareTeamIds', value: [] });
      this.$el?.scrollTo?.({ top: 0 });
    },
    setMyTeam(value) {
      this.$store.commit('setKeyValue', { key: 'myTeamId', value: value ? parseInt(value, 10) : null });
    },
    setTimelineTeam(value) {
      this.$store.commit('setKeyValue', { key: 'timelineTeamId', value: value ? parseInt(value, 10) : null });
    },
    toggleTimelineTeam(teamId) {
      this.$store.commit('setKeyValue', { key: 'timelineTeamId', value: this.timelineTeamId === teamId ? null : teamId });
    },
    toggleFilter(key) {
      const filters = this.timelineFilters.includes(key)
        ? this.timelineFilters.filter(filter => filter !== key)
        : [...this.timelineFilters, key];
      this.$store.commit('setKeyValue', { key: 'timelineFilters', value: filters });
    },
    openPlayer(playerId) {
      this.$emit('openPlayer', playerId);
    },
    claimNote(item) {
      return item.kind === 'claim' && item.claimTeams > 1 ? `(${item.claimTeams} teams claimed)` : '';
    },
    formatTime(time) {
      return new Date(time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    },
    formatDay(time) {
      return new Date(time).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    },
    dayLabel(date) {
      const [year, month, day] = date.split('-').map(Number);
      const label = new Date(year, month - 1, day).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
      const today = new Date(this.now);
      const isToday = today.getFullYear() === year && today.getMonth() === month - 1 && today.getDate() === day;
      return isToday ? `Today, ${label}` : label;
    },
  },
  watch: {
    league(league, previous) {
      if (league && !previous) {
        this.load();
      }
    },
  },
  mounted() {
    this.load();
  },
};
</script>

<style lang="scss" scoped>
.leagueView {
  display: flex;
  flex-direction: column;
  gap: 1em;
  overflow-y: auto;
  min-height: 0;
  flex: 1 1 auto;
}

.notice {
  padding: 1em;
}

.teamsSection,
.timelineSection {
  padding: 0.75em 1em;
}

.sectionHeader {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75em;
  margin-bottom: 0.5em;

  h2 {
    font-size: 1.2em;
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
}

.myTeamPicker {
  display: flex;
  align-items: center;
  gap: 0.5em;
  font-weight: normal;
  margin: 0;
}

.periodNote,
.loading,
.legendNote {
  font-size: 0.9em;
  opacity: 0.85;
  margin: 0 0 0.75em;
}

.matchups {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(520px, 1fr));
  gap: 1em;
}

.matchup {
  border: 1px solid rgba(127, 127, 127, 0.3);
  border-radius: 8px;
  padding: 0.6em;

  &.myMatchup {
    border-color: var(--teamSecondaryColor);
  }
}

.matchupHeader {
  display: flex;
  align-items: center;
  gap: 0.75em;
  font-size: 0.95em;
  font-weight: 700;
  margin: 0 0 0.5em;
}

.matchupSide {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.5em;
  min-width: 0;

  &.right {
    justify-content: flex-end;
    text-align: right;
  }
}

.matchupTeam {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.matchupProjection {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.25em 0.75em;
  font-size: 0.9em;
  margin: -0.25em 0 0.5em;
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

.matchupScore {
  font-size: 1.15em;
}

.matchupVs {
  font-size: 0.8em;
  font-weight: normal;
  opacity: 0.7;
  text-transform: uppercase;
}

// minmax(0, ...) lets long team names shrink instead of widening the grid
.teamCards {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5em;
}

@media (max-width: 640px) {
  .matchups {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 420px) {
  .teamCards {
    grid-template-columns: minmax(0, 1fr);
  }
}

.teamCard {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.3em;
  text-align: left;
  font: inherit;
  color: inherit;
  background: rgba(127, 127, 127, 0.08);
  border: 1px solid rgba(127, 127, 127, 0.3);
  border-radius: 6px;
  padding: 0.75em;
  cursor: pointer;

  &:hover {
    border-color: var(--teamSecondaryColor);
  }

  &.mine {
    border-color: var(--teamSecondaryColor);
    border-width: 2px;
  }

  &.opponent {
    border-color: #ef5350;
    border-width: 2px;
  }

  &.selected {
    background: var(--teamSecondaryColor30Opacity);
  }

  &:focus-visible {
    outline: 2px solid var(--teamSecondaryColor);
  }
}

.cardTitle {
  display: flex;
  align-items: center;
  gap: 0.5em;
}

.teamName {
  font-weight: 700;
  font-size: 1.05em;
}

.badge {
  font-size: 0.75em;
  font-weight: 700;
  padding: 0 0.4em;
  border-radius: 3px;
  background: var(--teamSecondaryColor);
  color: var(--teamMainColor);

  &.opponentBadge {
    background: #ef5350;
    color: #fff;
  }
}

.cardMeta,
.cardLine {
  font-size: 0.9em;
  opacity: 0.85;
}

.cardStats {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25em 1em;
  margin-top: 0.2em;
}

.stat {
  white-space: nowrap;

  &.good strong {
    color: #4caf50;
  }

  &.warn strong {
    color: #ef5350;
  }
}

.pending {
  opacity: 0.7;
  font-style: italic;
}

.irEligible {
  opacity: 1;
}

.timelineFilters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4em;
}

.filterButton {
  font: inherit;
  color: inherit;
  background: none;
  border: 1px solid currentColor;
  border-radius: 4px;
  padding: 0.25em 0.7em;
  min-height: 32px;
  cursor: pointer;
  opacity: 0.75;

  &.active {
    opacity: 1;
    background: var(--teamSecondaryColor30Opacity);
    border-color: var(--teamSecondaryColor);
  }

  &:focus-visible {
    outline: 2px solid var(--teamSecondaryColor);
  }
}

.periodSwatch {
  display: inline-block;
  width: 4px;
  height: 1em;
  vertical-align: middle;
  background: var(--teamSecondaryColor);
}

.timeline,
.timeline ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.timelineDay h3 {
  font-size: 0.95em;
  font-weight: 700;
  margin: 1em 0 0.4em;
}

.timelineRow {
  display: grid;
  grid-template-columns: 5.5em minmax(8em, 14em) 1fr;
  gap: 0.75em;
  padding: 0.35em 0.5em;
  border-left: 4px solid transparent;
  border-bottom: 1px solid rgba(127, 127, 127, 0.15);

  &.inPeriod {
    border-left-color: var(--teamSecondaryColor);
  }
}

.rowTime {
  opacity: 0.75;
  white-space: nowrap;
}

.rowTeam {
  font-weight: 600;
}

.note {
  opacity: 0.75;
  margin-left: 0.3em;
}

@media (max-width: 640px) {
  .timelineRow {
    grid-template-columns: 4.5em 1fr;
  }

  .rowText {
    grid-column: 2;
  }
}
</style>
