<template>
  <div class="appToolbar containerColor">
    <div class="tabs" role="tablist" aria-label="Sections">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        type="button"
        role="tab"
        class="tab"
        :class="{ active: tab.key === activeTab }"
        :aria-selected="tab.key === activeTab"
        @click="$emit('update:activeTab', tab.key)"
      >{{ tab.label }}</button>
    </div>

    <div class="toolbarActions">
      <label v-if="teams.length" class="myTeam">
        <span class="myTeamLabel">Your team</span>
        <select :value="myTeamId ?? ''" @change="setMyTeam($event.target.value)">
          <option value="">Not picked</option>
          <option v-for="team in teams" :key="team.id" :value="team.id">{{ team.name }}</option>
        </select>
      </label>
      <span v-if="addsLeft" class="addsLeft" title="Your team's adds and claims left this matchup">
        <span class="addsLong">{{ addsLeft.left }} of {{ addsLeft.limit }} adds left</span>
        <span class="addsShort" aria-hidden="true">{{ addsLeft.left }}/{{ addsLeft.limit }} adds</span>
      </span>
      <span class="freshness" :title="updatedTitle">{{ freshness }}</span>
      <button type="button" class="toolbarButton" :disabled="loading" aria-label="Refresh"
        title="Check fleaflicker for changes now" @click="$emit('refresh')">
        <va-icon class="material-icons" size="1.25em" :class="{ spinning: loading }">refresh</va-icon>
        <span class="buttonLabel">Refresh</span>
      </button>
      <button type="button" class="toolbarButton" aria-label="Help" @click="$emit('openHelp')">
        <va-icon class="material-icons" size="1.25em">help_outline</va-icon>
        <span class="buttonLabel">Help</span>
      </button>
      <button type="button" class="toolbarButton" aria-label="Settings" @click="$emit('openSettings')">
        <va-icon class="material-icons" size="1.25em">settings</va-icon>
        <span class="buttonLabel">Settings</span>
      </button>
    </div>
  </div>
</template>

<script>
import { TABS } from "../constants";

const isToday = (date) => date.toDateString() === new Date().toDateString();

export default {
  props: {
    activeTab: String,
    loading: Boolean,
    // When the players' stats were fetched
    updatedAt: Number,
    // Your team's adds left this matchup: { left, limit }
    addsLeft: Object,
    // The league's teams, to pick yours from
    teams: { type: Array, default: () => [] },
  },
  emits: ["update:activeTab", "refresh", "openHelp", "openSettings"],
  data() {
    return { tabs: TABS };
  },
  methods: {
    setMyTeam(value) {
      this.$store.commit('setKeyValue', { key: 'myTeamId', value: value ? parseInt(value, 10) : null });
    },
  },
  computed: {
    // Picked here or found on fleaflicker's page; marks your team and opponent across the app
    myTeamId() {
      return this.$store.state.myTeamId;
    },
    freshness() {
      if (this.loading) {
        return "Updating…";
      }
      if (!this.updatedAt) {
        return "";
      }
      const updated = new Date(this.updatedAt);
      const time = updated.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      return isToday(updated)
        ? `Updated ${time}`
        : `Updated ${updated.toLocaleDateString([], { weekday: "short" })} ${time}`;
    },
    updatedTitle() {
      return this.updatedAt
        ? `Player stats from ${new Date(this.updatedAt).toLocaleString()}. Ownership changes are checked every few minutes.`
        : null;
    },
  },
};
</script>

<style lang="scss" scoped>
.appToolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5em;
  margin-bottom: 1em;
  padding: 0 0.5em;
  flex-wrap: wrap;
}

.tabs {
  display: flex;
}

.tab,
.toolbarButton {
  font: inherit;
  color: inherit;
  background: none;
  border: none;
  cursor: pointer;
  min-height: 44px;

  &:focus-visible {
    outline: 2px solid var(--teamSecondaryColor);
    outline-offset: -2px;
  }
}

.tab {
  padding: 0 1em;
  font-weight: 700;
  border-bottom: 3px solid transparent;
  opacity: 0.75;

  &:hover {
    opacity: 1;
  }

  &.active {
    opacity: 1;
    border-bottom-color: var(--teamSecondaryColor);
  }
}

.toolbarActions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.25em;
  min-width: 0;
  max-width: 100%;
  margin-left: auto;
}

.addsShort {
  display: none;
}

.myTeam {
  display: flex;
  align-items: center;
  gap: 0.4em;
  min-width: 0;
  margin: 0 0.5em 0 0;
  font-weight: normal;

  select {
    min-width: 0;
    max-width: 14em;
    text-overflow: ellipsis;
    font: inherit;
    color: inherit;
    background: var(--themeBaseColor);
    border: 1px solid currentColor;
    border-radius: 4px;
    padding: 0.25em 0.4em;
    min-height: 32px;
  }
}

.myTeamLabel {
  font-size: 0.85em;
  opacity: 0.8;
  white-space: nowrap;
}

.addsLeft {
  font-weight: 700;
  padding: 0.15em 0.6em;
  border-radius: 1em;
  background: var(--teamSecondaryColor30Opacity);
  white-space: nowrap;
}

.freshness {
  font-size: 0.85em;
  opacity: 0.8;
  margin-right: 0.5em;
  white-space: nowrap;
}

.toolbarButton {
  display: flex;
  align-items: center;
  gap: 0.25em;
  padding: 0 0.6em;
  border-radius: 4px;

  &:hover:not(:disabled) {
    background: var(--teamSecondaryColor30Opacity);
  }

  &:disabled {
    cursor: default;
    opacity: 0.6;
  }
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 640px) {
  .buttonLabel {
    display: none;
  }

  // Still read by screen readers
  .myTeamLabel {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }

  .myTeam {
    margin-right: 0.25em;
  }

  .myTeam select {
    max-width: 7.5em;
  }

  .toolbarButton {
    padding: 0 0.4em;
  }

  // "4/7 adds" instead of "4 of 7 adds left"; the long one stays for screen readers
  .addsLong {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }

  .addsShort {
    display: inline;
  }

  .freshness {
    display: none;
  }
}
</style>
