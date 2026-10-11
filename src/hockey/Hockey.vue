<template>
  <AppToolbar
    v-model:activeTab="activeTab"
    :loading="loading"
    :updatedAt="playersSavedAt"
    :addsLeft="myAddsLeft"
    @refresh="refreshAll"
    @openHelp="setKey('openHelp', true)"
    @openSettings="setKey('openSettings', true)"
  />
  <div v-if="loadMessage" class="loadMessage containerColor" role="status">{{ loadMessage }}</div>

  <template v-if="activeTab === 'players'">
    <Filter />
    <PlayerList sport="nhl" :loading="loading" :players="tablePlayers" :gamesByTeam="gamesByTeam"
      :availabilityKnown="!!waiverSettings" @playerSelected="(player) => selectPlayer(player)" />
  </template>
  <ScheduleView v-else-if="activeTab === 'schedule'" :schedule="schedule" />
  <LeagueView v-else-if="activeTab === 'league'" :leagueId="leagueId" :league="league" :players="tablePlayers"
    :now="now" @activityUpdated="setActivityLog" @openPlayer="openPlayerById" />

  <PlayerCard :leagueId="leagueId" :teamAbbrToName="teamAbbrToName" @fleaflickerNav="toggleDrawer"
    @clearSelectedPlayer="clearSelectedPlayer" />

  <SettingsModal @reloadPlayers="loadPlayers()" @resetApp="resetApp" />
  <HelpModal />
</template>

<script>
import { HOCKEY_TEAM_ABBR_TO_NAME, TABS } from "./constants";
import { getLeagueId, findMyTeamIdOnPage } from "../utils/util";
import PlayerList from "./components/PlayerList.vue";
import PlayerCard from "./components/PlayerCard.vue";
import Filter from "./components/Filter.vue";
import AppToolbar from "./components/AppToolbar.vue";
import SettingsModal from "./components/SettingsModal.vue";
import HelpModal from "./components/HelpModal.vue";
import ScheduleView from "./components/ScheduleView.vue";
import LeagueView from "./components/LeagueView.vue";
import { loadHockeyPlayers, LOAD_ERRORS } from "./collections/players";
import { clearAllStored } from "../utils/db";
import { mapState } from "vuex";
import { getGamesThisWeek } from "./api/nhlv2";
import { loadLeagueInfo, currentPeriod, acquisitionLimit, countAcquisitions } from "./collections/league";
import { recordLeagueVisit } from "../utils/recentLeagues";
import { getActivityLog, syncActivity } from "./collections/activity";
import { latestDrops, waiverStatus, availabilityLabel, availabilityOrder } from "./collections/waivers";
import { loadLastSeasonStats, lastSeasonFields } from "./collections/lastSeason";
import { usesLastSeason } from "./collections/columns";

// Waiver status depends on the time, so it's worked out again this often
const CLOCK_INTERVAL = 60 * 1000;

