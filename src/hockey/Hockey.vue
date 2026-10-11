<template>
  <AppToolbar
    v-model:activeTab="activeTab"
    :loading="loading"
    :updatedAt="playersSavedAt"
    @refresh="refreshAll"
    @openHelp="setKey('openHelp', true)"
    @openSettings="setKey('openSettings', true)"
  />
  <div v-if="loadMessage" class="loadMessage containerColor" role="status">{{ loadMessage }}</div>

  <template v-if="activeTab === 'players'">
    <Filter />
    <PlayerList sport="nhl" :loading="loading" :players="players" :gamesByTeam="gamesByTeam"
      @playerSelected="(player) => selectPlayer(player)" />
    <PlayerCard :leagueId="leagueId" :teamAbbrToName="teamAbbrToName" @fleaflickerNav="toggleDrawer"
      @clearSelectedPlayer="clearSelectedPlayer" />
  </template>
  <ScheduleView v-else-if="activeTab === 'schedule'" />
  <LeagueView v-else-if="activeTab === 'league'" />

  <SettingsModal @reloadPlayers="loadPlayers()" @resetApp="resetApp" />
  <HelpModal />
</template>

<script>
import { HOCKEY_TEAM_ABBR_TO_NAME, TABS } from "./constants";
import { getLeagueId } from "../utils/util";
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
import { loadLeagueInfo } from "./collections/league";
import { recordLeagueVisit } from "../utils/recentLeagues";

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
    },
    async loadLeague(forceRefresh) {
      const league = await loadLeagueInfo(this.leagueId, { forceRefresh });
      if (league) {
        this.league = league;
        // For the Ownership filter
        this.setKey('owners', league.teams.map(team => team.name));
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
    const tabFromUrl = this.$route?.query?.tab;
    if (TABS.some(tab => tab.key === tabFromUrl)) {
      this.activeTab = tabFromUrl;
    }
  },
  mounted() {
    this.loadPlayers();
    this.loadGames();
    if (this.leagueId) {
      this.loadLeague();
    }
  },
  computed: {
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

<style lang="scss">
.loadMessage {
  padding: 0.5em;
  margin-bottom: 0.5em;
}
</style>