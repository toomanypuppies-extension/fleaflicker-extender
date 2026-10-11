// Schedule example
// https://api-web.nhle.com/v1/schedule/2024-10-26

import axios from 'axios';
import { DATE_MAP, NHL_API_BASEV2, NHL_APIV2_ABBREV_TO_ABBR } from '../constants';
import { getLocalStorage, setLocalStorage } from '../../utils/storage';
import { previousMonday, isSameWeek, isMonday, format } from 'date-fns'
import { changeTimeZone } from '../../utils/util';

const buildUrl = (segment) => {
  return `${NHL_API_BASEV2}/${segment}`;
}

export const getGamesThisWeek = async (forceRefresh = false) => {
  // Always use EST time for this as thats what flea tracks weeks by
  const now = changeTimeZone(new Date(), 'America/New_York');
  const storedGames = getLocalStorage('gamesThisWeek');
  const gamesStoreTime = getLocalStorage('gamesThisWeekFetchedAt');
  let storedThisWeek = false;

  if (gamesStoreTime) {
    const storeDate = new Date(gamesStoreTime);
    if (isSameWeek(storeDate, now, { weekStartsOn: 1 })) {
      storedThisWeek = true;
    }
  }

  // Stored by older versions without the full schedule
  if (!forceRefresh && storedThisWeek && storedGames?.schedule) {
    return storedGames;
  }

  try {
    const monday = isMonday(now) ? now : previousMonday(now);
    const mondayDate = format(monday, "yyyy-MM-dd");

    const weekOneResponse = await axios.get(buildUrl(`schedule/${mondayDate}`));
    const nextMondayDate1 = weekOneResponse.data.nextStartDate;
    const weekTwoResponse = await axios.get(buildUrl(`schedule/${nextMondayDate1}`));
    const nextMondayDate2 = weekTwoResponse.data.nextStartDate;
    const weekThreeResponse = await axios.get(buildUrl(`schedule/${nextMondayDate2}`));
    const nextMondayDate3 = weekThreeResponse.data.nextStartDate;
    const weekFourResponse = await axios.get(buildUrl(`schedule/${nextMondayDate3}`));

    const gamesByTeam = convertGameObjectsToGamesByTeam(weekOneResponse.data, weekTwoResponse.data);
    const gamesByMatchup = convertGameObjectsToMatchups([
      weekOneResponse.data.gameWeek,
      weekTwoResponse.data.gameWeek,
      weekThreeResponse.data.gameWeek,
      weekFourResponse.data.gameWeek
    ])
    const weekStartDates = [
      mondayDate,
      nextMondayDate1,
      nextMondayDate2,
      nextMondayDate3
    ]
    // Used to tell whether fantasy stats could have changed since the last player fetch
    const gameStartTimes = [...weekOneResponse.data.gameWeek, ...weekTwoResponse.data.gameWeek]
      .flatMap(day => day.games.map(game => new Date(game.startTimeUTC).getTime()))
      .filter(time => !isNaN(time));

    const schedule = convertSchedule([weekOneResponse.data, weekTwoResponse.data, weekThreeResponse.data, weekFourResponse.data]);

    const games = {
      gamesByTeam,
      gamesByMatchup,
      weekStartDates,
      gameStartTimes,
      schedule,
    }

    setLocalStorage('gamesThisWeek', games);
    setLocalStorage('gamesThisWeekFetchedAt', now.toLocaleString('en-US'));

    return games;
  } catch (err) {
    console.error(err)
    // Last week's games would show on the wrong days, so only fall back to this week's
    return storedThisWeek && storedGames ? storedGames : null;
  }
}

/**
 * Every game in the given weeks of the NHL's schedule:
 * [{ startDate: '2026-10-12', days: [{ date, dayAbbrev: 'MON', games: [{ away: 'VAN', home: 'SEA', start }] }] }]
 * Team abbreviations are fleaflicker's.
 */
export const convertSchedule = (weeks) => weeks.map(week => ({
  startDate: week.gameWeek?.[0]?.date,
  days: (week.gameWeek || []).map(day => ({
    date: day.date,
    dayAbbrev: day.dayAbbrev,
    games: (day.games || [])
      .map(game => ({
        away: NHL_APIV2_ABBREV_TO_ABBR[game.awayTeam?.abbrev],
        home: NHL_APIV2_ABBREV_TO_ABBR[game.homeTeam?.abbrev],
        start: Date.parse(game.startTimeUTC),
      }))
      .filter(game => game.away && game.home),
  })),
}));

const convertGameObjectsToGamesByTeam = (weekOne, weekTwo) => {
  // { ABR: ['Mo', 'We', 'Next - Mo'] }
  const gamesByTeam = {};
  const convertWeek = (week, indexOffset = 0) => {
    week.forEach((day, index) => {
      day.games.forEach(game => {
        const awayTeam = NHL_APIV2_ABBREV_TO_ABBR[game.awayTeam.abbrev];
        const homeTeam = NHL_APIV2_ABBREV_TO_ABBR[game.homeTeam.abbrev];

        if (!!awayTeam && !!homeTeam) {
          if (gamesByTeam[awayTeam]) {
            gamesByTeam[awayTeam].push(DATE_MAP[index + indexOffset]);
          } else {
            gamesByTeam[awayTeam] = [DATE_MAP[index + indexOffset]];
          }

          if (gamesByTeam[homeTeam]) {
            gamesByTeam[homeTeam].push(DATE_MAP[index + indexOffset]);
          } else {
            gamesByTeam[homeTeam] = [DATE_MAP[index + indexOffset]];
          }
        }
      })
    })
  };

  convertWeek(weekOne.gameWeek);
  convertWeek(weekTwo.gameWeek, 7);

  return gamesByTeam;
}

const convertGameObjectsToMatchups = (weeks) => {
  const sampleWeek = {
    'MON': '',
    'TUE': '',
    'WED': '',
    'THU': '',
    'FRI': '',
    'SAT': '',
    'SUN': ''
  }

  const matchupsByTeam = {};
  const convertWeek = (week, weekIndex) => {
    week.forEach((day, index) => {
      day.games.forEach(game => {
        const awayTeam = NHL_APIV2_ABBREV_TO_ABBR[game.awayTeam.abbrev];
        const homeTeam = NHL_APIV2_ABBREV_TO_ABBR[game.homeTeam.abbrev];


        if (!!awayTeam && !!homeTeam) {
          if (!matchupsByTeam[awayTeam]) { matchupsByTeam[awayTeam] = {} }
          if (!matchupsByTeam[homeTeam]) { matchupsByTeam[homeTeam] = {} }
          if (!matchupsByTeam[awayTeam][weekIndex]) { matchupsByTeam[awayTeam][weekIndex] = Object.assign({}, sampleWeek) }
          if (!matchupsByTeam[homeTeam][weekIndex]) { matchupsByTeam[homeTeam][weekIndex] = Object.assign({}, sampleWeek) }

          matchupsByTeam[awayTeam][weekIndex][day.dayAbbrev] = homeTeam;
          matchupsByTeam[homeTeam][weekIndex][day.dayAbbrev] = awayTeam;
        }
      })
    })
  };

  weeks.forEach((week, index) => {
    convertWeek(week, index);
  })

  return matchupsByTeam;
}