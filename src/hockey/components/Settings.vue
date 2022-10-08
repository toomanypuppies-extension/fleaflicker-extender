<template>
  <div
    v-if="openSettings"
    class="settingsContainer containerColor"
  >
    <div class="h-flex">
      <div class="v-flex">
        <va-select
          label="Favorite Team"
          :options="favoriteTeamOptions"
          :color="themeAccentColor"
          v-model="favoriteTeam"
          placeholder="Seattle Kraken"
          maxHeight="300px"
          bordered
        />
        <span class="spacer"></span>

        <va-button
          :rounded="false"
          bordered
          class="refreshButton"
          @click="$emit('refreshPlayers')"
          :color="themeAccentColor"
          :text-color="themeBaseColor"
        >Refresh Players</va-button>
      </div>
      <div class="v-flex">
        <va-checkbox
          v-model="darkMode"
          :color="themeAccentColor"
          label="Dark Mode"
        ></va-checkbox>
        <span class="spacer"></span>

        <va-checkbox
          v-model="excludeIfNoPoints"
          :color="themeAccentColor"
          label="Only show players that have points this year (refresh if changed)"
        >
        </va-checkbox>
      </div>
      <div class="version">v{{ version }}</div>
    </div>
    <div class="notice">
      <!-- ADD INFO ABOUT HOW TO SORT, HOW TO CLOSE THE OVERLAY, OTHER THINGS-->
      <h3 class="tipsHeader">Tips</h3>
      <ul class="tipsList">
        <li>
          You can sort up to two columns at a time.
          <va-icon
            class="material-icons"
            size="1em"
          >expand_more</va-icon> will
          be shown on the primary sort column, and
          <va-icon
            class="material-icons"
            size="1em"
          >expand_more</va-icon>
          <va-icon
            class="material-icons"
            size="1em"
          >expand_more</va-icon>
          will be shown on the secondary sort column.
        </li>
        <li>
          Clicking once will toggle sort direction, and double clicking will
          remove the sort. If you already have two columns sorted, then remove
          the sort on one of them to sort a new column.
        </li>
        <li>
          Click the
          <va-icon
            class="material-icons"
            size="1em"
          >sports_hockey</va-icon>
          icon in the lower left to open/close the extension.
        </li>
        <li>
          Players are fetched once every hour if the extension is being used.
          Once fetched they are stored locally so that things perform faster on
          the page. The "Refresh Players" button will let you force a refresh of
          local data from fleaflicker. It is recommended to only show players
          who have points this year as that excludes about half the players
          which makes the search functions perform better.
        </li>
      </ul>
    </div>
  </div>
</template>

<script>
import { HOCKEY_TEAM_LIST } from "../constants";
import { version } from "../../../package.json";
import { mapGetters } from "vuex";

export default {
  data() {
    return {
      version: version,
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
    openSettings: {
      get() {
        return this.$store.state.nhl.openSettings
      },
    },
    favoriteTeam: {
      get() {
        return this.$store.state.nhl.favoriteTeam
      },
      set(value) {
        this.$store.commit('setFavoriteTeam', { sport: 'nhl', team: value })
      }
    },
    excludeIfNoPoints: {
      get() {
        return this.$store.state.nhl.excludeIfNoPoints
      },
      set(value) {
        this.$store.commit('setKeyValue', { key: 'nhl.excludeIfNoPoints', value })
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
.notice {
  background: rgba(0, 0, 0, 0.1);
  padding: 1em;
  margin: 1em;
}

.tipsHeader {
  font-size: 1.25em;
  padding-bottom: 0.5em;
}

.tipsList {
  list-style: square;
  padding-left: 2em;
}

.settingsContainer {
  position: relative;
  margin-bottom: 1em;
}

.version {
  position: absolute;
  top: 0;
  right: 0;
  padding: 0.5em;
}
</style>