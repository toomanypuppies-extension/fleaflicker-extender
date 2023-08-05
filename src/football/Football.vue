<template>
  <div class="containerColor">
    <div>FOOTBALL TIME!</div>
    <ul>
      <li v-for="player in players" :key="player.id">{{ player.name }}</li>
    </ul>
  </div>
</template>

<script>
import { getAllFootballPlayers } from "../utils/flea";
export default {
  props: {
    leagueId: String,
  },
  data() {
    return {
      players: [],
      loading: true,
    };
  },
  created() {},
  mounted() {
    this.loadPlayers();
  },
  methods: {
    async loadPlayers(forceRefresh = false) {
      this.players = [];
      this.loading = true;
      const result = await getAllFootballPlayers(
        this.leagueId,
        // this.excludeIfNoPoints,
        false,
        forceRefresh
      );
      this.players = result;
      this.loading = false;
    },
  },
};
</script>

<style lang="scss">
</style>