<template>
  <!-- Split screen: fleaflicker in a frame on the left, over its own page, which can't be narrowed itself
    (its layout follows the window's width, a frame's follows the frame's). In a narrow window the frame
    is the whole window and the panel slides over it, like over fleaflicker's own page. -->
  <iframe
    v-if="framed"
    ref="frame"
    class="splitFrame"
    :class="{ resizing: dragging }"
    :name="frameName"
    :src="frameSrc"
    :style="{ width: splitActive && drawerExpanded ? `${splitRatio * 100}vw` : '100vw' }"
    title="Fleaflicker"
    @load="frameLoaded"
  ></iframe>
  <div
    v-if="splitActive && drawerExpanded"
    class="splitDivider"
    :class="{ dragging }"
    :style="[bindCssVars, { left: `${splitRatio * 100}vw` }]"
    role="separator"
    tabindex="0"
    aria-orientation="vertical"
    aria-label="Resize Fleaflicker and Fleaflicker Extender"
    :aria-valuenow="Math.round(splitRatio * 100)"
    :aria-valuemin="Math.round(ratioBounds.min * 100)"
    :aria-valuemax="Math.round(ratioBounds.max * 100)"
    @pointerdown.prevent="startDrag"
    @keydown="nudgeSplit"
  ></div>
  <!-- Over the frame while dragging, so the pointer's moves reach this page -->
  <div v-if="dragging" class="dragShield"></div>

  <div
    class="fleaflicker-extender-drawer"
    :class="{
      expanded: drawerExpanded,
      collapsed: !drawerExpanded,
      resizing: dragging,
      sideBySide: splitActive,
    }"
    :style="[bindCssVars, splitDrawerStyle]"
  >
    <Main></Main>

    <button
      type="button"
      @click="toggleDrawer"
      class="expandCollapse"
      :aria-label="drawerExpanded ? 'Close Fleaflicker Extender' : 'Open Fleaflicker Extender'"
      :aria-expanded="drawerExpanded"
    >
      <va-icon
        v-if="sport === 'nhl'"
        class="material-icons"
        :color="teamSecondaryColor"
        size="large"
      >sports_hockey</va-icon>
    </button>
  </div>
</template>

<script>
import Hockey from "./hockey/Hockey.vue";
import Main from "./shared/components/Main.vue";
import { mapGetters, mapState } from "vuex";
import { FLEA_FRAME_NAME } from "./store";
import { getLeagueId } from "./utils/util";

// Narrower windows don't have room for both sides, the panel goes back over fleaflicker
const MIN_SPLIT_WINDOW = 1000;
// The narrowest each side can be dragged to
const MIN_FLEA_WIDTH = 360;
const MIN_PANEL_WIDTH = 520;
// Arrow keys move the divider this share of the window
const NUDGE = 0.02;
// How often the address bar catches up with the frame. Its load event doesn't always reach Firefox's
// content scripts, so it's checked on a timer too.
const FRAME_SYNC_INTERVAL = 1000;

