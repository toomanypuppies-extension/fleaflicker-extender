<template>
  <div
    class="fleaflicker-extender-drawer"
    :class="{
      expanded: drawerExpanded,
      collapsed: !drawerExpanded,
    }"
  >
    <div class="mainContent">
      <Hockey v-if="sport === 'nhl'" />
      <Football
        v-if="sport === 'nfl'"
        :leagueId="leagueId"
      />
    </div>

    <div
      @click="toggleDrawer"
      class="expandCollapse"
    >
      <va-icon
        v-if="sport === 'nhl'"
        class="material-icons"
        :color="teamSecondaryColor"
        size="large"
      >sports_hockey</va-icon>
      <va-icon
        v-if="sport === 'nfl'"
        class="material-icons"
        :color="teamSecondaryColor"
        size="large"
      >sports_football</va-icon>
    </div>
  </div>
</template>

<script>
import { getLeagueId, getSport } from "./utils/util";
import Hockey from "./hockey/Hockey.vue";
import Football from "./football/Football.vue";
import { mapState } from "vuex";
import { HOCKEY_TEAM_NAME_TO_ABBR, HOCKEY_TEAM_ABBR_TO_COLORS } from './hockey/constants';
import { FOOTBALL_TEAM_NAME_TO_ABBR, FOOTBALL_TEAM_ABBR_TO_COLORS } from './football/constants';

export default {
  created() {
    this.$store.commit('setSport', getSport());
    this.$store.commit('setLeagueId', getLeagueId());
  },
  components: {
    Hockey,
    Football,
  },
  methods: {
    toggleDrawer() {
      this.$store.commit('toggleDrawer');
    },
  },
  computed: mapState({
    sport: state => state.sport,
    leagueId: state => state.leagueId,
    drawerExpanded: state => state.drawerExpanded,
    teamSecondaryColor(state) {
      let color;
      switch (state.sport) {
        case 'nhl':
          const abbr1 = HOCKEY_TEAM_NAME_TO_ABBR[state.nhl.favoriteTeam];
          color = HOCKEY_TEAM_ABBR_TO_COLORS[abbr1].secondary;
        case 'nfl':
          const abbr2 = FOOTBALL_TEAM_NAME_TO_ABBR[state.nfl.favoriteTeam];
          color = FOOTBALL_TEAM_ABBR_TO_COLORS[abbr2].secondary;
        default:
          break;
      }
      return color;
    }
  }),
};
</script>

<style lang="scss">
.fleaflicker-extender-drawer {
  // Set defaults
  --themeAccentColor: #333333;
  --themeBaseColor: #e2e2e2;
  --teamMainColor: #001628;
  --teamSecondaryColor: #99d9d9;
  --teamSecondaryColor30Opacity: #99d9d930;

  z-index: 100;
  position: fixed;
  bottom: 0;
  transition: all 350ms;
  height: 100vh;
  width: calc(100vw - 100px);
  color: var(--themeAccentColor);
}

.fleaflicker-extender-drawer {
  &.collapsed {
    right: calc(-100vw + 100px);
  }

  &.expanded {
    right: 0;
  }

  /**
  * Fleaflicker overrides
  */
  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    text-shadow: unset !important;
  }
}

.expandCollapse {
  position: absolute;
  left: -48px;
  bottom: 48px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 48px;
  width: 48px;
  box-shadow: -2px 0px 1px 0px rgba(0, 0, 0, 0.25);
  background-color: var(--teamMainColor);
}

.mainContent {
  box-shadow: -2px 0px 1px 0px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  padding: 1em;
  background-color: var(--teamMainColor);
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
.va-select-option-list {
  color: rgb(52, 73, 94);
}

.lightTheme .va-input--bordered.va-input__container,
.darkTheme .va-input--bordered .va-input__container {
  background: unset;
}

.darkTheme .va-input__content__input {
  color: #e2e2e2 !important;
}

.lightTheme .va-input__icons i {
  background: unset !important;
  color: #333333 !important;
}

.darkTheme .va-input__icons i {
  color: #e2e2e2 !important;
  background: unset !important;
}

.darkTheme .va-checkbox__square {
  color: #e2e2e2 !important;
  background: #333333 !important;
  border-color: #e2e2e2;
}

.va-select-option-list__option,
.va-select-option-list__option i {
  color: #333333 !important;
  background: #e2e2e2 !important;
}
</style>