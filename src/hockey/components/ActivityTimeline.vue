<template>
  <section class="timelineSection containerColor" aria-labelledby="timelineHeading">
    <div class="sectionHeader">
      <h2 id="timelineHeading">{{ teamId ? 'Moves in the last 14 days' : 'League activity, last 14 days' }}</h2>
      <div class="timelineFilters">
        <select v-if="!teamId" :value="timelineTeamId ?? ''" aria-label="Team" @change="setTimelineTeam($event.target.value)">
          <option value="">Every team</option>
          <option v-for="team in teams" :key="team.id" :value="team.id">{{ team.name }}</option>
        </select>
        <button v-for="(filter, key) in filterOptions" :key="key" type="button" class="filterButton"
          :class="{ active: timelineFilters.includes(key) }" :aria-pressed="timelineFilters.includes(key)"
          @click="toggleFilter(key)">{{ filter.label }}</button>
      </div>
    </div>
    <p class="legendNote"><span class="periodSwatch"></span> In the current matchup</p>

    <p v-if="loading" class="loading" role="status">Loading league activity…</p>
    <p v-else-if="error" class="notice">League activity couldn't be loaded. Use Refresh to try again.</p>
    <p v-else-if="!timeline.length" class="notice">No moves match.</p>

    <ol class="timeline">
      <li v-for="day in timeline" :key="day.date" class="timelineDay">
        <h3>{{ dayLabel(day.date) }}</h3>
        <ul>
          <li v-for="row in day.rows" :key="row.key" class="timelineRow" :class="{ inPeriod: row.inPeriod, oneTeam: !!teamId }">
            <span class="rowTime">{{ formatTime(row.time) }}</span>
            <span v-if="!teamId" class="rowTeam">{{ row.teamName || 'League' }}</span>
            <span class="rowText">
              <template v-if="row.kind === 'swap'">
                {{ row.added.kind === 'claim' ? 'claimed' : 'added' }}
                <PlayerName :item="row.added" :players="playersById" @open="openPlayer" />,
                dropped
                <PlayerName :item="row.dropped" :players="playersById" @open="openPlayer" />
                <span v-if="claimNote(row.added)" class="note">{{ claimNote(row.added) }}</span>
              </template>
              <template v-else-if="playerVerbs[row.kind]">
                {{ playerVerbs[row.kind] }}
                <PlayerName :item="row" :players="playersById" @open="openPlayer" />
                <template v-if="row.kind === 'irOn'"> on IR</template>
                <template v-if="row.kind === 'irOff'"> off IR</template>
                <span v-if="claimNote(row)" class="note">{{ claimNote(row) }}</span>
              </template>
              <template v-else-if="row.kind === 'trade'">made a trade</template>
              <template v-else-if="row.kind === 'membership'">team or owner change</template>
              <template v-else>league change</template>
            </span>
          </li>
        </ul>
      </li>
    </ol>
  </section>
</template>

<script>
import { mapState } from "vuex";
import { TIMELINE_WINDOW } from "../collections/activity";
import { buildTimeline, TIMELINE_FILTERS } from "../collections/timeline";
import PlayerName from "./PlayerName.vue";

const PLAYER_VERBS = {
  add: 'added',
  claim: 'claimed',
  drop: 'dropped',
  irOn: 'moved',
  irOff: 'moved',
};

/**
 * Adds, drops, claims and IR moves over the last 14 days, by day. For one team on its page, or
 * for the league with a team picker. The kind filters are shared between the two.
 */
