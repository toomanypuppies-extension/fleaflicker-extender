// Schedule example
// https://api-web.nhle.com/v1/schedule/2024-10-26

import axios from 'axios';
import { DATE_MAP, HOCKEY_TEAM_ABBR_TO_NAME, HOCKEY_TEAM_NAME_TO_ABBR, NHL_API_BASEV2, NHL_APIV2_ABBREV_TO_ABBR } from '../constants';
import { getLocalStorage, setLocalStorage } from '../../utils/storage';
import { previousMonday, nextSunday, isSameWeek, isMonday, isSunday, formatISO, format } from 'date-fns'
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

  if (!forceRefresh && storedThisWeek && storedGames) {
    return storedGames;
  }

  try {
    const monday = isMonday(now) ? now : previousMonday(now);
    const mondayDate = format(monday, "yyyy-MM-dd");

    const weekOneResponse = await axios.get(buildUrl(`schedule/${mondayDate}`));
    const nextMondayDate = weekOneResponse.data.nextStartDate;
    const weekTwoResponse = await axios.get(buildUrl(`schedule/${nextMondayDate}`));

    const games = convertGameObjects(weekOneResponse.data, weekTwoResponse.data);

    setLocalStorage('gamesThisWeek', games);
    setLocalStorage('gamesThisWeekFetchedAt', now.toLocaleString('en-US'));

    return games;
  } catch (err) {
    console.error(err)
  }
}

const convertGameObjects = (weekOne, weekTwo) => {
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