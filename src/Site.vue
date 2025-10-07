<template>
  <div class="site-container">
    <va-card color="background" style="padding: 0.75em; margin-bottom: 1em;">
      <h3>Fleaflicker Extender</h3>
      <p>Welcome to the fleaflicker extended.
      </p>
      <p>Your league id is the number that comes after 'leagues' in the url when on the fleaflicker site.
      </p>
      <p>Ex:
        'https://www.fleaflicker.com/nhl/leagues/<b>12089</b>'</p>
    </va-card>
    <va-card color="background" style="padding: 0.75em; margin-bottom: 1em;">
      <div class="row">
        <va-input label="League ID" v-model="leagueId" required bordered>
        </va-input>
        <va-button :rounded="false" bordered :href="url">Go!</va-button>
      </div>
    </va-card>
    <va-card color="background" style="padding: 0.75em;">
      <h3>OTH Leagues</h3>
      <ul>
        <li v-for="league in leagues" :key="league.id">
          <a :href="urlInject(league.id)">{{ league.name }}</a>
        </li>
      </ul>
    </va-card>
  </div>
</template>

<script>
import { defineComponent } from "vue";

export default defineComponent({
  name: 'Site',
  data() {
    return {
      leagueId: null,
      leagues: [
        { id: 12086, name: 'D1 - Gretzky' },
        { id: 12087, name: 'D2 - Brodeur' },
        { id: 12088, name: 'D2 - Roy' },
        { id: 12089, name: 'D3 - Messier' },
        { id: 12091, name: 'D3 - Jagr' },
        { id: 12090, name: 'D3 - Yzerman' },
        { id: 12093, name: 'D4 - Leetch' },
        { id: 12092, name: 'D4 - Coffee' },
        { id: 12095, name: 'D4 - Bourque' },
        { id: 12096, name: 'D4 - Orr' },
        { id: 12098, name: 'D5 - Hunter' },
        // { id: 15621, name: '' },
        { id: 12099, name: 'D5 - Domi' },
        { id: 12097, name: 'D5 - Williams' },
        { id: 12100, name: 'D5 - McSorley' },
        { id: 12101, name: 'D5 - Probert' },
        { id: 14206, name: 'Keeper - Choccy' },
        { id: 9559, name: 'Keeper - OG' },
        { id: 9899, name: 'Keeper - Koala' },
      ]
    }
  },
  methods: {
    urlInject(id) {
      return `/#/nhl/leagues/${id}`
    },
  },
  computed: {
    url() {
      return this.urlInject(this.leagueId)
    },
    recents() {
      const localStorageKeys = Object.keys(localStorage);
      return localStorageKeys.map((key) => {
        if (key.includes('vuex-state')) {
          return key.split('-')[2];
        }
      })
    }
  }
})
</script>

<style>
@media only screen and (hover: none) and (pointer: coarse) {
  #app {
    font-size: 1.5em !important;
  }
}

.site-container {
  padding: 1em;
  position: fixed;
  height: 100%;
  width: 100vw;
  color: #e2e2e2 !important;
  background: #333333 !important;
}
</style>
