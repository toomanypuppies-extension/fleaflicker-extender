<template>
  <div v-if="selectedPlayer" class="playerContainer containerColor">
    <div class="playerContainerLeft">
      <va-icon @click="$emit('clearSelectedPlayer')" class="material-icons playerClose"
        style="color: var(--themeAccentColor)" size="medium">close</va-icon>
      <div class="v-flex">
        <h2>
          {{ selectedPlayer.name }} -
          {{ teamAbbrToName[selectedPlayer.team] }}
        </h2>
        <div class="h-flex">
          <img class="playerImage" :src="selectedPlayer.expandedData.image" alt="Player Image"
            v-if="selectedPlayer.expandedData.image" />
          <div class="playerImage playerImageDefault" v-if="!selectedPlayer.expandedData.image"></div>
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
        <a :href="selectedPlayerFleaflickerLink" v-if="selectedPlayerFleaflickerLink" @click="$emit('fleaflickerNav')"
          style="color: var(--themeAccentColor)" :target="fleaTarget">Fleaflicker
          <va-icon class="material-icons" style="color: var(--themeAccentColor)" size="small">link</va-icon>
        </a>
        <a :href="selectedPlayerDobberLink" v-if="selectedPlayerDobberLink" target="_blank"
          style="color: var(--themeAccentColor)">Dobber
          <va-icon class="material-icons" style="color: var(--themeAccentColor)" size="small">link</va-icon>
        </a>
        <a :href="selectedPlayerPuckpediaLink" v-if="selectedPlayerPuckpediaLink" target="_blank"
          style="color: var(--themeAccentColor)">PuckPedia
          <va-icon class="material-icons" style="color: var(--themeAccentColor)" size="small">link</va-icon>
        </a>
        <a :href="selectedPlayerDailyFaceoffTeamLink" v-if="selectedPlayerDailyFaceoffTeamLink" target="_blank"
          style="color: var(--themeAccentColor)">{{ teamAbbrToName[selectedPlayer.team] }} Daily Faceoff
          <va-icon class="material-icons" style="color: var(--themeAccentColor)" size="small">link</va-icon>
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
    <div v-if="gamesByMatchup && weekStartDates" class="upcomingGames">
      <h2>Upcoming games</h2>
      <hr />
      <div class="gameGrid">
        <GameWeek :week="gameWeekForTeam['0']" :startDate="weekStartDates[0]" />
        <GameWeek :week="gameWeekForTeam['1']" :startDate="weekStartDates[1]" />
        <GameWeek :week="gameWeekForTeam['2']" :startDate="weekStartDates[2]" />
        <GameWeek :week="gameWeekForTeam['3']" :startDate="weekStartDates[3]" />
      </div>
    </div>
  </div>
</template>

<script>
import { HOCKEY_TEAM_ABBR_TO_NAME } from "../constants";
import GameWeek from "./GameWeek.vue";
import { mapState } from 'vuex';

export default {
  props: {
    leagueId: String,
    teamAbbrToName: Object,
  },
  components: {
    GameWeek
  },
  computed: {
    ...mapState({
      selectedPlayer: state => state.selectedPlayer,
      gamesByMatchup: state => state.gamesByMatchup,
      weekStartDates: state => state.weekStartDates
    }),
    fleaTarget() {
      return process.env.STANDALONE ? '_blank' : '_self';
    },
    gameWeekForTeam() {
      if (
        this.selectedPlayer?.team &&
        this.selectedPlayer.team !== "FA"
      ) {
        const teamAbbr = this.selectedPlayer.team;
        return this.gamesByMatchup[teamAbbr];
      } else {
        return {};
      }
    },
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
    selectedPlayerPuckpediaLink() {
      if (this.selectedPlayer?.name) {
        const kebabName = this.selectedPlayer.name
          ?.split(" ")
          ?.join("-")
          ?.replaceAll(".", "");
        return `https://puckpedia.com/player/${kebabName.toLowerCase()}`;
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

@media (max-width: 800px) {
  .playerContainer {
    display: flex;
    flex-direction: column;
  }
}

.playerContainerLeft {
  grid-column: 1;
}

.playerContainerRight {
  grid-column: 2 / span 2;
}

.upcomingGames {
  grid-column: 1 / span 3;

  .gameGrid {
    display: flex;
    justify-content: space-between;
    flex-wrap: wrap;
  }
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