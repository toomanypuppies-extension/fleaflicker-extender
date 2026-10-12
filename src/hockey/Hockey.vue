<template>
  <AppToolbar
    v-model:activeTab="activeTab"
    :loading="loading"
    :updatedAt="playersSavedAt"
    :addsLeft="myAddsLeft"
    :teams="league?.teams || []"
    @refresh="refreshAll"
    @openHelp="setKey('openHelp', true)"
    @openSettings="setKey('openSettings', true)"
  />
  <div v-if="loadMessage" class="loadMessage containerColor" role="status">{{ loadMessage }}</div>

  <template v-if="activeTab === 'players'">
    <Filter />
    <PlayerList sport="nhl" :loading="loading" :players="tablePlayers" :gamesByTeam="gamesByTeam" :teamsByDate="teamsByDate"
      :availabilityKnown="!!waiverSettings" @playerSelected="(player) => selectPlayer(player)" />
  </template>
  <ScheduleView v-else-if="activeTab === 'schedule'" :schedule="schedule" :league="league" />
  <LeagueView v-else-if="leagueTabs.includes(activeTab)" :section="activeTab" :leagueId="leagueId" :league="league" :players="tablePlayers"
    :schedule="schedule" :now="now" @activityUpdated="setActivityLog" @openPlayer="openPlayerById" />

  <PlayerCard :leagueId="leagueId" :teamAbbrToName="teamAbbrToName" @fleaflickerNav="toggleDrawer"
    @clearSelectedPlayer="clearSelectedPlayer" />

  <SettingsModal @reloadPlayers="loadPlayers()" @resetApp="resetApp" />
  <HelpModal />
</template>

<script>
import { HOCKEY_TEAM_ABBR_TO_NAME, LEAGUE_TABS } from "./constants";
import { getLeagueId, findMyTeamIdOnPage } from "../utils/util";
import PlayerList from "./components/PlayerList.vue";
import PlayerCard from "./components/PlayerCard.vue";
import Filter from "./components/Filter.vue";
import AppToolbar from "./components/AppToolbar.vue";
import SettingsModal from "./components/SettingsModal.vue";
import HelpModal from "./components/HelpModal.vue";
import ScheduleView from "./components/ScheduleView.vue";
import LeagueView from "./components/LeagueView.vue";
import { loadHockeyPlayers, LOAD_ERRORS } from "./collections/players";
import { clearAllStored } from "../utils/db";
import { mapState } from "vuex";
import { getGamesThisWeek } from "./api/nhlv2";
import { loadLeagueInfo, currentPeriod, acquisitionLimit, countAcquisitions } from "./collections/league";
import { recordLeagueVisit } from "../utils/recentLeagues";
import { getActivityLog, syncActivity } from "./collections/activity";
import { latestDrops, waiverStatus, availabilityLabel, availabilityOrder } from "./collections/waivers";
import { loadLastSeasonStats, lastSeasonFields } from "./collections/lastSeason";
import { usesLastSeason } from "./collections/columns";
import { loadStartingGoalies, goalieStarts, goalieStartLabel, GOALIE_START_ORDER } from "./collections/startingGoalies";
import { easternDate } from "./collections/schedule";
import { navFromState, stateFromNav, sameNav, queryWithNav, queryHasNav } from "./navigation";
import { loadScheduleWeeks, mergeScheduleWeeks, gamesLeftByTeam, todaysGamesByTeam } from "./collections/scheduleWeeks";

// Waiver status depends on the time, so it's worked out again this often
const CLOCK_INTERVAL = 60 * 1000;
// How often today's starting goalies are checked until they're all confirmed
const GOALIE_CHECK_INTERVAL = 15 * 60 * 1000;
// Fleaflicker's (and so the app's) days start at 6am Eastern
const SCORING_DAY_START_HOURS = 6;
// The extension's page in history entries, beside whatever fleaflicker keeps there
const HISTORY_KEY = 'fleaflickerExtenderPage';

