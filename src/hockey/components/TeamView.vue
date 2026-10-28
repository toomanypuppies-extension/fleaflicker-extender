<template>
  <div class="teamView">
    <section class="statusSection containerColor" aria-labelledby="teamHeading">
    <div class="viewHeader">
      <button type="button" class="backButton" @click="$emit('close')">
        <span class="material-icons" aria-hidden="true">arrow_back</span> Back
      </button>
      <h2 id="teamHeading">{{ team.name }}</h2>
      <span v-if="teamId === myTeamId" class="badge">You</span>
      <span v-if="teamId === opponentId" class="badge opponentBadge">Your opponent</span>
      <a class="fleaLink" :href="teamLink" :target="fleaTarget" @click="leavingForFleaflicker">
        Team on Fleaflicker <span class="material-icons" aria-hidden="true">open_in_new</span>
      </a>
    </div>
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
      <button v-if="matchup" type="button" class="matchupButton" @click="$emit('openMatchup', matchup.gameId)">
        This week: vs {{ teamName(matchup.opponentId) }}, {{ matchup.score }}–{{ matchup.opponentScore }}
        <span class="material-icons" aria-hidden="true">chevron_right</span>
      </button>
    </section>

    <section class="depthSection containerColor" aria-labelledby="depthHeading">
      <div class="sectionHeader">
        <span class="titleWithHelp">
          <h3 id="depthHeading">Position depth</h3>
          <HelpTip label="position depth">
            <p>Everyone on the roster who can play each position, IR included, best first by season points.
              Players eligible at two positions count at both.</p>
            <p>Healthy leaves out injured players, day to day included.</p>
          </HelpTip>
        </span>
      </div>
      <p v-if="!roster" class="note">The roster couldn't be loaded. Use Refresh to try again.</p>
      <div v-else class="depthGrid">
        <div v-for="row in depth" :key="row.position" class="depthRow">
          <span class="depthPosition">{{ row.position }}</span>
          <span class="depthCount"><strong>{{ row.players.length }}</strong> eligible · {{ row.healthy }} healthy</span>
          <span class="depthPlayers">
            <template v-for="(player, index) in row.players" :key="player.id">
              <button type="button" class="playerButton" @click="$emit('openPlayer', player.id)">{{ player.name }}</button><span
                v-if="player.hurt" class="injury">{{ player.injury }}</span><template v-if="index < row.players.length - 1">, </template>
            </template>
            <template v-if="!row.players.length">None</template>
          </span>
        </div>
      </div>
    </section>

    <section class="seasonSection containerColor" aria-labelledby="seasonHeading">
      <div class="sectionHeader">
        <span class="titleWithHelp">
          <h3 id="seasonHeading">Current roster</h3>
          <HelpTip label="current roster">
            <p>Everyone on the roster, IR included. Select a heading to sort by it.</p>
            <p>Arrows mark recent games well above or below a player's usual. vs LY is points per game against last season's.
              Pos rank is Fleaflicker's fantasy rank at their position.</p>
            <p>Players without points this season aren't loaded unless Settings includes them, so they show without stats.</p>
          </HelpTip>
        </span>
      </div>
      <div v-if="roster" class="tableScroller">
        <table class="seasonTable">
          <thead>
            <tr>
              <th scope="col" class="playerColumn" :aria-sort="ariaSort('name')">
                <button type="button" class="sortButton" @click="sortBy('name')">Player {{ sortArrow('name') }}</button>
              </th>
              <th v-for="column in seasonColumns" :key="column.key" scope="col" :title="column.title" :aria-sort="ariaSort(column.key)">
                <button type="button" class="sortButton" @click="sortBy(column.key)">{{ column.short || column.name }} {{ sortArrow(column.key) }}</button>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="player in seasonPlayers" :key="player.id">
              <th scope="row" class="playerColumn">
                <button type="button" class="playerButton" @click="$emit('openPlayer', player.id)">{{ player.name }}</button>
                <span class="playerMeta">
                  {{ player.position }} · {{ player.team }}
                  <span v-if="player.injury" class="injury">{{ player.injury }}</span>
                  <span v-if="player.onIr" class="irTag">IR</span>
                </span>
              </th>
              <td v-for="column in seasonColumns" :key="column.key" :class="changeClass(column, player)">
                <template v-if="player.hasStats">
                  {{ cellValue(column, player) }}<span v-if="column.trendField && player[column.trendField]"
                    class="material-icons trend" :class="player[column.trendField]"
                    :title="player[column.trendField] === 'hot' ? 'Well above their usual' : 'Well below their usual'">{{
                      player[column.trendField] === 'hot' ? 'trending_up' : 'trending_down' }}</span>
                </template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-if="changeRows.length" class="changeSection containerColor" aria-labelledby="changeHeading">
      <div class="sectionHeader">
        <span class="titleWithHelp">
          <h3 id="changeHeading">This season vs last</h3>
          <HelpTip label="this season vs last">
            <p>Each player's points per game this season minus last season's: up is better than last year, down worse.</p>
            <p>Only players with games in both seasons.</p>
          </HelpTip>
        </span>
      </div>
      <BarChart title="Points per game, change from last season" rowHeading="Player" :series="[{ name: team.name }]"
        :rows="changeRows" :digits="2" />
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
import { rosterPlayers, positionDepth, changeFromLastSeason } from "../collections/rosterStats";
import { loadTeamDays, totalPoints, COMPARE_RANGES } from "../collections/boxscores";
import { COLUMNS_BY_KEY, cellText } from "../collections/columns";
import {
  playerBreakdown, positionBreakdown, playerChartRows, positionChartRows, TOP_PLAYERS,
} from "../collections/breakdowns";

