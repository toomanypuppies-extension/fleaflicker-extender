<template>
  <div
    class="mainContent"
    :style="bindCssVars"
    :class="{
      lightTheme: !darkMode,
      darkTheme: darkMode,
    }"
  >
    <Hockey v-if="sport === 'nhl'" />
  </div>
</template>

<script>
import { getLeagueId, getSport } from "../../utils/util";
import Hockey from "../../hockey/Hockey.vue";
import { mapGetters, mapState } from "vuex";
import { defineComponent } from "vue";

export default defineComponent({
  name: 'Main',
  created() {
    this.$store.commit('setLeagueId', getLeagueId())
  },
  components: {
    Hockey,
  },
  methods: {

  },
  computed: {
    ...mapState({
      sport: state => state.sport,
      leagueId: state => state.leagueId,
      darkMode: state => state.settings.darkMode
    }),
    ...mapGetters([
      'teamMainColor',
      'teamSecondaryColor',
      'themeBaseColor',
      'themeAccentColor'
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
  }
});
</script>

<style lang="scss">
.mainContent {
  box-shadow: -2px 0px 1px 0px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  position: fixed;
  height: 100%;
  width: 100%;
  padding: 1em;
  background-color: var(--teamMainColor);
  color: var(--themeAccentColor);
}

.containerColor {
  border: 2px var(--teamSecondaryColor) solid;
  color: var(--themeAccentColor);
  background: var(--themeBaseColor);
}

.v-flex {
  display: flex;
  flex-direction: column;
  justify-content: space-around;
  padding: 0.5em;
  width: 100%;
}

.spacer {
  height: 0.5em;
}

.h-flex {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  padding: 0.5em;
  width: 100%;
}

.align-center {
  align-items: center;
}

.flex-spaceBetween {
  display: flex;
  justify-content: space-between;
}

/*
  * VUESTIC OVERRIDES
  */
/* Vuestic's default light grey border disappears on the light theme */
.mainContent .va-input-wrapper {
  --va-input-wrapper-border-color: color-mix(in srgb, var(--themeAccentColor) 50%, transparent);
}

.darkTheme .va-checkbox__square {
  color: #e2e2e2 !important;
  background: #333333 !important;
  border-color: #e2e2e2;
}

/* Vuestic colors the check to contrast with the light checkbox color, which hides it on the dark square */
.darkTheme .va-checkbox__icon {
  color: #e2e2e2 !important;
}
</style>