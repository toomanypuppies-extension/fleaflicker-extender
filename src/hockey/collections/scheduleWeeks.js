import { getStored, setStored } from "../../utils/db";
import { getScheduleWeek } from "../api/nhlv2";
import { easternDate } from "./schedule";
import { dayDate } from "./boxscores";
import { convertEpochToTimeString } from "../../utils/util";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
// Fleaflicker's scoring days start at 6am Eastern
const SCORING_DAY_START_HOUR = 6;
// Games get postponed and rescheduled, so weeks that aren't over are checked twice a day
const SCHEDULE_WEEK_MAX_AGE = 12 * HOUR;
// The NHL's schedule is the same for every league
const STORAGE_ID = 'nhl';
const STORAGE_KEY = 'hockey_scheduleWeeks';

const toUtc = (date) => {
  const [year, month, day] = date.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
};
const fromUtc = (time) => new Date(time).toISOString().slice(0, 10);

// The Monday of the week a date (YYYY-MM-DD) is in, how the NHL's schedule splits weeks
export const weekStart = (date) => {
  const time = toUtc(date);
  const weekday = (new Date(time).getUTCDay() + 6) % 7;
  return fromUtc(time - weekday * DAY);
};

// Every date (YYYY-MM-DD) in a matchup period
export const periodDates = (period) => {
  const dates = [];
  for (let day = period.firstDay; day <= period.lastDay; day++) {
    dates.push(dayDate(period, day));
  }
  return dates;
};

/**
 * The schedule weeks covering `dates`, from storage when fresh enough, else from the NHL.
 * Weeks that are over never change and are kept for good. Weeks that can't be loaded are left out.
 * @returns {Promise<Array>} convertSchedule weeks, by start date
 */
export const loadScheduleWeeks = async (dates, { now = Date.now() } = {}) => {
  const starts = [...new Set(dates.map(weekStart))].sort();
  const stored = (await getStored(STORAGE_KEY, STORAGE_ID)) || {};
  const today = easternDate(now);
  let changed = false;

  for (const start of starts) {
    const entry = stored[start];
    const over = fromUtc(toUtc(start) + 6 * DAY) < today;
    if (entry && (entry.over || now - entry.fetchedAt < SCHEDULE_WEEK_MAX_AGE)) continue;
    try {
      const week = await getScheduleWeek(start);
      if (week) {
        stored[start] = { week, fetchedAt: now, over };
        changed = true;
      }
    } catch (err) {
      // An older copy is better than none
      console.error(err);
    }
  }
  if (changed) {
    await setStored(STORAGE_KEY, stored, STORAGE_ID);
  }
  return starts.map(start => stored[start]?.week).filter(Boolean);
};

/**
 * `schedule` with `weeks` added or replacing ones with the same start, in date order
 */
export const mergeScheduleWeeks = (schedule, weeks) => {
  const byStart = new Map((schedule || []).map(week => [week.startDate, week]));
  for (const week of weeks) {
    byStart.set(week.startDate, week);
  }
  return [...byStart.values()].sort((a, b) => (a.startDate < b.startDate ? -1 : 1));
};

/**
 * One period's days from the schedule, as a single week for weekGrid: { startDate, days }.
 * Days the schedule doesn't cover are left out.
 */
export const periodSchedule = (schedule, period) => {
  const byDate = new Map((schedule || []).flatMap(week => week.days).map(day => [day.date, day]));
  const dates = periodDates(period);
  return { startDate: dates[0], days: dates.map(date => byDate.get(date)).filter(Boolean) };
};

// Whether the schedule has every day of the period
export const coversPeriod = (schedule, period) => periodSchedule(schedule, period).days.length === period.lastDay - period.firstDay + 1;

/**
 * Each team's games from today to the end of the matchup period (or without one, the week), today
 * included until the scoring day ends at 6am Eastern: { [team]: games }. Null when the schedule
 * doesn't have every one of those days yet.
 */
export const gamesLeftByTeam = (schedule, { period = null, now = Date.now() } = {}) => {
  const today = easternDate(now - SCORING_DAY_START_HOUR * HOUR);
  const start = weekStart(today);
  const dates = period
    ? periodDates(period)
    : Array.from({ length: 7 }, (_, i) => fromUtc(toUtc(start) + i * DAY));
  const byDate = new Map((schedule || []).flatMap(week => week.days).map(day => [day.date, day]));
  const left = dates.filter(date => date >= today);
  if (left.some(date => !byDate.has(date))) {
    return null;
  }
  const games = {};
  for (const date of left) {
    for (const game of byDate.get(date).games) {
      games[game.away] = (games[game.away] || 0) + 1;
      games[game.home] = (games[game.home] || 0) + 1;
    }
  }
  return games;
};

/**
 * Each team's game on today's scoring day (until 6am Eastern), as the players table shows it:
 * { [team]: { todaysGame: '@SEA 07:00 PM', todaysGameStart } }. Null when the schedule doesn't have
 * today.
 */
export const todaysGamesByTeam = (schedule, { now = Date.now() } = {}) => {
  const today = easternDate(now - SCORING_DAY_START_HOUR * HOUR);
  const day = (schedule || []).flatMap(week => week.days).find(candidate => candidate.date === today);
  if (!day) {
    return null;
  }
  const games = {};
  for (const game of day.games) {
    const time = convertEpochToTimeString(game.start);
    games[game.away] = { todaysGame: `@${game.home} ${time}`, todaysGameStart: game.start };
    games[game.home] = { todaysGame: `${game.away} ${time}`, todaysGameStart: game.start };
  }
  return games;
};
