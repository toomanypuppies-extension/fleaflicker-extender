<template>
  <div class="gameWeekOuterContainer">
    <h3 class="startDate">{{ startDate }} - {{ endDate }}</h3>
    <div class="gameWeekContainer" :style="bindCssVars">
      <div class="gameDay" :class="{ hasGame: week.MON !== '' }"><span>{{ week.MON }}</span></div>
      <div class="gameDay" :class="{ hasGame: week.TUE !== '' }"><span>{{ week.TUE }}</span></div>
      <div class="gameDay" :class="{ hasGame: week.WED !== '' }"><span>{{ week.WED }}</span></div>
      <div class="gameDay" :class="{ hasGame: week.THU !== '' }"><span>{{ week.THU }}</span></div>
      <div class="gameDay" :class="{ hasGame: week.FRI !== '' }"><span>{{ week.FRI }}</span></div>
      <div class="gameDay" :class="{ hasGame: week.SAT !== '' }"><span>{{ week.SAT }}</span></div>
      <div class="gameDay" :class="{ hasGame: week.SUN !== '' }"><span>{{ week.SUN }}</span></div>
    </div>
  </div>
</template>

<script>
import { mapGetters } from "vuex";
import { previousMonday, nextSunday, isSameWeek, isMonday, isSunday, formatISO, format } from 'date-fns'

export default {
  props: {
    week: Object,
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

<style lang="scss">
.gameWeekOuterContainer {
  display: flex;
  flex-direction: column;
}

.gameWeekContainer {
  display: flex;

  .gameDay:last-child {
    border-right: 4px solid var(--teamMainColor);
  }
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
}
</style>