// Players added to the chart by each "Show more"
const MORE_PLAYERS = 10;
import { ordinal } from "../../utils/util";

// Season columns from the Players tab's, with shorter headings where they're long
const SEASON_COLUMNS = [
  { key: 'gamesPlayed' },
  { key: 'points', short: 'Pts' },
  { key: 'avg' },
  { key: 'last5', short: 'L5' },
  { key: 'last10', short: 'L10' },
  { key: 'lastSeasonAvg' },
  { key: 'change', name: 'vs LY', title: "Points per game this season minus last season's", sortType: 'number' },
  { key: 'positionRank' },
  { key: 'percentOwned', short: 'Own%' },
].map(column => ({ ...COLUMNS_BY_KEY[column.key], ...column }));

/**
 * One team over the season: its standing, depth at each position, how its players are doing this
 * season and against last, where its points come from and its recent moves. Projections are on the
 * matchup page.
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
    // From currentMatchup, the team's matchup this week
    matchup: Object,
  },
  emits: ['close', 'openPlayer', 'openMatchup'],
  data() {
    return {
      ranges: COMPARE_RANGES,
      seasonColumns: SEASON_COLUMNS,
      sort: { key: 'points', desc: true },
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
    // Everyone on this team, with their stats (players is the whole league's)
    teamPlayers() {
      return rosterPlayers(this.roster, this.playersById).map(player => ({ ...player, change: changeFromLastSeason(player) }));
    },
    depth() {
      return positionDepth(this.teamPlayers);
    },
    // Sorted by the picked column; players without that stat last
    seasonPlayers() {
      const { key, desc } = this.sort;
      const column = SEASON_COLUMNS.find(candidate => candidate.key === key);
      const lowFirst = key !== 'name' && column?.sortType && column.sortType !== 'number' && column.sortType !== 'string';
      const value = (player) => (key === 'name' ? player.name : player[key]);
      return [...this.teamPlayers].sort((a, b) => {
        const [x, y] = [value(a), value(b)];
        const missing = (v) => v === undefined || v === null || v === '';
        if (missing(x) || missing(y)) return missing(x) - missing(y);
        const order = typeof x === 'string' ? x.localeCompare(y) : x - y;
        return (desc !== lowFirst ? -order : order);
      });
    },
    changeRows() {
      return this.teamPlayers
        .filter(player => player.change !== null)
        .sort((a, b) => b.change - a.change)
        .map(player => ({
          key: player.id,
          label: player.name,
          values: [player.change],
          details: [`${player.avg.toFixed(2)} per game this season, ${player.lastSeasonAvg.toFixed(2)} last season`],
        }));
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
    teamName(teamId) {
      return this.league.teams.find(team => team.id === teamId)?.name || 'Team';
    },
    cellValue(column, player) {
      if (column.key === 'change') {
        return player.change === null ? '' : `${player.change > 0 ? '+' : ''}${player.change.toFixed(2)}`;
      }
      return cellText(column, player);
    },
    changeClass(column, player) {
      if (column.key !== 'change' || !player.change) return null;
      return player.change > 0 ? 'better' : 'worse';
    },
    sortBy(key) {
      this.sort = this.sort.key === key ? { key, desc: !this.sort.desc } : { key, desc: key !== 'name' };
    },
    sortArrow(key) {
      return this.sort.key === key ? (this.sort.desc ? '▾' : '▴') : '';
    },
    ariaSort(key) {
      if (this.sort.key !== key) return 'none';
      return this.sort.desc ? 'descending' : 'ascending';
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
    background: var(--opponentColor);
    color: var(--opponentTextColor);
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
.depthSection,
.seasonSection,
.changeSection,
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

.matchupButton {
  display: inline-flex;
  align-self: flex-start;
  align-items: center;
  gap: 0.2em;
  font: inherit;
  font-size: 0.9em;
  color: inherit;
  background: none;
  border: 1px solid rgba(127, 127, 127, 0.6);
  border-radius: 999px;
  padding: 0.25em 0.4em 0.25em 0.75em;
  min-height: 32px;
  cursor: pointer;

  &:hover {
    border-color: var(--teamSecondaryColor);
  }

  &:focus-visible {
    outline: 2px solid var(--teamSecondaryColor);
  }

  .material-icons {
    font-size: 1.2em;
  }
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

.seasonTable {
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

  th[scope='row'] {
    text-align: left;
    font-weight: normal;
  }

  thead th {
    font-weight: 700;
    font-size: 0.85em;
  }

  thead th:first-child {
    text-align: left;
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

.depthGrid {
  display: flex;
  flex-direction: column;
}

.depthRow {
  display: grid;
  grid-template-columns: 2.5em 11em minmax(0, 1fr);
  gap: 0.25em 0.75em;
  align-items: baseline;
  padding: 0.4em 0;
  border-bottom: 1px solid rgba(127, 127, 127, 0.3);
}

.depthPosition {
  font-weight: 700;
}

.depthCount {
  font-size: 0.9em;
  white-space: nowrap;
}

.depthPlayers {
  font-size: 0.9em;
  line-height: 1.6;
}

.irTag {
  margin-left: 0.3em;
  padding: 0 0.3em;
  border-radius: 3px;
  font-weight: 700;
  border: 1px solid currentColor;
}

.sortButton {
  font: inherit;
  font-weight: 700;
  color: inherit;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  white-space: nowrap;
}

.better {
  color: #4caf50;
  font-weight: 700;
}

.worse {
  color: #ef5350;
  font-weight: 700;
}

@media (max-width: 640px) {
  .depthRow {
    grid-template-columns: 2.5em minmax(0, 1fr);
  }

  .depthPlayers {
    grid-column: 1 / -1;
  }
}

// Players stay put while their stats scroll sideways
.seasonTable .playerColumn {
  position: sticky;
  left: 0;
  z-index: 1;
  background: var(--themeBaseColor);
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
