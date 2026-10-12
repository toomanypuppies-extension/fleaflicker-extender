<template>
  <div class="leagueView">
    <p v-if="!league" class="notice containerColor">League info couldn't be loaded. Use Refresh to try again.</p>

    <template v-else>
      <div class="leagueBar containerColor">
        <div class="sectionTabs" role="group" aria-label="League section">
          <button v-for="(label, key) in sections" :key="key" type="button" class="sectionTab"
            :class="{ active: section === key && !openTeam }" :aria-pressed="section === key && !openTeam"
            @click="showSection(key)">{{ label }}</button>
        </div>
        <label class="myTeamPicker">
          Your team
          <select :value="myTeamId ?? ''" @change="setMyTeam($event.target.value)">
            <option value="">Not picked</option>
            <option v-for="team in league.teams" :key="team.id" :value="team.id">{{ team.name }}</option>
          </select>
        </label>
      </div>

      <TeamView v-if="openTeam" :key="openTeam.teamId" :leagueId="leagueId" :league="league" :teamId="openTeam.teamId"
        :roster="rosters[openTeam.teamId]" :summary="openTeam" :period="period" :players="players" :schedule="schedule"
        :now="now" :activityItems="activityItems" :activityLoaded="activityLoaded" :activityLoading="loadingActivity"
        :activityError="activityError" :myTeamId="myTeamId" :opponentId="opponentId"
        @close="openTeamPage(null)" @openPlayer="openPlayer" />

      <MatchupsSection v-else-if="section === 'matchups'" :leagueId="leagueId" :league="league" :rosters="rosters"
        :loadingRosters="loadingRosters" :players="players" :schedule="schedule" :now="now"
        @openPlayer="openPlayer" @openTeam="openTeamPage" />

      <template v-else>
        <section class="rostersSection containerColor" aria-labelledby="rostersHeading">
          <div class="sectionHeader">
            <h2 id="rostersHeading">Rosters</h2>
          </div>
          <p v-if="period" class="periodNote">
            Adds are counted since this matchup started on {{ formatDay(period.start) }}.
            Open a team for its roster, projections and moves.
            <template v-if="acquisitionLimit === null && !league.settings">
              The league's add limit couldn't be loaded.
            </template>
          </p>
          <p v-if="loadingRosters" class="loading" role="status">Loading rosters…</p>

          <div class="teamCards">
            <button v-for="summary in summaries" :key="summary.teamId" type="button" class="teamCard"
              :class="{ mine: summary.teamId === myTeamId, opponent: summary.teamId === opponentId }"
              :title="`Open ${summary.name}`" @click="openTeamPage(summary.teamId)">
              <span class="cardTitle">
                <span class="teamName">{{ summary.name }}</span>
                <span v-if="summary.teamId === myTeamId" class="badge">You</span>
                <span v-if="summary.teamId === opponentId" class="badge opponentBadge">Your opponent</span>
                <span class="material-icons openIcon" aria-hidden="true">chevron_right</span>
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

        <ActivityTimeline :activityItems="activityItems" :teams="league.teams" :playersById="playersById" :period="period"
          :now="now" :loading="loadingActivity" :error="activityError" @openPlayer="openPlayer" />
      </template>
    </template>
  </div>
</template>

<script>
import { mapState } from "vuex";
import { syncActivity, TIMELINE_WINDOW } from "../collections/activity";
import {
  loadTeamRosters, summarizeTeam, currentPeriod, currentMatchup, acquisitionLimit,
} from "../collections/league";
import MatchupsSection from "./MatchupsSection.vue";
import ActivityTimeline from "./ActivityTimeline.vue";
import TeamView from "./TeamView.vue";

const SECTIONS = {
  matchups: 'Matchups',
  rosters: 'Rosters',
};

export default {
  components: { MatchupsSection, ActivityTimeline, TeamView },
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
      sections: SECTIONS,
    };
  },
  computed: {
    ...mapState({
      myTeamId: state => state.myTeamId,
      openTeamId: state => state.openTeamId,
      // Saved as 'activity' by an earlier version
      section: state => (state.leagueSection === 'matchups' ? 'matchups' : 'rosters'),
    }),
    period() {
      return currentPeriod(this.league?.scoreboard, this.now);
    },
    // Your team's opponent this week, only to tag their roster
    opponentId() {
      return this.myTeamId ? currentMatchup(this.league?.scoreboard, this.myTeamId)?.opponentId ?? null : null;
    },
    acquisitionLimit() {
      return acquisitionLimit(this.league?.settings);
    },
    playersById() {
      return new Map((this.players || []).map(player => [player.id, player]));
    },
    // Every team's status, yours first, then by standings
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
      return summaries.sort((a, b) => (b.teamId === this.myTeamId) - (a.teamId === this.myTeamId) || a.rank - b.rank);
    },
    openTeam() {
      return this.openTeamId ? this.summaries.find(summary => summary.teamId === this.openTeamId) || null : null;
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
    setKey(key, value) {
      this.$store.commit('setKeyValue', { key, value });
    },
    showSection(key) {
      this.setKey('openTeamId', null);
      this.setKey('leagueSection', key);
    },
    // A team's page, over whichever section it was opened from; null goes back
    openTeamPage(teamId) {
      this.setKey('openTeamId', teamId);
      this.$el?.scrollTo?.({ top: 0 });
    },
    setMyTeam(value) {
      this.$store.commit('setKeyValue', { key: 'myTeamId', value: value ? parseInt(value, 10) : null });
    },
    openPlayer(playerId) {
      this.$emit('openPlayer', playerId);
    },
    formatDay(time) {
      return new Date(time).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
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

.leagueBar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5em 1em;
  padding: 0.5em 1em;
}

.sectionTabs {
  display: flex;
  gap: 0.25em;
}

.sectionTab {
  font: inherit;
  font-weight: 700;
  color: inherit;
  background: none;
  border: none;
  border-bottom: 3px solid transparent;
  padding: 0.35em 0.6em;
  min-height: 36px;
  cursor: pointer;
  opacity: 0.75;

  &.active {
    opacity: 1;
    border-bottom-color: var(--teamSecondaryColor);
  }

  &:focus-visible {
    outline: 2px solid var(--teamSecondaryColor);
  }
}

.notice {
  padding: 1em;
}

.rostersSection {
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
.loading {
  font-size: 0.9em;
  opacity: 0.85;
  margin: 0 0 0.75em;
}

// minmax(0, ...) lets long team names shrink instead of widening the grid
.teamCards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(300px, 100%), 1fr));
  gap: 0.6em;
}

.teamCard {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.3em;
  min-width: 0;
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

  &:focus-visible {
    outline: 2px solid var(--teamSecondaryColor);
  }
}

.cardTitle {
  display: flex;
  align-items: center;
  gap: 0.5em;
  width: 100%;
  min-width: 0;
}

.teamName {
  font-weight: 700;
  font-size: 1.05em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.openIcon {
  margin-left: auto;
  opacity: 0.7;
}

.badge {
  flex: none;
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
</style>
