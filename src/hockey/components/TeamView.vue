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
      <span class="meta">
        <strong>{{ ordinal(team.rank) }}</strong> of {{ league.teams.length }} · {{ team.record }}<template v-if="team.streak">
        ({{ team.streak }})</template> · PF {{ format(team.pointsFor) }}<template v-if="summary.pointsForRank">
        ({{ ordinal(summary.pointsForRank) }})</template> · PA {{ format(team.pointsAgainst) }} · waiver #{{ team.waiverPosition }}
      </span>
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
        <span class="titleWithHelp">
          <h3 id="rosterHeading">Roster</h3>
          <HelpTip label="the roster">
            <p>Today's lineup, with each player's stats this season. Games are what's left of this week.</p>
            <p>Arrows mark recent games well above or below a player's usual. Pos rank is Fleaflicker's fantasy rank at their position.</p>
            <p>Players without points this season aren't loaded unless Settings includes them, so they show without stats.</p>
          </HelpTip>
        </span>
      </div>
      <p v-if="!roster" class="note">The roster couldn't be loaded. Use Refresh to try again.</p>
      <div v-else class="tableScroller">
        <table class="rosterTable">
          <thead>
            <tr>
              <th scope="col">Slot</th>
              <th scope="col" class="playerColumn">Player</th>
              <th scope="col">Today</th>
              <th scope="col" title="Games left this week">Games</th>
              <th v-for="column in statColumns" :key="column.key" scope="col" :title="column.title">{{ column.short || column.name }}</th>
            </tr>
          </thead>
          <tbody v-for="group in rosterGroups" :key="group.key">
            <tr class="groupRow"><th :colspan="4 + statColumns.length" scope="rowgroup">{{ group.label }}</th></tr>
            <tr v-for="(slot, index) in group.slots" :key="`${group.key}-${index}`" :class="{ empty: !slot.player }">
              <td class="slot">{{ slot.label }}</td>
              <th scope="row" class="playerColumn">
                <template v-if="slot.player">
                  <button type="button" class="playerButton" @click="$emit('openPlayer', slot.player.id)">{{ slot.player.name }}</button>
                  <span class="playerMeta">
                    {{ slot.player.position }} · {{ slot.player.team }}
                    <span v-if="slot.player.injury" class="injury">{{ slot.player.injury }}</span>
                  </span>
                </template>
                <span v-else class="playerMeta">Empty</span>
              </th>
              <td class="textCell">{{ stats(slot.player?.id)?.todaysGame || '' }}</td>
              <td>{{ stats(slot.player?.id)?.gamesThisWeek ?? '' }}</td>
              <td v-for="column in statColumns" :key="column.key">
                <template v-if="stats(slot.player?.id)">
                  {{ statText(column, stats(slot.player.id)) }}<span v-if="column.trendField && stats(slot.player.id)[column.trendField]"
                    class="material-icons trend" :class="stats(slot.player.id)[column.trendField]"
                    :title="stats(slot.player.id)[column.trendField] === 'hot' ? 'Well above their usual' : 'Well below their usual'">{{
                      stats(slot.player.id)[column.trendField] === 'hot' ? 'trending_up' : 'trending_down' }}</span>
                </template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="pointsSection containerColor" aria-labelledby="pointsHeading">
      <div class="sectionHeader">
        <span class="titleWithHelp">
          <h3 id="pointsHeading">Where the points come from</h3>
          <HelpTip label="where the points come from">
            <p>Only points that counted: starters' points, not the bench's. Projections are on the matchup page.</p>
          </HelpTip>
        </span>
        <span class="rangeButtons" role="group" aria-label="Range">
          <button v-for="(range, key) in ranges" :key="key" type="button" class="filterButton"
            :class="{ active: teamRange === key }" :aria-pressed="teamRange === key"
            @click="setKey('teamRange', key)">{{ range.label }}</button>
        </span>
      </div>
      <p class="note">
        {{ format(totalPoints) }} points over {{ days.length }} days.
      </p>
      <p v-if="loadingDays" class="note" role="status">
        Loading box scores{{ progress.total ? ` ${progress.done} of ${progress.total}` : '' }}…
      </p>
      <p v-if="failed" class="note">{{ failed }} box scores couldn't be loaded, so totals may be low. Use Refresh to try again.</p>
      <div class="charts" :class="{ stale: loadingDays }">
        <div class="chart">
          <BarChart title="By player" rowHeading="Player" :series="[{ name: team.name }]"
            :rows="playerRows" />
          <div v-if="breakdownPlayers.length > topPlayers" class="moreButtons">
            <button v-if="hiddenPlayers > 0" type="button" class="filterButton" @click="shownPlayers += morePlayers">
              Show {{ Math.min(morePlayers, hiddenPlayers) }} more
            </button>
            <button v-if="shownPlayers > topPlayers" type="button" class="filterButton" @click="shownPlayers = topPlayers">
              Show fewer
            </button>
          </div>
        </div>
        <BarChart class="chart" title="By position" rowHeading="Position" :series="[{ name: team.name }]"
          :rows="positionRows" />
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
import HelpTip from "./HelpTip.vue";
import { ROSTER_GROUPS } from "../collections/league";
import { loadTeamDays, totalPoints, COMPARE_RANGES } from "../collections/boxscores";
import { COLUMNS_BY_KEY, cellText } from "../collections/columns";
import {
  playerBreakdown, positionBreakdown, playerChartRows, positionChartRows, TOP_PLAYERS,
} from "../collections/breakdowns";

