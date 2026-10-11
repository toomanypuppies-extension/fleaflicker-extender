<template>
  <div class="gameWeekOuterContainer">
    <h4 class="startDate">{{ startDate }} - {{ endDate }}</h4>
    <div class="gameWeekContainer" :style="bindCssVars">
      <div v-for="day in days" :key="day.key" class="gameDayColumn">
        <span class="dayLabel" :title="day.name">{{ day.short }}</span>
        <div class="gameDay" :class="{ hasGame: !!week[day.key] }" :title="week[day.key] ? `${day.name} vs ${week[day.key]}` : `${day.name}, no game`">
          <span>{{ week[day.key] }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters } from "vuex";
import { nextSunday, format } from 'date-fns'

const DAYS = [
  { key: 'MON', short: 'M', name: 'Monday' },
  { key: 'TUE', short: 'T', name: 'Tuesday' },
  { key: 'WED', short: 'W', name: 'Wednesday' },
  { key: 'THU', short: 'T', name: 'Thursday' },
  { key: 'FRI', short: 'F', name: 'Friday' },
  { key: 'SAT', short: 'S', name: 'Saturday' },
  { key: 'SUN', short: 'S', name: 'Sunday' },
];

export default {
  data() {
    return { days: DAYS };
  },
  props: {
    // Missing for weeks the team has no games
    week: { type: Object, default: () => ({}) },
    startDate: String
  },
  computed: {
    ...mapGetters([
      'teamMainColor',
      'teamSecondaryColor',
      'themeBaseColor',
      'themeAccentColor'
    ]),
    bindCssVars() {
      return {
        "--themeAccentColor": this.themeAccentColor,
        "--themeBaseColor": this.themeBaseColor,
        "--teamMainColor": this.teamMainColor,
        "--teamSecondaryColor": this.teamSecondaryColor,
        "--teamSecondaryColor30Opacity": `${this.teamSecondaryColor}30`,
      };
    },
    endDate() {
      const end = nextSunday(new Date(this.startDate));
      return format(end, "yyyy-MM-dd")
    }
  }
}
</script>

<style lang="scss" scoped>
.gameWeekOuterContainer {
  display: flex;
  flex-direction: column;
}

.gameWeekContainer {
  display: flex;

  .gameDayColumn:last-child .gameDay {
    border-right: 4px solid var(--teamMainColor);
  }
}

.gameDayColumn {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.dayLabel {
  font-size: 0.75em;
  opacity: 0.75;
}

.gameDay {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 2.5em;
  width: 2.5em;
  line-height: 1em;
  color: var(--teamMainColor);
  border: 4px solid var(--teamMainColor);
  border-right: 0px;
}

.hasGame {
  background-color: var(--teamSecondaryColor);
}

.startDate {
  text-align: center;
  font-size: 0.9em;
  font-weight: 700;
  margin: 0 0 0.25em;
}
</style>