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
      <span v-if="addsLeft" class="addsLeft" title="Your team's adds and claims left this matchup">{{ addsLeft }}</span>
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
    // Your team's adds left this matchup, like "4 of 7 adds left"
    addsLeft: String,
  },
  emits: ["update:activeTab", "refresh", "openHelp", "openSettings"],
  data() {
    return { tabs: TABS };
  },
  computed: {
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
  align-items: center;
  gap: 0.25em;
  margin-left: auto;
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

  .addsLeft {
  font-weight: 700;
  padding: 0.15em 0.6em;
  border-radius: 1em;
  background: var(--teamSecondaryColor30Opacity);
  white-space: nowrap;
}

.freshness {
    display: none;
  }
}
</style>
