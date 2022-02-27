<template>
  <div v-if="openSettings" class="settingsContainer containerColor">
    <div class="h-flex">
      <div class="v-flex">
        <va-select
          label="Favorite Team"
          :options="favoriteTeamOptions"
          :color="themeAccentColor"
          v-model="favoriteTeam"
          @update:model-value="(val) => emitUpdate('favoriteTeam', val)"
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
          >Refresh Players</va-button
        >
      </div>
      <div class="v-flex">
        <va-checkbox
          v-model="darkMode"
          @update:model-value="(val) => emitUpdate('darkMode', val)"
          :color="themeAccentColor"
          label="Dark Mode"
        ></va-checkbox>
        <span class="spacer"></span>

        <va-checkbox
          v-model="excludeIfNoPoints"
          @update:model-value="(val) => emitUpdate('excludeIfNoPoints', val)"
          :color="themeAccentColor"
          label="Only show players that have points this year (refresh if changed)"
        >
        </va-checkbox>
      </div>
    </div>
    <div class="notice">
      <!-- ADD INFO ABOUT HOW TO SORT, HOW TO CLOSE THE OVERLAY, OTHER THINGS-->
      <p>
        Players are fetched once every hour if the extension is being used. Once
        fetched they are stored locally so that things perform faster on the
        page. The "Refresh Players" button will let you force a refresh of local
        data from fleaflicker. It is recommended to only show players who have
        points this year as that excludes about half the players which makes the
        search functions perform better.
      </p>
    </div>
  </div>
</template>

<script>
import { TEAM_LIST } from "../contants";
import { getStore, setStore } from "../utils/storage";
export default {
  data() {
    return {
      excludeIfNoPoints: true,
      favoriteTeam: "Seattle Kraken",
      darkMode: true,
      stateToStore: ["excludeIfNoPoints", "favoriteTeam", "darkMode"],
    };
  },
  created() {
    this.stateToStore.forEach((item) => {
      // load state from store
      const val = getStore(item);
      if (val !== undefined && val !== null) {
        this[item] = val;
      }

      // Setup watcher to store info
      this.$watch(item, (val) => {
        setStore(item, val);
      });
    });
  },
  props: {
    openSettings: Boolean,
    themeAccentColor: String,
    themeBaseColor: String,
  },
  methods: {
    emitUpdate(key, val) {
      this.$emit("update", key, val);
    },
  },
  computed: {
    favoriteTeamOptions() {
      return TEAM_LIST.filter((t) => t !== "Free Agent");
    },
  },
};
</script>