export default {
  components: { PlayerName },
  props: {
    activityItems: Array,
    teams: Array,
    playersById: Map,
    // The current matchup period, its moves are marked
    period: Object,
    now: Number,
    loading: Boolean,
    error: Boolean,
    // Only this team's moves
    teamId: Number,
  },
  emits: ['openPlayer'],
  data() {
    return {
      playerVerbs: PLAYER_VERBS,
      filterOptions: TIMELINE_FILTERS,
    };
  },
  computed: {
    ...mapState({
      timelineTeamId: state => state.timelineTeamId,
      timelineFilters: state => state.timelineFilters,
    }),
    timeline() {
      return buildTimeline(this.activityItems || [], {
        since: this.now - TIMELINE_WINDOW,
        teamId: this.teamId ?? this.timelineTeamId,
        filters: this.timelineFilters,
        period: this.period,
      });
    },
  },
  methods: {
    setTimelineTeam(value) {
      this.$store.commit('setKeyValue', { key: 'timelineTeamId', value: value ? parseInt(value, 10) : null });
    },
    toggleFilter(key) {
      const filters = this.timelineFilters.includes(key)
        ? this.timelineFilters.filter(filter => filter !== key)
        : [...this.timelineFilters, key];
      this.$store.commit('setKeyValue', { key: 'timelineFilters', value: filters });
    },
    openPlayer(playerId) {
      this.$emit('openPlayer', playerId);
    },
    claimNote(item) {
      return item.kind === 'claim' && item.claimTeams > 1 ? `(${item.claimTeams} teams claimed)` : '';
    },
    formatTime(time) {
      return new Date(time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    },
    dayLabel(date) {
      const [year, month, day] = date.split('-').map(Number);
      const label = new Date(year, month - 1, day).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
      const today = new Date(this.now);
      const isToday = today.getFullYear() === year && today.getMonth() === month - 1 && today.getDate() === day;
      return isToday ? `Today, ${label}` : label;
    },
  },
};
</script>

<style lang="scss" scoped>
.timelineSection {
  padding: 0.75em 1em;
}

.sectionHeader {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75em;
  margin-bottom: 0.5em;

  h2 {
    font-size: 1.2em;
    font-weight: 700;
    margin: 0;
  }
}

select {
  font: inherit;
  color: inherit;
  background: var(--themeBaseColor);
  border: 1px solid currentColor;
  border-radius: 4px;
  padding: 0.3em 0.5em;
  min-height: 32px;
}

.notice {
  padding: 1em 0;
}

.loading,
.legendNote {
  font-size: 0.9em;
  opacity: 0.85;
  margin: 0 0 0.75em;
}

.timelineFilters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4em;
}

.filterButton {
  font: inherit;
  color: inherit;
  background: none;
  border: 1px solid currentColor;
  border-radius: 4px;
  padding: 0.25em 0.7em;
  min-height: 32px;
  cursor: pointer;
  opacity: 0.75;

  &.active {
    opacity: 1;
    background: var(--teamSecondaryColor30Opacity);
    border-color: var(--teamSecondaryColor);
  }

  &:focus-visible {
    outline: 2px solid var(--teamSecondaryColor);
  }
}

.periodSwatch {
  display: inline-block;
  width: 4px;
  height: 1em;
  vertical-align: middle;
  background: var(--teamSecondaryColor);
}

.timeline,
.timeline ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.timelineDay h3 {
  font-size: 0.95em;
  font-weight: 700;
  margin: 1em 0 0.4em;
}

.timelineRow {
  display: grid;
  grid-template-columns: 5.5em minmax(8em, 14em) 1fr;
  gap: 0.75em;
  padding: 0.35em 0.5em;
  border-left: 4px solid transparent;
  border-bottom: 1px solid rgba(127, 127, 127, 0.15);

  &.oneTeam {
    grid-template-columns: 5.5em 1fr;
  }

  &.inPeriod {
    border-left-color: var(--teamSecondaryColor);
  }
}

.rowTime {
  opacity: 0.75;
  white-space: nowrap;
}

.rowTeam {
  font-weight: 600;
}

.note {
  opacity: 0.75;
  margin-left: 0.3em;
}

@media (max-width: 640px) {
  .timelineRow,
  .timelineRow.oneTeam {
    grid-template-columns: 4.5em 1fr;
  }

  .rowText {
    grid-column: 2;
  }
}
</style>