export default {
  components: {
    Hockey,
    Main,
  },
  data() {
    return {
      frameName: FLEA_FRAME_NAME,
      // What the frame opened on, it navigates on its own after that
      frameSrc: null,
      windowWidth: window.innerWidth,
      dragging: false,
      // The page's own overflow, put back when split screen is turned off
      pageOverflow: null,
      // The address split screen started on, the page under the frame
      pageUrl: null,
      frameSyncTimer: null,
    };
  },
  methods: {
    toggleDrawer() {
      this.$store.commit('toggleDrawer');
    },
    closeOnEscape(event) {
      if (event.key !== 'Escape' || !this.drawerExpanded || event.defaultPrevented) {
        return;
      }
      // Esc closes dialogs and dropdowns first, and fields keep it
      // The player panel closes first, it listens for Esc itself
      const { openSettings, openHelp } = this.$store.state;
      // Open dropdowns have focus in their list, which vuestic moves to the end of the page
      if (openSettings || openHelp || event.target.closest?.('input, textarea, select, [role="combobox"], .va-select, .va-dropdown__content')) {
        return;
      }
      this.toggleDrawer();
    },
    onResize() {
      this.windowWidth = window.innerWidth;
      // Keeps both sides at least their narrowest. Narrower windows have no sides, the split is kept for later.
      if (this.sideBySide) {
        this.setRatio(this.splitRatio);
      }
    },
    setRatio(ratio) {
      const { min, max } = this.ratioBounds;
      const clamped = Math.min(Math.max(ratio, min), max);
      if (clamped !== this.splitRatio) {
        this.$store.commit('setKeyValue', { key: 'splitRatio', value: clamped });
      }
    },
    startDrag(event) {
      this.dragging = true;
      event.target.focus();
      window.addEventListener('pointermove', this.drag);
      window.addEventListener('pointerup', this.endDrag);
      window.addEventListener('pointercancel', this.endDrag);
    },
    drag(event) {
      this.setRatio(event.clientX / this.windowWidth);
    },
    endDrag() {
      this.dragging = false;
      window.removeEventListener('pointermove', this.drag);
      window.removeEventListener('pointerup', this.endDrag);
      window.removeEventListener('pointercancel', this.endDrag);
    },
    nudgeSplit(event) {
      const moves = {
        ArrowLeft: this.splitRatio - NUDGE,
        ArrowRight: this.splitRatio + NUDGE,
        Home: this.ratioBounds.min,
        End: this.ratioBounds.max,
      };
      if (event.key in moves) {
        event.preventDefault();
        this.setRatio(moves[event.key]);
      }
    },
    // The address bar and title follow the frame, so reloading or bookmarking keeps the page. Another
    // league, or a page that isn't a league's, opens in the whole tab, where the extension loads for it.
    frameLoaded() {
      const frame = this.$refs.frame;
      if (!frame) return;
      let frameUrl;
      let frameTitle;
      try {
        frameUrl = frame.contentWindow.location.href;
        frameTitle = frame.contentDocument.title;
      } catch {
        // Left fleaflicker, its pages can't be read
        return;
      }
      if (!frameUrl.startsWith('http')) {
        return;
      }
      if (frameUrl === location.href) {
        // Titles can come after the address, and pages change their own
        if (frameTitle && frameTitle !== document.title) document.title = frameTitle;
        return;
      }
      if (getLeagueId(frameUrl) !== getLeagueId()) {
        location.href = frameUrl;
        return;
      }
      history.replaceState(history.state, '', frameUrl);
      document.title = frameTitle;
    },
    startFrame() {
      this.frameSrc = location.href;
      this.pageUrl = location.href;
      // The page under the frame would scroll, and its scrollbar would show beside the panel
      this.pageOverflow = document.documentElement.style.overflow;
      document.documentElement.style.overflow = 'hidden';
      this.frameSyncTimer = setInterval(this.frameLoaded, FRAME_SYNC_INTERVAL);
    },
    endFrame() {
      clearInterval(this.frameSyncTimer);
      document.documentElement.style.overflow = this.pageOverflow || '';
      // The page under the frame is the one split screen started on, show the one the frame was on
      if (location.href !== this.pageUrl) {
        location.reload();
      }
    },
  },
  mounted() {
    document.addEventListener('keydown', this.closeOnEscape);
    window.addEventListener('resize', this.onResize);
  },
  beforeUnmount() {
    document.removeEventListener('keydown', this.closeOnEscape);
    window.removeEventListener('resize', this.onResize);
    clearInterval(this.frameSyncTimer);
    this.endDrag();
  },
  computed: {
    ...mapState({
      sport: state => state.sport,
      drawerExpanded: state => state.drawerExpanded,
      darkMode: state => state.settings.darkMode,
      splitScreen: state => state.settings.splitScreen,
      splitRatio: state => state.splitRatio,
      splitActive: state => state.splitActive,
    }),
    ...mapGetters([
      'teamMainColor',
      'teamSecondaryColor',
      'themeBaseColor',
      'themeAccentColor',
      'opponentColors',
    ]),
    framed() {
      return !!this.splitScreen;
    },
    sideBySide() {
      return this.framed && this.windowWidth >= MIN_SPLIT_WINDOW;
    },
    // fleaflicker's share of the window, keeping both sides at least their narrowest
    ratioBounds() {
      return {
        min: MIN_FLEA_WIDTH / this.windowWidth,
        max: 1 - MIN_PANEL_WIDTH / this.windowWidth,
      };
    },
    // In split screen the panel is the window's right side, and slides off to the right when closed
    splitDrawerStyle() {
      if (!this.splitActive) return null;
      const width = `${(1 - this.splitRatio) * 100}vw`;
      return { width, right: this.drawerExpanded ? '0' : `-${width}` };
    },
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
  },
  watch: {
    framed: {
      immediate: true,
      handler(framed) {
        if (framed === this.$store.state.fleaFramed) return;
        if (framed) {
          this.startFrame();
        } else {
          this.endFrame();
        }
        this.$store.commit('setKeyValue', { key: 'fleaFramed', value: framed });
      },
    },
    sideBySide: {
      immediate: true,
      handler(sideBySide) {
        this.$store.commit('setKeyValue', { key: 'splitActive', value: sideBySide });
      },
    },
  },
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

  .mainContent {
    position: relative;
  }

  // Follows the pointer while the divider is dragged
  &.resizing {
    transition: none;
  }

  // Beside fleaflicker, the panel is what fixed elements like modals and their backdrops cover, not the
  // whole window
  &.sideBySide {
    contain: layout;
  }
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

.fleaflicker-extender-drawer .expandCollapse {
  border: none;
  padding: 0;
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

<style lang="scss" scoped>
// Under the panel (z-index 100), over fleaflicker's own page
.splitFrame {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 99;
  height: 100vh;
  border: none;
  background: #fff;
  transition: width 350ms;

  &.resizing {
    transition: none;
  }
}

// Centered on the panel's left edge, wider than it looks so it's easy to grab
.splitDivider {
  position: fixed;
  top: 0;
  z-index: 101;
  width: 12px;
  height: 100vh;
  margin-left: -6px;
  cursor: col-resize;
  touch-action: none;

  &::after {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    left: 5px;
    width: 2px;
    background: rgba(127, 127, 127, 0.5);
  }

  &:hover::after,
  &.dragging::after,
  &:focus-visible::after {
    left: 4px;
    width: 4px;
    background: var(--teamSecondaryColor, #58a6ff);
  }

  &:focus-visible {
    outline: none;
  }
}

.dragShield {
  position: fixed;
  inset: 0;
  z-index: 102;
  cursor: col-resize;
}
</style>