export default {
  // Views ask for the schedule weeks they show, it starts with the next 4
  provide() {
    return { ensureSchedule: this.ensureSchedule };
  },
  data() {
    return {
      leagueTabs: LEAGUE_TABS,
      // The page last added to the browser's history, or shown from it
      recordedPage: null,
      // Today's starting goalies from Daily Faceoff, see loadStartingGoalies
      startingGoalies: null,
      teamAbbrToName: HOCKEY_TEAM_ABBR_TO_NAME,
      leagueId: null,
      loading: true,
      players: [],
      playersSavedAt: null,
      loadError: null,
      latestLoadId: 0,
      gamesByTeam: {},
      gameWeek: {},
      league: null,
      // The NHL's next four weeks, see convertSchedule
      schedule: null,
      activityItems: [],
      // Back to when the stored activity is complete
      activityCoveredFrom: null,
      // Last season's stats by player id, loaded when a last season column is shown
      lastSeasonById: null,
      now: Date.now(),
      clock: null,
    };
  },
  components: {
    PlayerList,
    PlayerCard,
    Filter,
    AppToolbar,
    SettingsModal,
    HelpModal,
    ScheduleView,
    LeagueView,
  },
  methods: {
    // Loads the schedule weeks covering `dates` (YYYY-MM-DD) that aren't loaded yet
    async ensureSchedule(dates) {
      const loaded = new Set((this.schedule || []).flatMap(week => week.days.map(day => day.date)));
      const missing = dates.filter(date => !loaded.has(date));
      if (!missing.length) return;
      const weeks = await loadScheduleWeeks(missing);
      this.schedule = mergeScheduleWeeks(this.schedule, weeks);
    },
    async loadGames(forceRefresh) {
      this.gamesByTeam = {};
      const result = await getGamesThisWeek(forceRefresh);
      if (!result) {
        return;
      }
      this.gamesByTeam = result.gamesByTeam;
      // Keeps weeks loaded on demand
      this.schedule = mergeScheduleWeeks(this.schedule, result.schedule);
      this.$store.commit('setKeyValue', { key: 'gamesByMatchup', value: result.gamesByMatchup })
      this.$store.commit('setKeyValue', { key: 'weekStartDates', value: result.weekStartDates })
    },
    // keepShown leaves the current players in the table while the load runs (Refresh), skipActivity
    // leaves reading league activity to the caller
    async loadPlayers(forceRefresh, { keepShown = false, skipActivity = false } = {}) {
      // Only show the result of the most recent load, e.g. after toggling a setting twice
      const loadId = ++this.latestLoadId;
      if (!keepShown) {
        this.players = [];
      }
      this.loading = true;
      const result = await loadHockeyPlayers(
        this.leagueId,
        this.excludeIfNoPoints,
        forceRefresh
      );
      if (loadId !== this.latestLoadId) {
        return;
      }
      this.players = result.players || [];
      this.playersSavedAt = result.savedAt;
      this.loadError = result.error;
      this.loading = false;
      if (this.players.length) {
        if (!skipActivity) {
          this.loadActivity();
        }
        this.loadLastSeasonIfNeeded();
      }
    },
    async loadActivity() {
      // The player load reads new activity for ownership changes. Counting your team's adds also needs
      // it back to the start of the matchup.
      const period = currentPeriod(this.league?.scoreboard, Date.now());
      let log = null;
      if (this.$store.state.myTeamId && period) {
        try {
          log = await syncActivity(this.leagueId, { since: period.start, maxPages: 10 });
        } catch (err) {
          console.error(err);
        }
      }
      this.setActivityLog(log || await getActivityLog(this.leagueId));
    },
    setActivityLog(log) {
      this.activityItems = log.items;
      this.activityCoveredFrom = log.coveredFrom;
    },
    // Shows a page from the URL or history: the store keys from stateFromNav
    applyPage(page) {
      this.recordedPage = navFromState(page);
      for (const [key, value] of Object.entries(page)) {
        this.setKey(key, value);
      }
    },
    /**
     * Adds the page showing to the browser's history, or with replace updates the current entry.
     * The site keeps it in the URL. In the extension it's kept in history entries without changing
     * fleaflicker's URL, and only while the panel is open, so Back on fleaflicker's page still
     * leaves it when the panel is closed.
     */
    recordPage({ replace = false } = {}) {
      const page = this.page;
      this.recordedPage = page;
      if (this.$router) {
        // Passing the path keeps its slashes, the route's param would encode them
        const location = { path: this.$route.path, query: queryWithNav(this.$route.query, page) };
        if (replace) {
          this.$router.replace(location);
        } else {
          this.$router.push(location);
        }
        return;
      }
      const entry = { ...(window.history.state || {}), [HISTORY_KEY]: page };
      if (replace || !this.$store.state.drawerExpanded) {
        window.history.replaceState(entry, '');
      } else {
        window.history.pushState(entry, '');
      }
    },
    onPopState(event) {
      const target = stateFromNav(event.state?.[HISTORY_KEY]);
      if (target) {
        this.applyPage(target);
      }
    },
    openPlayerById(playerId) {
      const player = this.tablePlayers.find(candidate => candidate.id === playerId);
      if (player) {
        this.setKey('selectedPlayer', player);
      }
    },
    // For last season columns, projections and rosters
    async loadLastSeasonIfNeeded() {
      const needed = usesLastSeason(this.$store.state.visibleColumnKeys) || LEAGUE_TABS.includes(this.activeTab);
      if (this.lastSeasonById || !needed) {
        return;
      }
      this.lastSeasonById = await loadLastSeasonStats(this.leagueId);
    },
    async loadLeague({ forceRefresh = false, refreshScores = false, skipActivity = false } = {}) {
      const league = await loadLeagueInfo(this.leagueId, { forceRefresh, refreshScores });
      if (league) {
        this.league = league;
        // For the Ownership filter
        this.setKey('owners', league.teams.map(team => team.name));
        if (this.players.length && !skipActivity) {
          this.loadActivity();
        }
      }
      recordLeagueVisit({ id: this.leagueId, name: league?.name, sport: "nhl" });
    },
    setKey(key, value) {
      this.$store.commit('setKeyValue', { key, value });
    },
    toggleDrawer() {
      this.$store.commit('toggleDrawer')
    },
    clearSelectedPlayer() {
      this.$store.commit('setKeyValue', { key: 'selectedPlayer', value: null })
    },
    selectPlayer(player) {
      if (this.selectedPlayer?.id !== player.id) {
        this.$store.commit('setKeyValue', { key: 'selectedPlayer', value: player })
      } else {
        this.$store.commit('setKeyValue', { key: 'selectedPlayer', value: null })
      }
    },
    /**
     * Refresh: what changes during the day. Players' stats (only if games have been played since
     * they were fetched) and owners, the scoreboard and standings, then league activity once.
     * The NHL schedule, roster rules and league settings rarely change and keep their own expiry.
     */
    // Today's starting goalies, until every one is confirmed
    async loadGoalies(forceRefresh = false) {
      const date = this.goalieDate;
      const day = await loadStartingGoalies(date, { now: Date.now(), forceRefresh });
      if (date === this.goalieDate) {
        this.startingGoalies = day;
      }
    },
    async refreshAll() {
      await Promise.all([
        this.loadPlayers(true, { keepShown: true, skipActivity: true }),
        this.leagueId ? this.loadLeague({ refreshScores: true, skipActivity: true }) : null,
        this.loadGoalies(true),
      ]);
      if (this.players.length) {
        this.loadActivity();
      }
    },
    async resetApp() {
      const confirmed = window.confirm(
        "Reset the app? This clears your filters and settings and fetches all players again, which can take a minute."
      );
      if (!confirmed) {
        return;
      }
      await clearAllStored();
      location.reload();
    }
  },
  created() {
    this.leagueId = getLeagueId();
    // The standalone site keeps the tab in the URL, so it can be linked to
    // In the extension, fleaflicker's menu links to the signed in user's team
    if (!process.env.STANDALONE && !this.$store.state.myTeamId) {
      const myTeamId = findMyTeamIdOnPage(this.leagueId);
      if (myTeamId) {
        this.setKey('myTeamId', myTeamId);
      }
    }
    // The standalone site's URL says which page to show, otherwise the last one shown
    const fromUrl = this.$route && queryHasNav(this.$route.query) ? stateFromNav(this.$route.query) : null;
    if (fromUrl) {
      this.applyPage(fromUrl);
    }
  },
  mounted() {
    this.recordPage({ replace: true });
    if (!this.$router) {
      window.addEventListener('popstate', this.onPopState);
    }
    this.clock = setInterval(() => { this.now = Date.now(); }, CLOCK_INTERVAL);
    this.loadPlayers();
    this.loadGames();
    this.loadGoalies();
    if (this.leagueId) {
      this.loadLeague();
    }
  },
  beforeUnmount() {
    clearInterval(this.clock);
    window.removeEventListener('popstate', this.onPopState);
  },
  watch: {
    "$store.state.visibleColumnKeys"() {
      if (!this.loading) {
        this.loadLastSeasonIfNeeded();
      }
    },
    activeTab() {
      if (!this.loading) {
        this.loadLastSeasonIfNeeded();
      }
    },
    // An open player panel shows the player's latest data, like a starting goalie announced since
    tablePlayers(players) {
      const open = this.$store.state.selectedPlayer;
      const latest = open && players.find(player => player.id === open.id);
      if (latest) {
        this.setKey('selectedPlayer', latest);
      }
    },
    // A new day's starters at 6am Eastern
    goalieDate() {
      this.startingGoalies = null;
      this.loadGoalies();
    },
    // Starters are announced through the day: check again every 15 minutes until they're all confirmed
    now() {
      const day = this.startingGoalies;
      if (day && !day.complete && this.now - day.fetchedAt >= GOALIE_CHECK_INTERVAL) {
        this.loadGoalies();
      }
    },
    // Going to another page adds it to the browser's history
    page(page) {
      if (!sameNav(page, this.recordedPage)) {
        this.recordPage();
      }
    },
    // Back and Forward on the standalone site
    "$route.query"(query) {
      const target = queryHasNav(query) ? stateFromNav(query) : null;
      if (target && !sameNav(navFromState(target), this.recordedPage)) {
        this.applyPage(target);
      }
    },
  },
  computed: {
    waiverSettings() {
      return this.league?.settings?.waivers;
    },
    drops() {
      return latestDrops(this.activityItems);
    },
    // { left, limit } adds this matchup, once the activity back to the matchup's start has been read
    myAddsLeft() {
      const myTeamId = this.$store.state.myTeamId;
      const limit = acquisitionLimit(this.league?.settings);
      const period = currentPeriod(this.league?.scoreboard, this.now);
      if (!myTeamId || limit === null || !period || this.activityCoveredFrom === null || this.activityCoveredFrom > period.start) {
        return null;
      }
      const left = Math.max(limit - countAcquisitions(this.activityItems, myTeamId, period), 0);
      return { left, limit };
    },
    // Players with availability and last season's stats, for the table
    // From the NHL schedule, so it's right however long ago players were fetched. Null until the
    // schedule has the rest of the matchup.
    gamesLeft() {
      return gamesLeftByTeam(this.schedule, { period: currentPeriod(this.league?.scoreboard, this.now), now: this.now });
    },
    // The page showing: tab, week, and matchup or team page open
    page() {
      return navFromState(this.$store.state);
    },
    // Today's scoring day in Eastern, which runs until 6am like fleaflicker's
    goalieDate() {
      return easternDate(this.now - SCORING_DAY_START_HOURS * 60 * 60 * 1000);
    },
    // Each goalie's start today by player id, see goalieStarts
    goalieStartsById() {
      return goalieStarts(this.startingGoalies, this.players);
    },
    // Date to the teams playing that day, for lineup spot filters
    teamsByDate() {
      const byDate = {};
      for (const day of (this.schedule || []).flatMap(week => week.days)) {
        byDate[day.date] = day.games.flatMap(game => [game.away, game.home]);
      }
      return byDate;
    },
    // The same for today's game. Null until the schedule has today.
    todaysGames() {
      return todaysGamesByTeam(this.schedule, { now: this.now });
    },
    tablePlayers() {
      const context = { waivers: this.waiverSettings, drops: this.drops, now: this.now };
      return this.players.map(stored => {
        // Fleaflicker's games left and today's game are from when players were fetched
        const todaysGame = this.todaysGames?.[stored.team];
        const player = {
          ...stored,
          ...(this.gamesLeft && { gamesThisWeek: this.gamesLeft[stored.team] || 0 }),
          ...(this.todaysGames && {
            todaysGame: todaysGame?.todaysGame,
            todaysGameStart: todaysGame?.todaysGameStart,
            hasGameToday: !!todaysGame,
          }),
          // Daily Faceoff's starter for today, only for goalies on teams it lists
          goalieStart: this.goalieStartsById.get(stored.id),
          goalieStartLabel: goalieStartLabel(this.goalieStartsById.get(stored.id)),
          goalieStartOrder: GOALIE_START_ORDER[goalieStartLabel(this.goalieStartsById.get(stored.id))],
        };
        const availability = waiverStatus(player, context);
        return {
          ...player,
          availability,
          availabilityLabel: availabilityLabel(availability, this.now),
          availabilityOrder: availabilityOrder(availability),
          ...lastSeasonFields(this.lastSeasonById, player.id),
        };
      });
    },
    loadMessage() {
      if (this.loading || !this.loadError) {
        return null;
      }
      if (this.loadError === LOAD_ERRORS.noLeague) {
        return "There's no league ID in the URL. Go back and enter your league ID.";
      }
      if (this.loadError === LOAD_ERRORS.leagueNotFound) {
        return `League ${this.leagueId} wasn't found on Fleaflicker. Check the league ID in the URL.`;
      }
      if (this.players.length && this.playersSavedAt) {
        const savedAt = new Date(this.playersSavedAt).toLocaleString([], {
          weekday: "short",
          hour: "numeric",
          minute: "2-digit",
        });
        return `Couldn't reach Fleaflicker, showing players saved ${savedAt}. Use Refresh to try again.`;
      }
      return "Couldn't reach Fleaflicker. Use Refresh to try again in a minute.";
    },
    activeTab: {
      get() {
        return this.$store.state.activeTab;
      },
      set(tab) {
        // A tab opens on its main page, not a team or matchup opened earlier
        this.setKey('openTeamId', null);
        if (tab === 'matchups') {
          this.setKey('openMatchupId', null);
        }
        this.setKey('activeTab', tab);
      },
    },
    ...mapState({
      excludeIfNoPoints: state => state.excludeIfNoPoints,
      selectedPlayer: state => state.selectedPlayer,
    }),
  },
};
</script>

<style lang="scss" scoped>
.loadMessage {
  padding: 0.5em;
  margin-bottom: 0.5em;
}
</style>