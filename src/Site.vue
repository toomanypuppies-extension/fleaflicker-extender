<template>
  <div class="container">
    <va-card
      color="background"
      style="padding: 0.75em; margin-bottom: 1em;"
    >
      <h3>Fleaflicker Extender</h3>
      <p>Welcome to the fleaflicker extended. To use this, select the sport, enter your league id, and then click 'Go'!
      </p>
      <p>Your league id is the number that comes after 'leagues' in the url when on the fleaflicker site.
      </p>
      <p>Ex:
        'https://www.fleaflicker.com/nhl/leagues/<b>12089</b>'</p>
    </va-card>
    <va-card
      color="background"
      style="padding: 0.75em;"
    >

      <div class="row">

        <va-select
          label="Sport"
          :options="sports"
          v-model="sport"
          required
          bordered
        >
        </va-select>
        <va-input
          label="League ID"
          v-model="leagueId"
          required
          bordered
        >
        </va-input>
        <va-button
          :rounded="false"
          bordered
          :href="url"
        >Go!</va-button>
      </div>
    </va-card>
  </div>
</template>

<script>
import { defineComponent } from "vue";

export default defineComponent({
  name: 'Site',
  data() {
    return {
      sport: 'nhl',
      sports: [
        'nhl',
        'nfl'
      ],
      leagueId: null,
    }
  },

  computed: {
    url() {
      return `/#/${this.sport}/leagues/${this.leagueId}`
    }
  }
})
</script>

<style scoped>
.container {
  padding: 1em;
  height: 100vh;
  width: 100vw;
  color: #e2e2e2 !important;
  background: #333333 !important;
}
</style>