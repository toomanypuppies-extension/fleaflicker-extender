// Ex: https://statsapi.web.nhl.com/api/v1/schedule?startDate=2022-02-21&endDate=2022-02-27

import axios from 'axios';
import { NHL_API_BASE, DATE_MAP, TEAM_NAME_TO_ABBR } from '../contants';
import { getStore, setStore } from '../utils/storage';
import { previousMonday, nextSunday, isSameWeek, isMonday, isSunday, formatISO } from 'date-fns'


const buildUrl = (segment) => {
  return `${NHL_API_BASE}/${segment}`;
}

export const getGamesThisWeek = async (forceRefresh = false) => {
  const now = new Date();
  const storedGames = getStore('gamesThisWeek');
  const gamesStoreTime = getStore('gamesThisWeekFetchedAt');
  let storedThisWeek = false;
  if (gamesStoreTime) {
    const storeTime = parseInt(gamesStoreTime, 10);
    const storeDate = new Date(storeTime);
    if (isSameWeek(storeDate, now, 1)) {
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

    setStore('gamesThisWeek', games);
    setStore('gamesThisWeekFetchedAt', new Date().getTime());
    return games;
  } catch (err) {
    console.error(err)
  }
}

const convertGameObjects = (gamesResponse) => {
  const gamesByDate = gamesResponse.dates;
  const gamesByTeam = {};
  gamesByDate.forEach((day, index) => {
    day.games.forEach(game => {
      const awayTeam = TEAM_NAME_TO_ABBR[game.teams.away.team.name];
      const homeTeam = TEAM_NAME_TO_ABBR[game.teams.home.team.name];

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

