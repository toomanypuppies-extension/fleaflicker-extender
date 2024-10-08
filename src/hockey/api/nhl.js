// Schedule example
// https://statsapi.web.nhl.com/api/v1/schedule?startDate=2022-02-21&endDate=2022-02-27

// Player stats example
// https://statsapi.web.nhl.com/api/v1/people/8475193/stats?stats=statsSingleSeason&season=20222023

import axios from 'axios';
import { NHL_API_BASE, DATE_MAP, HOCKEY_TEAM_NAME_TO_ABBR } from '../constants';
import { getLocalStorage, setLocalStorage } from '../../utils/storage';
import { previousMonday, nextSunday, isSameWeek, isMonday, isSunday, formatISO } from 'date-fns'
import { changeTimeZone } from '../../utils/util';

/**
 * @deprecated
 */
const buildUrl = (segment) => {
  return `${NHL_API_BASE}/${segment}`;
}

/**
 * @deprecated
 */
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
    const sunday = isSunday(now) ? now : nextSunday(now);
    const response = await axios.get(buildUrl('schedule'), {
      params: {
        startDate: formatISO(monday, { representation: 'date' }),
        endDate: formatISO(sunday, { representation: 'date' })
      }
    })
    const games = convertGameObjects(response.data);
    setLocalStorage('gamesThisWeek', games);
    setLocalStorage('gamesThisWeekFetchedAt', now.toLocaleString('en-US'));
    return games;
  } catch (err) {
    console.error(err)
  }
}

/**
 * @deprecated
 */
const convertGameObjects = (gamesResponse) => {
  const gamesByDate = gamesResponse.dates;
  const gamesByTeam = {};

  gamesByDate.forEach((day, index) => {
    day.games.forEach(game => {
      const awayTeam = HOCKEY_TEAM_NAME_TO_ABBR[game.teams.away.team.name];
      const homeTeam = HOCKEY_TEAM_NAME_TO_ABBR[game.teams.home.team.name];

      if (gamesByTeam[awayTeam]) {
        gamesByTeam[awayTeam].push(DATE_MAP[index]);
      } else {
        gamesByTeam[awayTeam] = [DATE_MAP[index]];
      }

      if (gamesByTeam[homeTeam]) {
        gamesByTeam[homeTeam].push(DATE_MAP[index]);
      } else {
        gamesByTeam[homeTeam] = [DATE_MAP[index]];
      }
    })
  })

  return gamesByTeam;
}

