<template>
  <div class="gameWeek">
    <div class="weekHeading">
      <span class="weekName">{{ label }}</span>
      <span class="weekCount">{{ gameCount }} {{ gameCount === 1 ? 'game' : 'games' }}</span>
    </div>
    <ol class="days">
      <li v-for="day in days" :key="day.key" class="day"
        :class="{ hasGame: !!day.opponent, past: day.past, today: day.today }"
        :title="day.opponent ? `${day.name} vs ${day.opponent}` : `${day.name}, no game`">
        <span class="dayName">{{ day.short }} <span class="dayNumber">{{ day.date }}</span></span>
        <span class="opponent">{{ day.opponent || '–' }}</span>
      </li>
    </ol>
  </div>
</template>

<script>
const DAYS = [
  { key: 'MON', short: 'Mon', name: 'Monday' },
  { key: 'TUE', short: 'Tue', name: 'Tuesday' },
  { key: 'WED', short: 'Wed', name: 'Wednesday' },
  { key: 'THU', short: 'Thu', name: 'Thursday' },
  { key: 'FRI', short: 'Fri', name: 'Friday' },
  { key: 'SAT', short: 'Sat', name: 'Saturday' },
  { key: 'SUN', short: 'Sun', name: 'Sunday' },
];

const DAY = 24 * 60 * 60 * 1000;

// A YYYY-MM-DD date as midnight UTC, so days add up without time zone shifts
const utcDate = (date) => {
  const [year, month, day] = date.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
};

/**
 * One week of a player's team's games, Monday to Sunday, for the player panel.
 */
export default {
  props: {
    // Day abbreviation (MON…) to opponent. Missing for weeks the team has no games.
    week: { type: Object, default: () => ({}) },
    // The week's Monday, YYYY-MM-DD
    startDate: String,
    // 0 for this week
    index: Number,
  },
  data() {
    return { now: Date.now() };
  },
  computed: {
    today() {
      const now = new Date(this.now);
      return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    },
    days() {
      const start = utcDate(this.startDate);
      return DAYS.map((day, i) => {
        const time = start + i * DAY;
        return {
          ...day,
          date: new Date(time).getUTCDate(),
          opponent: this.week?.[day.key] || '',
          past: time < this.today,
          today: time === this.today,
        };
      });
    },
    gameCount() {
      return this.days.filter(day => day.opponent).length;
    },
    label() {
      if (this.index === 0) return 'This week';
      if (this.index === 1) return 'Next week';
      const format = (time) => new Date(time).toLocaleDateString([], { month: 'short', day: 'numeric', timeZone: 'UTC' });
      const start = utcDate(this.startDate);
      return `${format(start)} to ${format(start + 6 * DAY)}`;
    },
  },
};
</script>

<style lang="scss" scoped>
.gameWeek {
  display: flex;
  flex-direction: column;
  gap: 0.3em;
}

.weekHeading {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 0.9em;
}

.weekName {
  font-weight: 700;
}

.weekCount {
  opacity: 0.8;
}

.days {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 3px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.day {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.1em;
  padding: 0.3em 0.1em;
  border: 1px solid rgba(127, 127, 127, 0.3);
  border-radius: 4px;
  min-width: 0;

  &.hasGame {
    background: var(--teamSecondaryColor30Opacity);
    border-color: var(--teamSecondaryColor);
  }

  &.past {
    opacity: 0.45;
  }

  &.today {
    outline: 2px solid var(--teamSecondaryColor);
    outline-offset: -1px;
  }
}

.dayName {
  font-size: 0.7em;
  opacity: 0.8;
  white-space: nowrap;
}

.opponent {
  font-size: 0.85em;
  font-weight: 700;
  white-space: nowrap;
}

.day:not(.hasGame) .opponent {
  font-weight: normal;
  opacity: 0.5;
}
</style>