// Players added to the chart by each "Show more"
const MORE_PLAYERS = 10;
import { ordinal } from "../../utils/util";

// The Players tab's stat columns shown for each player, with shorter headings where they're long
const STAT_COLUMNS = [
  { key: 'gamesPlayed' },
  { key: 'points', short: 'Pts' },
  { key: 'avg' },
  { key: 'last5', short: 'L5' },
  { key: 'last10', short: 'L10' },
  { key: 'goals' },
  { key: 'assists' },
  { key: 'goalsAgainst' },
  { key: 'savePct' },
  { key: 'positionRank' },
  { key: 'percentOwned', short: 'Own%' },
  { key: 'lastSeasonAvg' },
].map(column => ({ ...COLUMNS_BY_KEY[column.key], ...column }));

const GROUP_LABELS = {
  [ROSTER_GROUPS.start]: 'Starters',
  [ROSTER_GROUPS.bench]: 'Bench',
  [ROSTER_GROUPS.injured]: 'Injured reserve',
  [ROSTER_GROUPS.taxi]: 'Taxi squad',
};

/**
 * One team: its status, roster with each player's stats, where its points come from and its
 * recent moves. Projections are on the matchup page.
 */
export default {
  components: { BarChart, ActivityTimeline, HelpTip },
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
      ranges: COMPARE_RANGES,
      statColumns: STAT_COLUMNS,
      days: [],
      failed: 0,
      loadingDays: true,
      progress: { done: 0, total: 0 },
      // Only the latest load is shown
      loadId: 0,
      // Players with their own bar, the rest are one row
      shownPlayers: TOP_PLAYERS,
      topPlayers: TOP_PLAYERS,
      morePlayers: MORE_PLAYERS,
    };
  },
  computed: {
    ...mapState({
      teamRange: state => state.teamRange,
      drawerExpanded: state => state.drawerExpanded,
    }),
    team() {
      return this.league.teams.find(team => team.id === this.teamId) || { name: 'Team' };
    },
    playersById() {
      return new Map((this.players || []).map(player => [player.id, player]));
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
    breakdownPlayers() {
      return playerBreakdown(this.days);
    },
    // Players folded into the "others" row
    hiddenPlayers() {
      return Math.max(this.breakdownPlayers.length - this.shownPlayers, 0);
    },
    playerRows() {
      return playerChartRows(this.breakdownPlayers, { shown: this.shownPlayers });
    },
    positionRows() {
      return positionChartRows([positionBreakdown(this.days)]);
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
    statText(column, player) {
      return cellText(column, player);
    },
    format(value) {
      return (value ?? 0).toFixed(1);
    },
    ordinal,
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
  },
  watch: {
    teamRange() {
      this.loadDays();
    },
  },
  mounted() {
    this.loadDays();
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

.titleWithHelp {
  display: inline-flex;
  align-items: center;
  gap: 0.15em;
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

  thead th:nth-child(-n + 3),
  .textCell {
    text-align: left;
  }

  .textCell {
    white-space: nowrap;
  }

  .groupRow th {
    text-align: left;
    font-weight: 700;
    padding-top: 0.75em;
  }

  .slot,
  thead th:first-child {
    width: 3.5em;
    min-width: 3.5em;
    max-width: 3.5em;
    box-sizing: border-box;
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
  white-space: nowrap;
}

.playerColumn {
  min-width: 10em;
}

// Slot and player stay put while the stats scroll sideways
.rosterTable .slot,
.rosterTable thead th:first-child,
.rosterTable .playerColumn {
  position: sticky;
  z-index: 1;
  background: var(--themeBaseColor);
}

.rosterTable .slot,
.rosterTable thead th:first-child {
  left: 0;
}

.rosterTable .playerColumn {
  left: 3.5em;
  box-shadow: 1px 0 0 rgba(127, 127, 127, 0.3);
}

.injury {
  margin-left: 0.3em;
  padding: 0 0.3em;
  border-radius: 3px;
  font-weight: 700;
  color: #fff;
  background: #c62828;
}

.trend {
  font-size: 1em;
  vertical-align: -2px;
  margin-left: 0.15em;

  &.hot {
    color: #4caf50;
  }

  &.cold {
    color: #ef5350;
  }
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

.moreButtons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5em;
  margin-top: 0.6em;
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
