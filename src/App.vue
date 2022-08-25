<template>
  <Hockey v-if="sport === 'nhl'" />
</template>

<script>
import { getSport } from "./utils/util";
import Hockey from "./hockey/Hockey.vue";

export default {
  data() {
    return {
      sport: null,
    };
  },
  created() {
    this.sport = getSport();
  },
  components: {
    Hockey,
  },
};
</script>