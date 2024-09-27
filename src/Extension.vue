<template>
  <div
    class="fleaflicker-extender-drawer"
    :class="{
      expanded: drawerExpanded,
      collapsed: !drawerExpanded,
    }"
    :style="bindCssVars"
  >
    <Main></Main>

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
    </div>
  </div>
</template>

<script>
import Hockey from "./hockey/Hockey.vue";
import Main from "./shared/components/Main.vue";
import { mapGetters, mapState } from "vuex";

export default {
  components: {
    Hockey,
    Main,
  },
  methods: {
    toggleDrawer() {
      this.$store.commit('toggleDrawer');
    },
  },
  computed: {
    ...mapState({
      sport: state => state.sport,
      drawerExpanded: state => state.drawerExpanded,
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
};
</script>

<style lang="scss">
.fleaflicker-extender-drawer {
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
</style>