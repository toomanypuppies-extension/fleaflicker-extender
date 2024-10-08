<template>
  <Filter />
  <Settings @refreshPlayers="refreshPlayers" @resetApp="resetApp" />
  <PlayerList ref="PlayerList" sport="nhl" :loading="loading" :players="players" :gamesByTeam="gamesByTeam"
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
import { loadHockeyPlayers } from "./collections/players";
import { mapGetters } from "vuex";
import { mapState } from "vuex/dist/vuex.cjs.js";
import { getGamesThisWeek } from "./api/nhlv2";
import { getLeagueOwners } from "../utils/flea";

export default {
  data() {
    return {
      teamAbbrToName: HOCKEY_TEAM_ABBR_TO_NAME,
      leagueId: null,
      loading: true,
      players: [],
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
      this.gamesByTeam = result.gamesByTeam;
      this.$store.commit('setKeyValue', { key: 'gamesByMatchup', value: result.gamesByMatchup })
      this.$store.commit('setKeyValue', { key: 'weekStartDates', value: result.weekStartDates })
    },
    async loadPlayers(forceRefresh) {
      this.players = [];
      this.loading = true;
      const result = await loadHockeyPlayers(
        this.leagueId,
        this.excludeIfNoPoints,
        forceRefresh
      );
      this.players = result;
      this.loading = false;
    },
    async loadOwners() {
      const owners = await getLeagueOwners(this.leagueId)
      this.$store.commit('setKeyValue', { key: 'owners', value: owners })
    },
    debounceFiltering() {
      if (this.filterBufferTimer) {
        clearTimeout(this.filterBufferTimer);
      }

      this.filterBufferTimer = setTimeout(() => {
        this.$refs.PlayerList.setFilteredPlayers();
      }, 500);
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
    resetApp() {
      localStorage.clear();
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

<style lang="scss"></style>