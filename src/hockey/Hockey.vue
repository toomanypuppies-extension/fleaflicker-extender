<template>
  <Filter />
  <Settings @refreshPlayers="refreshPlayers" @reloadPlayers="loadPlayers()" @resetApp="resetApp" />
  <div v-if="loadMessage" class="loadMessage containerColor">{{ loadMessage }}</div>
  <PlayerList sport="nhl" :loading="loading" :players="players" :gamesByTeam="gamesByTeam"
    @playerSelected="(player) => selectPlayer(player)" />
  <PlayerCard :leagueId="leagueId" :teamAbbrToName="teamAbbrToName" @fleaflickerNav="toggleDrawer"
    @clearSelectedPlayer="clearSelectedPlayer" />
</template>

<script>
import {
  HOCKEY_TEAM_NAME_TO_ABBR,
  HOCKEY_TEAM_ABBR_TO_COLORS,
  HOCKEY_TEAM_ABBR_TO_NAME,
} from "./constants";
import { getLeagueId } from "../utils/util";
import PlayerList from "./components/PlayerList.vue";
import PlayerCard from "./components/PlayerCard.vue";
import Settings from "./components/Settings.vue";
import Filter from "./components/Filter.vue";
import { loadHockeyPlayers, LOAD_ERRORS } from "./collections/players";
import { clearAllStored } from "../utils/db";
import { mapGetters, mapState } from "vuex";
import { getGamesThisWeek } from "./api/nhlv2";
import { loadLeagueOwners } from "./collections/owners";

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
    };
  },
  components: {
    PlayerList,
    PlayerCard,
    Settings,
    Filter,
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
    async loadOwners() {
      const owners = await loadLeagueOwners(this.leagueId)
      this.$store.commit('setKeyValue', { key: 'owners', value: owners })
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
    refreshPlayers() {
      this.loadPlayers(true);
      this.loadGames(true);
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
  },
  mounted() {
    this.loadPlayers();
    this.loadGames();
    this.loadOwners();
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
        return `Couldn't reach Fleaflicker, showing players saved ${savedAt}. Use Refresh Players to try again.`;
      }
      return "Couldn't reach Fleaflicker. Use Refresh Players to try again in a minute.";
    },
    ...mapState({
      excludeIfNoPoints: state => state.excludeIfNoPoints,
      drawerExpanded: state => state.drawerExpanded,
    }),
    ...mapGetters([
      'themeBaseColor',
      'themeAccentColor',
      'teamMainColor',
      'teamSecondaryColor'
    ]),
    bindCssVars() {
      return {
        "--themeAccentColor": this.themeAccentColor,
        "--themeBaseColor": this.themeBaseColor,
        "--teamMainColor": this.teamMainColor,
        "--teamSecondaryColor": this.teamSecondaryColor,
        "--teamSecondaryColor30Opacity": `${this.teamSecondaryColor}30`,
      };
    },
  },
};
</script>

<style lang="scss">
.loadMessage {
  padding: 0.5em;
  margin-bottom: 0.5em;
}
</style>