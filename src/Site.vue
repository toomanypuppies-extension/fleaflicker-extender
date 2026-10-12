<template>
  <main class="site-container">
    <header class="intro">
      <h1>Fleaflicker Extender</h1>
      <p>Search, sort and filter your Fleaflicker NHL league's players, schedules and moves.</p>
    </header>

    <section v-if="recentLeagues.length" class="panel" aria-labelledby="recentHeading">
      <h2 id="recentHeading">Recent leagues</h2>
      <ul class="leagueList">
        <li v-for="league in recentLeagues" :key="league.id" class="recentLeague">
          <a :href="leagueUrl(league.id)" class="leagueLink">
            <span class="leagueName">{{ league.name || `League ${league.id}` }}</span>
            <span class="leagueMeta">Opened {{ visitedLabel(league.lastVisited) }}</span>
          </a>
          <button type="button" class="forgetButton" :aria-label="`Remove ${league.name || league.id} from recent leagues`"
            @click="forget(league.id)">Remove</button>
        </li>
      </ul>
    </section>

    <section class="panel" aria-labelledby="openHeading">
      <h2 id="openHeading">Open a league</h2>
      <form class="openForm" novalidate @submit.prevent="openLeague">
        <label for="leagueInput">League ID or Fleaflicker link</label>
        <div class="inputRow">
          <input
            id="leagueInput"
            v-model="leagueInput"
            type="text"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            enterkeyhint="go"
            placeholder="12089"
            :aria-invalid="!!error"
            aria-describedby="leagueHint leagueError"
          />
          <button type="submit" class="openButton">Open</button>
        </div>
        <p id="leagueHint" class="hint">
          The number after "leagues" in your league's address, like fleaflicker.com/nhl/leagues/<b>12089</b>.
          You can paste the whole link.
        </p>
        <p v-if="error" id="leagueError" class="error" role="alert">{{ error }}</p>
      </form>
    </section>

    <section class="panel" aria-labelledby="othHeading">
      <h2 id="othHeading">OTH leagues</h2>
      <ul class="leagueList columns">
        <li v-for="league in leagues" :key="league.id">
          <a :href="leagueUrl(league.id)" class="leagueLink">
            <span class="leagueName">{{ league.name }}</span>
          </a>
        </li>
      </ul>
    </section>
  </main>
</template>

<script>
import { defineComponent } from "vue";
import { getRecentLeagues, forgetRecentLeague } from "./utils/recentLeagues";
import { parseLeagueInput } from "./utils/util";

const DAY = 24 * 60 * 60 * 1000;

export default defineComponent({
  name: 'Site',
  data() {
    return {
      leagueInput: "",
      error: null,
      recentLeagues: getRecentLeagues(),
      leagues: [
        { id: 12086, name: 'D1 - Gretzky' },
        { id: 12087, name: 'D2 - Brodeur' },
        { id: 12088, name: 'D2 - Roy' },
        { id: 12089, name: 'D3 - Messier' },
        { id: 12091, name: 'D3 - Jagr' },
        { id: 12090, name: 'D3 - Yzerman' },
        { id: 12093, name: 'D4 - Leetch' },
        { id: 12092, name: 'D4 - Coffee' },
        { id: 12095, name: 'D4 - Bourque' },
        { id: 12096, name: 'D4 - Orr' },
        { id: 12098, name: 'D5 - Hunter' },
        { id: 12099, name: 'D5 - Domi' },
        { id: 12097, name: 'D5 - Williams' },
        { id: 12100, name: 'D5 - McSorley' },
        { id: 12101, name: 'D5 - Probert' },
        { id: 14206, name: 'Keeper - Choccy' },
        { id: 9559, name: 'Keeper - OG' },
        { id: 9899, name: 'Keeper - Koala' },
      ]
    }
  },
  methods: {
    leagueUrl(id) {
      return `#/nhl/leagues/${id}`;
    },
    openLeague() {
      const id = parseLeagueInput(this.leagueInput);
      if (!id) {
        this.error = this.leagueInput.trim()
          ? "That doesn't look like a league ID. Enter the number, like 12089, or paste your league's Fleaflicker link."
          : "Enter your league ID.";
        return;
      }
      this.error = null;
      this.$router.push(`/nhl/leagues/${id}`);
    },
    forget(id) {
      forgetRecentLeague(id);
      this.recentLeagues = getRecentLeagues();
    },
    visitedLabel(time) {
      const days = Math.floor((Date.now() - time) / DAY);
      if (days < 1) return 'today';
      if (days === 1) return 'yesterday';
      if (days < 7) return `${days} days ago`;
      return new Date(time).toLocaleDateString([], { month: 'short', day: 'numeric' });
    },
  },
})
</script>

<style lang="scss" scoped>
.site-container {
  min-height: 100vh;
  padding: 1em 16px 2em;
  color: #e2e2e2;
  background: #333333;
  box-sizing: border-box;
}

.intro,
.panel {
  max-width: 720px;
  margin: 0 auto 1em;
}

.intro {
  h1 {
    font-size: 1.6em;
    font-weight: 700;
    margin: 0.25em 0;
  }

  p {
    opacity: 0.85;
  }
}

.panel {
  background: #3d3d3d;
  border-radius: 6px;
  padding: 1em;

  h2 {
    font-size: 1.15em;
    font-weight: 700;
    margin: 0 0 0.75em;
  }
}

.leagueList {
  list-style: none;
  padding: 0;
  margin: 0;

  &.columns {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 0.25em 1em;
  }
}

.recentLeague {
  display: flex;
  align-items: center;
  gap: 0.5em;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);

  &:last-child {
    border-bottom: none;
  }
}

.leagueLink {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 44px;
  color: inherit;
  text-decoration: none;

  &:hover .leagueName,
  &:focus-visible .leagueName {
    text-decoration: underline;
  }
}

.leagueName {
  font-weight: 600;
  color: #8ab4f8;
}

.leagueMeta {
  font-size: 0.85em;
  opacity: 0.7;
}

.forgetButton {
  font: inherit;
  font-size: 0.85em;
  color: inherit;
  background: none;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 4px;
  padding: 0.3em 0.7em;
  min-height: 36px;
  cursor: pointer;
  opacity: 0.8;
}

.openForm label {
  display: block;
  font-weight: 600;
  margin-bottom: 0.4em;
}

.inputRow {
  display: flex;
  gap: 0.5em;
}

input {
  flex: 1;
  min-width: 0;
  font: inherit;
  font-size: 16px; // Stops iOS zooming in on focus
  color: inherit;
  background: #2a2a2a;
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 4px;
  padding: 0 0.75em;
  min-height: 44px;

  &[aria-invalid="true"] {
    border-color: #ef5350;
  }
}

.openButton {
  font: inherit;
  font-weight: 700;
  color: #fff;
  background: #1a73e8;
  border: none;
  border-radius: 4px;
  padding: 0 1.25em;
  min-height: 44px;
  cursor: pointer;
}

input:focus-visible,
.openButton:focus-visible,
.forgetButton:focus-visible,
.leagueLink:focus-visible {
  outline: 2px solid #8ab4f8;
  outline-offset: 2px;
}

.hint {
  font-size: 0.85em;
  opacity: 0.75;
  margin-top: 0.5em;
}

.error {
  color: #ff8a80;
  margin-top: 0.5em;
}
</style>
