<template>
  <aside v-if="selectedPlayer" class="playerPanel containerColor" aria-label="Player details">
    <div class="panelHeader">
      <div>
        <h2 class="playerName">{{ selectedPlayer.name }}</h2>
        <p class="playerTeam">
          {{ teamAbbrToName[selectedPlayer.team] || selectedPlayer.team }} · {{ selectedPlayer.position }}
          <span v-if="selectedPlayer.injury" class="injury">{{ selectedPlayer.injury }}</span>
        </p>
      </div>
      <button type="button" class="closeButton" aria-label="Close player details" @click="$emit('clearSelectedPlayer')">
        <va-icon class="material-icons" size="1.4em">close</va-icon>
      </button>
    </div>

    <div class="summary">
      <img v-if="selectedPlayer.expandedData?.image" class="playerImage" :src="selectedPlayer.expandedData.image" alt="" />
      <div v-else class="playerImage playerImageDefault"></div>
      <dl class="playerStats">
        <template v-for="stat in stats" :key="stat.label">
          <dt>{{ stat.label }}</dt>
          <dd>{{ stat.value }}</dd>
        </template>
      </dl>
    </div>

    <nav class="links" aria-label="More about this player">
      <a :href="fleaflickerLink" @click="$emit('fleaflickerNav')" :target="fleaTarget">Fleaflicker
        <va-icon class="material-icons" size="1em">open_in_new</va-icon></a>
      <a :href="dobberLink" target="_blank" rel="noopener">Dobber
        <va-icon class="material-icons" size="1em">open_in_new</va-icon></a>
      <a :href="puckpediaLink" target="_blank" rel="noopener">PuckPedia
        <va-icon class="material-icons" size="1em">open_in_new</va-icon></a>
      <a v-if="dailyFaceoffLink" :href="dailyFaceoffLink" target="_blank" rel="noopener">Line combinations
        <va-icon class="material-icons" size="1em">open_in_new</va-icon></a>
    </nav>

    <section class="playerNews">
      <h3>{{ news?.title || "No player news" }}</h3>
      <p v-if="newsTime" class="newsTime">{{ newsTime }}</p>
      <p v-if="news?.contents">{{ news.contents }}</p>
      <p v-if="news?.analysis">{{ news.analysis }}</p>
    </section>

    <section v-if="gamesByMatchup && weekStartDates" class="upcomingGames">
      <h3>Upcoming games</h3>
      <div class="gameGrid">
        <GameWeek v-for="week in 4" :key="week" :week="gameWeekForTeam[week - 1]" :startDate="weekStartDates[week - 1]"
          :index="week - 1" />
      </div>
    </section>
  </aside>
</template>

<script>
import { HOCKEY_TEAM_ABBR_TO_NAME } from "../constants";
import { slugify } from "../../utils/util";
import GameWeek from "./GameWeek.vue";
import { mapState } from 'vuex';

const formatNumber = (value, places = 2) => (typeof value === 'number' ? String(+value.toFixed(places)) : null);

