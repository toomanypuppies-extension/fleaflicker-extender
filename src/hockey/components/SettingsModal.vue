<template>
  <va-modal
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
      <va-select
        label="Favorite team"
        :options="favoriteTeamOptions"
        :color="themeAccentColor"
        v-model="favoriteTeam"
        maxHeight="300px"
      />
      <p class="hint">Sets the app's colors.</p>

      <va-checkbox v-model="darkMode" :color="themeAccentColor" label="Dark mode" />

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
import { HOCKEY_TEAM_LIST } from "../constants";
import { version } from "../../../package.json";
import { mapGetters } from "vuex";

export default {
  emits: ["reloadPlayers", "resetApp"],
  data() {
    return {
      version,
    };
  },
  computed: {
    ...mapGetters([
      'themeBaseColor',
      'themeAccentColor'
    ]),
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
