<template>
  <div class="teamView">
    <div class="viewHeader">
      <button type="button" class="backButton" @click="$emit('close')">
        <span class="material-icons" aria-hidden="true">arrow_back</span> Back
      </button>
      <h2>{{ team.name }}</h2>
      <span v-if="teamId === myTeamId" class="badge">You</span>
      <span v-if="teamId === opponentId" class="badge opponentBadge">Your opponent</span>
      <a class="fleaLink" :href="teamLink" :target="fleaTarget" @click="leavingForFleaflicker">
        Team on Fleaflicker <span class="material-icons" aria-hidden="true">open_in_new</span>
      </a>
    </div>

    <section class="statusSection containerColor" aria-label="Status">
      <span class="meta">{{ team.record }} · {{ ordinal(team.rank) }} in the standings · waiver #{{ team.waiverPosition }}</span>
      <div class="stats">
        <span v-if="!activityLoaded" class="stat pending">Counting adds…</span>
        <span v-else class="stat" :class="{ warn: summary.acquisitionsLeft === 0 }">
          <strong>{{ summary.acquisitionLimit === null ? summary.acquisitions : summary.acquisitionsLeft }}</strong>
          {{ summary.acquisitionLimit === null ? 'adds this matchup' : `of ${summary.acquisitionLimit} adds left` }}
        </span>
        <span v-if="summary.hasRoster" class="stat" :class="{ good: summary.openActiveSpots > 0, warn: summary.openActiveSpots < 0 }">
          <strong>{{ Math.abs(summary.openActiveSpots) }}</strong>
          {{ summary.openActiveSpots < 0 ? 'over the roster limit' : summary.openActiveSpots === 1 ? 'open spot' : 'open spots' }}
        </span>
        <span v-if="summary.hasRoster" class="stat"><strong>{{ summary.irCount }}/{{ summary.irSlots }}</strong> IR spots used</span>
      </div>
      <p v-if="summary.irEligible.length" class="note">
        Could go on IR: {{ summary.irEligible.map(player => `${player.name} (${player.injury})`).join(', ') }}
      </p>
    </section>

    <section class="rosterSection containerColor" aria-labelledby="rosterHeading">
      <div class="sectionHeader">
        <h3 id="rosterHeading">Roster</h3>
        <div class="pickers">
          <label>
            Projected lineups
            <select :value="lineupChoice" @change="setKey('projectionLineup', $event.target.value)">
              <option v-for="(option, key) in lineups" :key="key" :value="key">{{ option.label }}</option>
            </select>
          </label>
          <label>
            Points per game from
            <select :value="method" @change="setKey('projectionMethod', $event.target.value)">
              <option v-for="(option, key) in methods" :key="key" :value="key">{{ option.label }}</option>
            </select>
          </label>
        </div>
      </div>
      <p v-if="period" class="note">
        Today's lineup. Starts, projected and bench points are for the rest of this matchup
        ({{ formatDay(period.start) }} to {{ formatDay(period.lastDayStart) }}):
        {{ format(projection.expected) }} projected<template v-if="projection.bench > 0">, {{ format(projection.bench) }} on the bench</template>.
      </p>
      <p v-if="!roster" class="note">The roster couldn't be loaded. Use Refresh to try again.</p>
      <div v-else class="tableScroller">
        <table class="rosterTable">
          <thead>
            <tr>
              <th scope="col">Slot</th>
              <th scope="col">Player</th>
              <th scope="col">Pts/game</th>
              <th scope="col" title="Games left in the lineup this matchup">Starts</th>
              <th scope="col">Projected</th>
              <th scope="col" title="Games left on the bench, and their expected points">Bench</th>
            </tr>
          </thead>
          <tbody v-for="group in rosterGroups" :key="group.key">
            <tr class="groupRow"><th colspan="6" scope="rowgroup">{{ group.label }}</th></tr>
            <tr v-for="(slot, index) in group.slots" :key="`${group.key}-${index}`" :class="{ empty: !slot.player }">
              <td class="slot">{{ slot.label }}</td>
              <th scope="row">
                <template v-if="slot.player">
                  <button type="button" class="playerButton" @click="$emit('openPlayer', slot.player.id)">{{ slot.player.name }}</button>
                  <span class="playerMeta">
                    {{ slot.player.position }} · {{ slot.player.team }}
                    <template v-if="slot.player.injury"> · {{ slot.player.injury }}</template>
                    <template v-if="projected(slot.player.id)?.startRate < 1 && !projected(slot.player.id)?.injured">
                      · starts {{ percent(projected(slot.player.id).startRate) }}
                    </template>
                  </span>
                </template>
                <span v-else class="playerMeta">Empty</span>
              </th>
              <td>{{ slot.player ? format(projected(slot.player.id)?.rate ?? stats(slot.player.id)?.avg) : '' }}</td>
              <td>{{ projected(slot.player?.id)?.games ?? '' }}</td>
              <td>{{ projected(slot.player?.id) ? format(projected(slot.player.id).expected) : '' }}</td>
              <td>{{ benchCell(slot.player?.id) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="pointsSection containerColor" aria-labelledby="pointsHeading">
      <div class="sectionHeader">
        <h3 id="pointsHeading">Where the points come from</h3>
        <span class="rangeButtons" role="group" aria-label="Range">
          <button v-for="(range, key) in ranges" :key="key" type="button" class="filterButton"
            :class="{ active: teamRange === key }" :aria-pressed="teamRange === key"
            @click="setKey('teamRange', key)">{{ range.label }}</button>
        </span>
      </div>
      <p class="note">
        Only points that counted: starters' points, not the bench's.
        <template v-if="period">The lighter part of each bar is what's projected for the rest of this matchup.</template>
        {{ format(totalPoints) }} points over {{ days.length }} days<template v-if="period"> + {{ format(projection.expected) }} projected</template>.
      </p>
      <p v-if="loadingDays" class="note" role="status">
        Loading box scores{{ progress.total ? ` ${progress.done} of ${progress.total}` : '' }}…
      </p>
      <p v-if="failed" class="note">{{ failed }} box scores couldn't be loaded, so totals may be low. Use Refresh to try again.</p>
      <div class="charts" :class="{ stale: loadingDays }">
        <BarChart class="chart" title="By player" rowHeading="Player" :series="[{ name: team.name }]"
          :rows="playerRows" :stacked="!!period" />
        <BarChart class="chart" title="By position" rowHeading="Position" :series="[{ name: team.name }]"
          :rows="positionRows" :stacked="!!period" />
      </div>
    </section>

    <ActivityTimeline :activityItems="activityItems" :teams="league.teams" :playersById="playersById" :period="period"
      :now="now" :loading="activityLoading" :error="activityError" :teamId="teamId" @openPlayer="$emit('openPlayer', $event)" />
  </div>
</template>

<script>
import { mapState } from "vuex";
import BarChart from "./BarChart.vue";
import ActivityTimeline from "./ActivityTimeline.vue";
import { ROSTER_GROUPS, loadDayRosters } from "../collections/league";
import { loadTeamDays, totalPoints, dayOrdinalAt, COMPARE_RANGES } from "../collections/boxscores";
import { periodDates } from "../collections/scheduleWeeks";
import { playerBreakdown, positionBreakdown, playerChartRows, positionChartRows } from "../collections/breakdowns";
import { projectTeam, teamGamesPlayed, PROJECTION_METHODS, PROJECTION_LINEUPS } from "../collections/projection";

const GROUP_LABELS = {
  [ROSTER_GROUPS.start]: 'Starters',
  [ROSTER_GROUPS.bench]: 'Bench',
  [ROSTER_GROUPS.injured]: 'Injured reserve',
  [ROSTER_GROUPS.taxi]: 'Taxi squad',
};

/**
 * One team: its status, roster with this matchup's projections, where its points come from and
 * its recent moves.
 */
export default {
  components: { BarChart, ActivityTimeline },
  // From Hockey, loads schedule weeks
  inject: { ensureSchedule: { default: () => async () => {} } },
  props: {
    leagueId: String,
    league: Object,
    teamId: Number,
    // From loadTeamRosters, today's lineup
    roster: Object,
    // From summarizeTeam
    summary: Object,
    // The current matchup period
    period: Object,
    // The table's players
    players: Array,
    schedule: Array,
    now: Number,
    activityItems: Array,
    activityLoaded: Boolean,
    activityLoading: Boolean,
    activityError: Boolean,
    myTeamId: Number,
    opponentId: Number,
  },
  emits: ['close', 'openPlayer'],
  data() {
    return {
      methods: PROJECTION_METHODS,
      lineups: PROJECTION_LINEUPS,
      ranges: COMPARE_RANGES,
      // { [day]: groups }, the lineups set for the days left, for "As set" projections
      dayLineups: null,
      days: [],
      failed: 0,
      loadingDays: true,
      progress: { done: 0, total: 0 },
      // Only the latest load is shown
      loadId: 0,
    };
  },
  computed: {
    ...mapState({
      method: state => state.projectionMethod,
      lineupChoice: state => state.projectionLineup,
      teamRange: state => state.teamRange,
      drawerExpanded: state => state.drawerExpanded,
    }),
    team() {
      return this.league.teams.find(team => team.id === this.teamId) || { name: 'Team' };
    },
    playersById() {
      return new Map((this.players || []).map(player => [player.id, player]));
    },
    remainingDays() {
      if (!this.period) return [];
      const days = [];
      for (let day = dayOrdinalAt(this.period, this.league.fetchedAt); day <= this.period.lastDay; day++) days.push(day);
      return days;
    },
    projection() {
      return projectTeam({
        // The best lineup only needs who's on the roster
        lineupFor: day => (this.lineupChoice === 'set' && this.dayLineups?.[day]) || this.roster?.groups || null,
        lineup: this.lineupChoice,
        playersById: this.playersById,
        startSlots: this.league.rules?.startSlots,
        schedule: this.schedule,
        period: this.period,
        method: this.method,
        teamGames: teamGamesPlayed(this.players || []),
        scoreAsOf: this.league.fetchedAt,
      });
    },
    projectedById() {
      return new Map(this.projection.players.map(player => [player.id, player]));
    },
    rosterGroups() {
      const order = [ROSTER_GROUPS.start, ROSTER_GROUPS.bench, ROSTER_GROUPS.injured, ROSTER_GROUPS.taxi];
      return order
        .map(key => ({
          key,
          label: GROUP_LABELS[key],
          slots: (this.roster?.groups || []).filter(group => group.group === key).flatMap(group => group.slots),
        }))
        .filter(group => group.slots.length);
    },
    totalPoints() {
      return totalPoints(this.days);
    },
    playerRows() {
      return playerChartRows(playerBreakdown(this.days, this.period ? this.projection : null), { stacked: !!this.period });
    },
    positionRows() {
      return positionChartRows([positionBreakdown(this.days, this.period ? this.projection : null)], { stacked: !!this.period });
    },
    fleaTarget() {
      return process.env.STANDALONE ? '_blank' : '_self';
    },
    teamLink() {
      return `https://www.fleaflicker.com/nhl/leagues/${this.leagueId}/teams/${this.teamId}`;
    },
  },
  methods: {
    setKey(key, value) {
      this.$store.commit('setKeyValue', { key, value });
    },
    stats(playerId) {
      return this.playersById.get(playerId);
    },
    projected(playerId) {
      return playerId ? this.projectedById.get(playerId) : undefined;
    },
    benchCell(playerId) {
      const player = this.projected(playerId);
      return player?.benchGames ? `${player.benchGames} (${this.format(player.benchExpected)})` : '';
    },
    format(value) {
      return (value ?? 0).toFixed(1);
    },
    percent(fraction) {
      return `${Math.round(fraction * 100)}%`;
    },
    ordinal(rank) {
      const suffix = { 1: 'st', 2: 'nd', 3: 'rd' }[rank % 10 > 3 || Math.floor(rank / 10) === 1 ? 0 : rank % 10] || 'th';
      return `${rank}${suffix}`;
    },
    formatDay(time) {
      return new Date(time).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    },
    // In the extension links open in this tab, so close the panel to show fleaflicker's page
    leavingForFleaflicker() {
      if (!process.env.STANDALONE && this.drawerExpanded) {
        this.$store.commit('toggleDrawer');
      }
    },
    async loadDays() {
      const loadId = ++this.loadId;
      this.loadingDays = true;
      this.progress = { done: 0, total: 0 };
      const { days, failed } = await loadTeamDays(this.leagueId, {
        scoreboard: this.league.scoreboard,
        teamIds: [this.teamId],
        range: this.teamRange,
        endPeriod: this.period?.ordinal ?? null,
        now: Date.now(),
        onProgress: (done, total) => {
          if (loadId === this.loadId) this.progress = { done, total };
        },
      });
      if (loadId !== this.loadId) return;
      this.days = days[this.teamId] || [];
      this.failed = failed;
      this.loadingDays = false;
    },
    async loadLineups() {
      if (this.lineupChoice !== 'set' || !this.remainingDays.length || this.dayLineups) return;
      const lineups = await loadDayRosters(this.leagueId, [this.teamId], this.remainingDays, { now: Date.now() });
      this.dayLineups = lineups[this.teamId] || {};
    },
  },
  watch: {
    teamRange() {
      this.loadDays();
    },
    lineupChoice() {
      this.loadLineups();
    },
  },
  mounted() {
    if (this.period) {
      this.ensureSchedule(periodDates(this.period));
    }
    this.loadDays();
    this.loadLineups();
  },
};
</script>

<style lang="scss" scoped>
.teamView {
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

.fleaLink {
  display: inline-flex;
  align-items: center;
  gap: 0.25em;
  font-size: 0.9em;
  color: inherit;
  text-decoration: underline;
  text-decoration-color: rgba(127, 127, 127, 0.6);

  .material-icons {
    font-size: 1.1em;
  }
}

.statusSection,
.rosterSection,
.pointsSection {
  padding: 0.75em 1em;
  display: flex;
  flex-direction: column;
  gap: 0.6em;
}

.meta,
.note {
  font-size: 0.9em;
  opacity: 0.85;
  margin: 0;
}

.stats {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25em 1.5em;
  font-size: 1.05em;
}

.stat {
  white-space: nowrap;

  strong {
    font-size: 1.2em;
  }

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

.pickers {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5em 1.5em;

  label {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5em;
    font-weight: normal;
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

.tableScroller {
  overflow-x: auto;
}

.rosterTable {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9em;
  font-variant-numeric: tabular-nums;

  th,
  td {
    padding: 0.3em 0.5em;
    border-bottom: 1px solid rgba(127, 127, 127, 0.3);
    text-align: right;
    vertical-align: top;
  }

  th[scope='row'],
  .slot {
    text-align: left;
    font-weight: normal;
  }

  thead th {
    font-weight: 700;
    font-size: 0.85em;
  }

  thead th:nth-child(-n + 2) {
    text-align: left;
  }

  .groupRow th {
    text-align: left;
    font-weight: 700;
    padding-top: 0.75em;
  }

  .slot {
    width: 3.5em;
    opacity: 0.8;
  }

  .empty {
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

.charts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1em;
  transition: opacity 0.2s;

  // Keep the previous numbers while new ones load
  &.stale {
    opacity: 0.55;
  }
}

@media (max-width: 640px) {
  .charts {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