export default {
  props: {
    leagueId: String,
    teamAbbrToName: Object,
  },
  emits: ['clearSelectedPlayer', 'fleaflickerNav'],
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
    stats() {
      const player = this.selectedPlayer;
      const isGoalie = player.goalsAgainst !== undefined;
      const lastSeason = player.lastSeasonPoints !== undefined
        ? `${formatNumber(player.lastSeasonPoints, 1)} pts, ${formatNumber(player.lastSeasonAvg)} avg, ${player.lastSeasonGamesPlayed} GP`
        : null;
      return [
        { label: 'Owner', value: player.owner || player.availabilityLabel || 'Free agent' },
        { label: 'Today', value: player.todaysGame || 'No game' },
        { label: 'Points', value: `${formatNumber(player.points)} (${formatNumber(player.avg)} avg)` },
        { label: 'Games played', value: player.gamesPlayed },
        isGoalie
          ? { label: 'GA / SV%', value: `${player.goalsAgainst} / ${player.savePct?.toFixed(3).replace(/^0/, '') ?? '–'}` }
          : { label: 'Goals / Assists', value: `${player.goals ?? 0} / ${player.assists ?? 0}` },
        { label: 'Last 1 / 5 / 10', value: [player.last1, player.last5, player.last10].map(v => formatNumber(v)).join(' / ') },
        { label: 'Rank', value: player.rank ? `${player.rank} overall, ${player.positionRankLabel || ''}${player.positionRank}` : null },
        { label: '% owned', value: player.percentOwned !== undefined ? `${player.percentOwned}%` : null },
        { label: 'Last season', value: lastSeason },
      ].filter(stat => stat.value !== null && stat.value !== undefined && stat.value !== '');
    },
    gameWeekForTeam() {
      const team = this.selectedPlayer?.team;
      // Teams with no games in the next 4 weeks (eliminated, off-season) aren't in the schedule
      return (team && team !== "FA" && this.gamesByMatchup?.[team]) || {};
    },
    news() {
      return this.selectedPlayer.expandedData?.news;
    },
    newsTime() {
      const epoch = this.news?.timeEpochMilli;
      return epoch
        ? new Date(parseInt(epoch, 10)).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
        : null;
    },
    nameSlug() {
      return slugify(this.selectedPlayer?.name);
    },
    dobberLink() {
      return `https://frozenpool.dobbersports.com/players/${this.nameSlug}`;
    },
    puckpediaLink() {
      return `https://puckpedia.com/player/${this.nameSlug}`;
    },
    dailyFaceoffLink() {
      const teamName = HOCKEY_TEAM_ABBR_TO_NAME[this.selectedPlayer?.team];
      return teamName && this.selectedPlayer.team !== "FA"
        ? `https://www.dailyfaceoff.com/teams/${slugify(teamName)}/line-combinations/`
        : null;
    },
    fleaflickerLink() {
      return `https://www.fleaflicker.com/nhl/leagues/${this.leagueId}/players/${this.nameSlug}-${this.selectedPlayer.id}`;
    },
  },
  methods: {
    closeOnEscape(event) {
      const inDropdown = event.target.closest?.('.va-dropdown__content');
      if (event.key === 'Escape' && this.selectedPlayer && !inDropdown && !this.$store.state.openSettings && !this.$store.state.openHelp) {
        // Handled, so the extension's panel doesn't close as well
        event.preventDefault();
        this.$emit('clearSelectedPlayer');
      }
    },
  },
  mounted() {
    document.addEventListener('keydown', this.closeOnEscape);
  },
  beforeUnmount() {
    document.removeEventListener('keydown', this.closeOnEscape);
  },
};
</script>

<style lang="scss" scoped>
.playerPanel {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 10;
  width: min(460px, 100%);
  overflow-y: auto;
  padding: 1.25em;
  box-shadow: -4px 0 12px rgba(0, 0, 0, 0.35);
  display: flex;
  flex-direction: column;
  gap: 1.25em;
}

// Fleaflicker's bootstrap sizes and spaces headings and makes dt bold
h2,
h3,
h4 {
  margin: 0;
  line-height: 1.25;
}

.panelHeader {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1em;
}

.playerName {
  font-size: 1.4em;
  font-weight: 700;
}

.playerTeam {
  opacity: 0.85;
  margin-top: 0.2em;
}

.injury {
  margin-left: 0.4em;
  padding: 0 0.4em;
  border-radius: 3px;
  background: #ef5350;
  color: #fff;
  font-size: 0.85em;
}

.closeButton {
  display: inline-flex;
  font: inherit;
  color: inherit;
  background: none;
  border: none;
  border-radius: 4px;
  padding: 0.25em;
  min-width: 44px;
  min-height: 44px;
  justify-content: center;
  align-items: center;
  cursor: pointer;

  &:hover {
    background: var(--teamSecondaryColor30Opacity);
  }

  &:focus-visible {
    outline: 2px solid var(--teamSecondaryColor);
  }
}

.summary {
  display: flex;
  gap: 1em;
  align-items: flex-start;
}

.playerImage {
  width: 120px;
  height: 120px;
  flex-shrink: 0;
  object-fit: cover;
}

.playerStats {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.3em 0.75em;
  flex: 1;

  dt {
    opacity: 0.75;
    font-weight: normal;
  }

  dd {
    margin: 0;
    font-weight: 600;
  }
}

.links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5em 1.25em;

  a {
    color: inherit;
    text-decoration: underline;
    display: inline-flex;
    align-items: center;
    gap: 0.2em;
  }
}

.playerNews {
  background: rgba(0, 0, 0, 0.1);
  padding: 0.75em;

  h3 {
    font-size: 1.05em;
    font-weight: 700;
    margin-bottom: 0.4em;
  }

  p {
    margin-bottom: 0.5em;
    line-height: 1.4;
  }
}

.newsTime {
  font-size: 0.85em;
  opacity: 0.75;
}

.upcomingGames h3 {
  font-size: 1.05em;
  font-weight: 700;
  margin-bottom: 0.5em;
}

.gameGrid {
  display: flex;
  flex-direction: column;
  gap: 0.75em;
}

@media (max-width: 480px) {
  .summary {
    flex-direction: column;
  }
}
</style>
