<template>
  <Filter/>
  <Settings
    @refreshPlayers="refreshPlayers"
    @resetApp="resetApp"
  />
  <PlayerList
    ref="PlayerList"
    sport="nhl"
    :loading="loading"
    :players="players"
    :gamesByTeam="gamesByTeam"
    @playerSelected="(player) => selectPlayer(player)"
  />
  <PlayerCard
    :leagueId="leagueId"
    :teamAbbrToName="teamAbbrToName"
    @fleaflickerNav="toggleDrawer"
    @clearSelectedPlayer="clearSelectedPlayer"
  />
</template>

<script>
import {
  HOCKEY_TEAM_NAME_TO_ABBR,
  HOCKEY_TEAM_ABBR_TO_COLORS,
  HOCKEY_TEAM_ABBR_TO_NAME,
} from "./constants";
import { clearLocalStorage, getLocalStorage, setLocalStorage } from "../utils/storage";
import { getLeagueId } from "../utils/util";
import PlayerList from "./components/PlayerList.vue";
import PlayerCard from "./components/PlayerCard.vue";
import Settings from "./components/Settings.vue";
import Filter from "./components/Filter.vue";
import { loadHockeyPlayers } from "./collections/players";
import { mapGetters } from "vuex";
import { mapState } from "vuex/dist/vuex.cjs.js";
import { getGamesThisWeek } from "./api/nhlv2";

export default {
  data() {
    return {
      teamAbbrToName: HOCKEY_TEAM_ABBR_TO_NAME,
      leagueId: null,
      loading: true,
      players: [],
      gamesByTeam: {},
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
      this.gamesByTeam = result;
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
    debounceFiltering() {
      if (this.filterBufferTimer) {
        clearTimeout(this.filterBufferTimer);
      }

      this.filterBufferTimer = setTimeout(() => {
        this.$refs.PlayerList.setFilteredPlayers();
      }, 500);
    },
    toggleDrawer() {
      this.$store.commit('toggleKeyValue', drawerExpanded)
    },
    clearSelectedPlayer() {
      this.$store.commit('setKeyValue', {key: 'selectedPlayer', value: null})
    },
    selectPlayer(player) {
      if (this.selectedPlayer?.id !== player.id) {
        this.$store.commit('setKeyValue', {key: 'selectedPlayer', value: player})
      } else {
        this.$store.commit('setKeyValue', {key: 'selectedPlayer', value: null})
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

<style lang="scss">

</style>