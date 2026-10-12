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
    if (this.$store.state.leagueId !== getLeagueId()) {
      // Opened from the home page, or another league, so the store has some other league's state
      this.$store.commit('loadLeagueState');
    }
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
      'themeAccentColor',
      'opponentColors',
    ]),
    bindCssVars() {
      return {
        "--themeAccentColor": this.themeAccentColor,
        "--themeBaseColor": this.themeBaseColor,
        "--teamMainColor": this.teamMainColor,
        "--teamSecondaryColor": this.teamSecondaryColor,
        "--teamSecondaryColor30Opacity": `${this.teamSecondaryColor}30`,
        "--opponentColor": this.opponentColors.background,
        "--opponentTextColor": this.opponentColors.text,
      };
    },
  }
});
</script>

<style lang="scss">
/*
 * Not scoped, so they reach vuestic's elements, but every rule is inside .mainContent so nothing
 * applies to the fleaflicker page around the extension. :where() keeps the specificity of the
 * unprefixed selector. yarn check:css enforces this.
 */
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

:where(.mainContent) .containerColor {
  // Help panels (HelpTip) span the section they're in
  position: relative;
  border: 2px var(--teamSecondaryColor) solid;
  color: var(--themeAccentColor);
  background: var(--themeBaseColor);
}

/*
  * VUESTIC OVERRIDES
  */
/* Vuestic's modal titles are small, uppercase and in its own blue */
.mainContent .va-modal__title {
  /* Vuestic sets it inline */
  color: inherit !important;
  font-size: 1.25em;
  text-transform: none;
  letter-spacing: normal;
}

/* Fleaflicker's bootstrap makes every label bold */
.mainContent .va-checkbox__label {
  font-weight: normal;
}

/* Vuestic's default light grey border disappears on the light theme */
.mainContent .va-input-wrapper {
  --va-input-wrapper-border-color: color-mix(in srgb, var(--themeAccentColor) 50%, transparent);
}

.mainContent.darkTheme .va-checkbox__square {
  color: #e2e2e2 !important;
  background: #333333 !important;
  border-color: #e2e2e2;
}

/* Vuestic colors the check to contrast with the light checkbox color, which hides it on the dark square */
.mainContent.darkTheme .va-checkbox__icon {
  color: #e2e2e2 !important;
}
</style>