export default {
  data() {
    return {
      teamAbbrToName: HOCKEY_TEAM_ABBR_TO_NAME,
      leagueId: null,
      loading: true,
      players: [],
      playersSavedAt: null,
      loadError: null,
      latestLoadId: 0,
      gamesByTeam: {},
      gameWeek: {},
      league: null,
      // The NHL's next four weeks, see convertSchedule
      schedule: null,
      activityItems: [],
      // Back to when the stored activity is complete
      activityCoveredFrom: null,
      // Last season's stats by player id, loaded when a last season column is shown
      lastSeasonById: null,
      now: Date.now(),
      clock: null,
    };
  },
  components: {
    PlayerList,
    PlayerCard,
    Filter,
    AppToolbar,
    SettingsModal,
    HelpModal,
    ScheduleView,
    LeagueView,
  },
  methods: {
    async loadGames(forceRefresh) {
      this.gamesByTeam = {};
      const result = await getGamesThisWeek(forceRefresh);
      if (!result) {
        return;
      }
      this.gamesByTeam = result.gamesByTeam;
      this.schedule = result.schedule;
      this.$store.commit('setKeyValue', { key: 'gamesByMatchup', value: result.gamesByMatchup })
      this.$store.commit('setKeyValue', { key: 'weekStartDates', value: result.weekStartDates })
    },
    async loadPlayers(forceRefresh) {
      // Only show the result of the most recent load, e.g. after toggling a setting twice
      const loadId = ++this.latestLoadId;
      this.players = [];
      this.loading = true;
      const result = await loadHockeyPlayers(
        this.leagueId,
        this.excludeIfNoPoints,
        forceRefresh
      );
      if (loadId !== this.latestLoadId) {
        return;
      }
      this.players = result.players || [];
      this.playersSavedAt = result.savedAt;
      this.loadError = result.error;
      this.loading = false;
      if (this.players.length) {
        this.loadActivity();
        this.loadLastSeasonIfShown();
      }
    },
    async loadActivity() {
      // The player load reads new activity for ownership changes. Counting your team's adds also needs
      // it back to the start of the matchup.
      const period = currentPeriod(this.league?.scoreboard, Date.now());
      let log = null;
      if (this.$store.state.myTeamId && period) {
        try {
          log = await syncActivity(this.leagueId, { since: period.start, maxPages: 10 });
        } catch (err) {
          console.error(err);
        }
      }
      this.setActivityLog(log || await getActivityLog(this.leagueId));
    },
    setActivityLog(log) {
      this.activityItems = log.items;
      this.activityCoveredFrom = log.coveredFrom;
    },
    openPlayerById(playerId) {
      const player = this.tablePlayers.find(candidate => candidate.id === playerId);
      if (player) {
        this.setKey('selectedPlayer', player);
      }
    },
    async loadLastSeasonIfShown() {
      if (this.lastSeasonById || !usesLastSeason(this.$store.state.visibleColumnKeys)) {
        return;
      }
      this.lastSeasonById = await loadLastSeasonStats(this.leagueId);
    },
    async loadLeague(forceRefresh) {
      const league = await loadLeagueInfo(this.leagueId, { forceRefresh });
      if (league) {
        this.league = league;
        // For the Ownership filter
        this.setKey('owners', league.teams.map(team => team.name));
        if (this.players.length) {
          this.loadActivity();
        }
      }
      recordLeagueVisit({ id: this.leagueId, name: league?.name, sport: "nhl" });
    },
    setKey(key, value) {
      this.$store.commit('setKeyValue', { key, value });
    },
    toggleDrawer() {
      this.$store.commit('toggleDrawer')
    },
    clearSelectedPlayer() {
      this.$store.commit('setKeyValue', { key: 'selectedPlayer', value: null })
    },
    selectPlayer(player) {
      if (this.selectedPlayer?.id !== player.id) {
        this.$store.commit('setKeyValue', { key: 'selectedPlayer', value: player })
      } else {
        this.$store.commit('setKeyValue', { key: 'selectedPlayer', value: null })
      }
    },
    refreshAll() {
      this.loadPlayers(true);
      this.loadGames(true);
      if (this.leagueId) {
        this.loadLeague(true);
      }
    },
    async resetApp() {
      const confirmed = window.confirm(
        "Reset the app? This clears your filters and settings and fetches all players again, which can take a minute."
      );
      if (!confirmed) {
        return;
      }
      await clearAllStored();
      location.reload();
    }
  },
  created() {
    this.leagueId = getLeagueId();
    // The standalone site keeps the tab in the URL, so it can be linked to
    // In the extension, fleaflicker's menu links to the signed in user's team
    if (!process.env.STANDALONE && !this.$store.state.myTeamId) {
      const myTeamId = findMyTeamIdOnPage(this.leagueId);
      if (myTeamId) {
        this.setKey('myTeamId', myTeamId);
      }
    }
    const tabFromUrl = this.$route?.query?.tab;
    if (TABS.some(tab => tab.key === tabFromUrl)) {
      this.activeTab = tabFromUrl;
    }
  },
  mounted() {
    this.clock = setInterval(() => { this.now = Date.now(); }, CLOCK_INTERVAL);
    this.loadPlayers();
    this.loadGames();
    if (this.leagueId) {
      this.loadLeague();
    }
  },
  beforeUnmount() {
    clearInterval(this.clock);
  },
  watch: {
    "$store.state.visibleColumnKeys"() {
      if (!this.loading) {
        this.loadLastSeasonIfShown();
      }
    },
  },
  computed: {
    waiverSettings() {
      return this.league?.settings?.waivers;
    },
    drops() {
      return latestDrops(this.activityItems);
    },
    // Like "4 of 7 adds left", once the activity back to the matchup's start has been read
    myAddsLeft() {
      const myTeamId = this.$store.state.myTeamId;
      const limit = acquisitionLimit(this.league?.settings);
      const period = currentPeriod(this.league?.scoreboard, this.now);
      if (!myTeamId || limit === null || !period || this.activityCoveredFrom === null || this.activityCoveredFrom > period.start) {
        return null;
      }
      const left = Math.max(limit - countAcquisitions(this.activityItems, myTeamId, period), 0);
      return `${left} of ${limit} adds left`;
    },
    // Players with availability and last season's stats, for the table
    tablePlayers() {
      const context = { waivers: this.waiverSettings, drops: this.drops, now: this.now };
      return this.players.map(player => {
        const availability = waiverStatus(player, context);
        return {
          ...player,
          availability,
          availabilityLabel: availabilityLabel(availability, this.now),
          availabilityOrder: availabilityOrder(availability),
          ...lastSeasonFields(this.lastSeasonById, player.id),
        };
      });
    },
    loadMessage() {
      if (this.loading || !this.loadError) {
        return null;
      }
      if (this.loadError === LOAD_ERRORS.noLeague) {
        return "There's no league ID in the URL. Go back and enter your league ID.";
      }
      if (this.loadError === LOAD_ERRORS.leagueNotFound) {
        return `League ${this.leagueId} wasn't found on Fleaflicker. Check the league ID in the URL.`;
      }
      if (this.players.length && this.playersSavedAt) {
        const savedAt = new Date(this.playersSavedAt).toLocaleString([], {
          weekday: "short",
          hour: "numeric",
          minute: "2-digit",
        });
        return `Couldn't reach Fleaflicker, showing players saved ${savedAt}. Use Refresh to try again.`;
      }
      return "Couldn't reach Fleaflicker. Use Refresh to try again in a minute.";
    },
    activeTab: {
      get() {
        return this.$store.state.activeTab;
      },
      set(tab) {
        this.setKey('activeTab', tab);
        if (this.$router && this.$route.query.tab !== tab) {
          // Passing the path keeps its slashes, the route's param would encode them
          this.$router.replace({ path: this.$route.path, query: { ...this.$route.query, tab } });
        }
      },
    },
    ...mapState({
      excludeIfNoPoints: state => state.excludeIfNoPoints,
      selectedPlayer: state => state.selectedPlayer,
    }),
  },
};
</script>

<style lang="scss" scoped>
.loadMessage {
  padding: 0.5em;
  margin-bottom: 0.5em;
}
</style>