<template>
  <va-modal
    :z-index="modalZIndex"
    v-model="open"
    title="Settings"
    hide-default-actions
    close-button
    disable-attachment
    allow-body-scroll
    max-width="560px"
    :background-color="themeBaseColor"
  >
    <div class="settingsBody" :style="{ color: themeAccentColor }">
      <div>
        <va-select
          label="Colors"
          :options="colorThemeOptions"
          text-by="text"
          value-by="value"
          :color="themeAccentColor"
          v-model="colorTheme"
        />
        <p class="hint">The app's own colors, or your favorite team's.</p>
      </div>

      <va-select
        label="Favorite team"
        :options="favoriteTeamOptions"
        :color="themeAccentColor"
        v-model="favoriteTeam"
        maxHeight="300px"
      />
      <p class="hint">{{ colorTheme === 'team' ? "Sets the app's colors." : 'Used when Colors is set to team colors.' }}</p>

      <va-checkbox v-model="darkMode" :color="themeAccentColor" label="Dark mode" />

      <div v-if="inExtension">
        <va-checkbox v-model="splitScreen" :color="themeAccentColor" label="Split screen" />
        <p class="hint">
          Fleaflicker on the left and this on the right, with links to Fleaflicker opening on the left. Drag the line
          between them to resize. In a window under 1000px wide, this slides over Fleaflicker as usual.
        </p>
      </div>

      <div>
        <va-checkbox
          v-model="excludeIfNoPoints"
          :color="themeAccentColor"
          label="Only show players that have points this season"
        />
        <p class="hint">
          Leaves out about half the league, which keeps searching fast. Early in the season this
          hides players who haven't played yet.
        </p>
      </div>

      <div class="danger">
        <va-button color="danger" @click="$emit('resetApp')">Reset app</va-button>
        <p class="hint">Clears everything this app saved, including filters and settings, and fetches all players again.</p>
      </div>

      <p class="version">Version {{ version }}</p>
    </div>
  </va-modal>
</template>

<script>
import { HOCKEY_TEAM_LIST, MODAL_Z_INDEX } from "../constants";
import { version } from "../../../package.json";
import { mapGetters } from "vuex";

export default {
  emits: ["reloadPlayers", "resetApp"],
  data() {
    return {
      version,
      inExtension: !process.env.STANDALONE,
    };
  },
  computed: {
    modalZIndex: () => MODAL_Z_INDEX,
    ...mapGetters([
      'themeBaseColor',
      'themeAccentColor'
    ]),
    colorThemeOptions() {
      return [
        { text: 'Default', value: 'default' },
        { text: 'Favorite team colors', value: 'team' },
      ];
    },
    colorTheme: {
      get() {
        return this.$store.state.settings.colorTheme || 'default';
      },
      set(value) {
        this.$store.commit('setKeyValue', { key: 'settings.colorTheme', value });
      },
    },
    favoriteTeamOptions() {
      return HOCKEY_TEAM_LIST.filter((t) => t !== "Free Agent");
    },
    open: {
      get() {
        return this.$store.state.openSettings
      },
      set(value) {
        this.$store.commit('setKeyValue', { key: 'openSettings', value })
      },
    },
    favoriteTeam: {
      get() {
        return this.$store.state.favoriteTeam
      },
      set(value) {
        this.$store.commit('setFavoriteTeam', value)
      }
    },
    excludeIfNoPoints: {
      get() {
        return this.$store.state.excludeIfNoPoints
      },
      set(value) {
        this.$store.commit('setKeyValue', { key: 'excludeIfNoPoints', value })
        // Only the players depend on this, the NHL schedule doesn't need refetching
        this.$emit('reloadPlayers')
      }
    },
    splitScreen: {
      get() {
        return !!this.$store.state.settings.splitScreen
      },
      set(value) {
        this.$store.commit('setKeyValue', { key: 'settings.splitScreen', value })
      }
    },
    darkMode: {
      get() {
        return this.$store.state.settings.darkMode
      },
      set(value) {
        this.$store.commit('setDarkMode', value)
      }
    }
  },
};
</script>

<style scoped>
.settingsBody {
  display: flex;
  flex-direction: column;
  gap: 1em;
}

.hint {
  font-size: 0.85em;
  opacity: 0.8;
  margin-top: 0.25em;
}

.danger {
  border-top: 1px solid var(--va-input-wrapper-border-color, currentColor);
  padding-top: 1em;
}

.version {
  font-size: 0.8em;
  opacity: 0.7;
  text-align: right;
}
</style>
