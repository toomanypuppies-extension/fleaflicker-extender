<template>
  <div
    v-if="selectedPlayer"
    class="playerContainer containerColor"
  >
    <div class="playerContainerLeft">
      <va-icon
        @click="$emit('clearSelectedPlayer')"
        class="material-icons playerClose"
        style="color: var(--themeAccentColor)"
        size="medium"
      >close</va-icon>
      <div class="v-flex">
        <h2>
          {{ selectedPlayer.name }} -
          {{ teamAbbrToName[selectedPlayer.team] }}
        </h2>
        <div class="h-flex">
          <img
            class="playerImage"
            :src="selectedPlayer.expandedData.image"
            alt="Player Image"
            v-if="selectedPlayer.expandedData.image"
          />
          <div
            class="playerImage playerImageDefault"
            v-if="!selectedPlayer.expandedData.image"
          ></div>
          <div class="playerStats">
            <div class="flex-spaceBetween">
              <p>Position</p>
              <p>{{ selectedPlayer.position }}</p>
            </div>
            <div class="flex-spaceBetween">
              <p>Injured Status</p>
              <p>{{ selectedPlayer.injury || "Healthy" }}</p>
            </div>
            <div class="flex-spaceBetween">
              <p>Points</p>
              <p>{{ selectedPlayer.points }}</p>
            </div>
            <div class="flex-spaceBetween">
              <p>Average</p>
              <p>{{ selectedPlayer.avg }}</p>
            </div>
            <div class="flex-spaceBetween">
              <p>Last 1</p>
              <p>{{ selectedPlayer.last1 }}</p>
            </div>
            <div class="flex-spaceBetween">
              <p>Last 5</p>
              <p>{{ selectedPlayer.last5 }}</p>
            </div>
            <div class="flex-spaceBetween">
              <p>Last 10</p>
              <p>{{ selectedPlayer.last10 }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="playerContainerRight">
      <div class="h-flex">
        <a
          :href="selectedPlayerFleaflickerLink"
          v-if="selectedPlayerFleaflickerLink"
          @click="$emit('fleaflickerNav')"
          style="color: var(--themeAccentColor)"
        >Fleaflicker player page
          <va-icon
            class="material-icons"
            style="color: var(--themeAccentColor)"
            size="small"
          >link</va-icon>
        </a>
        <a
          :href="selectedPlayerDobberLink"
          v-if="selectedPlayerDobberLink"
          target="_blank"
          style="color: var(--themeAccentColor)"
        >Dobber player page
          <va-icon
            class="material-icons"
            style="color: var(--themeAccentColor)"
            size="small"
          >link</va-icon>
        </a>
        <a
          :href="selectedPlayerDailyFaceoffTeamLink"
          v-if="selectedPlayerDailyFaceoffTeamLink"
          target="_blank"
          style="color: var(--themeAccentColor)"
        >{{ teamAbbrToName[selectedPlayer.team] }} daily faceoff lineup page
          <va-icon
            class="material-icons"
            style="color: var(--themeAccentColor)"
            size="small"
          >link</va-icon>
        </a>
      </div>
      <div class="playerNews">
        <h2>
          {{ selectedPlayer.expandedData?.news?.title || "No player news"
          }}{{ selectedPlayerNewsTime }}
        </h2>
        <br />
        <p>{{ selectedPlayer.expandedData?.news?.contents }}</p>
        <br />
        <p>{{ selectedPlayer.expandedData?.news?.analysis }}</p>
      </div>
    </div>
  </div>
</template>

<script>
import { HOCKEY_TEAM_ABBR_TO_NAME } from "../constants";
export default {
  props: {
    selectedPlayer: Object,
    leagueId: String,
    teamAbbrToName: Object,
  },
  computed: {
    selectedPlayerNewsTime() {
      const epoch = this.selectedPlayer.expandedData?.news?.timeEpochMilli;
      if (epoch) {
        const formattedTime = new Date(parseInt(epoch, 10)).toLocaleDateString(
          [],
          {
            hour: "2-digit",
            minute: "2-digit",
          }
        );
        return ` - ${formattedTime}`;
      }
      return null;
    },
    selectedPlayerDobberLink() {
      if (this.selectedPlayer?.name) {
        const kebabName = this.selectedPlayer.name
          ?.split(" ")
          ?.join("-")
          ?.replaceAll(".", "");
        return `https://frozenpool.dobbersports.com/players/${kebabName.toLowerCase()}`;
      }
      return null;
    },
    selectedPlayerDailyFaceoffTeamLink() {
      if (
        this.selectedPlayer?.team &&
        this.selectedPlayer.team !== "FA" &&
        HOCKEY_TEAM_ABBR_TO_NAME[this.selectedPlayer.team]
      ) {
        const kebabTeam = HOCKEY_TEAM_ABBR_TO_NAME[this.selectedPlayer.team]
          ?.split(" ")
          ?.join("-");
        return `https://www.dailyfaceoff.com/teams/${kebabTeam.toLowerCase()}/line-combinations/`;
      }
      return null;
    },
    selectedPlayerFleaflickerLink() {
      if (this.selectedPlayer?.name) {
        const kebabName = this.selectedPlayer.name
          ?.split(" ")
          ?.join("-")
          ?.replaceAll(".", "");
        return ` https://www.fleaflicker.com/nhl/leagues/${this.leagueId
          }/players/${kebabName.toLowerCase()}-${this.selectedPlayer.id}`;
      }
      return null;
    },
  },
};
</script>

<style lang="scss" scoped>
.playerContainer {
  position: relative;
  margin-top: 1em;
  display: grid;
  padding: 1.25em;
  grid-template-columns: repeat(3, 1fr);
  gap: 1em;
}

.playerContainerLeft {
  grid-column: 1;
}

.playerContainerRight {
  grid-column: 2 / span 2;
}

.playerNews {
  background: rgba(0, 0, 0, 0.1);
  padding: 0.5em;
}

.playerImage {
  height: 200px;
  width: 200px;
}

.playerStats {
  display: flex;
  width: 100%;
  flex-direction: column;
  justify-content: space-between;
  margin-left: 1em;
}

.playerClose {
  position: absolute;
  top: 0;
  right: 0;
}
</style>