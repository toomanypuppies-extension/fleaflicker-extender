import { HOCKEY_TEAM_NAME_TO_ABBR, HOCKEY_TEAM_ABBR_TO_COLORS } from '../hockey/constants';
import { FOOTBALL_TEAM_NAME_TO_ABBR, FOOTBALL_TEAM_ABBR_TO_COLORS } from '../football/constants';

export const getLeagueId = () => {
  const url = location.href;
  const matches = url.match(/leagues\/\d{1,8}/);
  return matches[0].split("/")[1];
};

export const getSport = () => {
  const url = location.href;
  const matches = url.match(/[a-z]+\/leagues\/\d{1,8}/);
  return matches[0].split("/")[0];
}

export const convertEpochToTimeString = (epoch) => {
  return new Date(parseInt(epoch, 10)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * checks if target array contains all values of the given array
 * @param {Array} target
 * @param {Array} values
 */
export const containsAll = (target, values) => {
  return values.every(v => target.includes(v))
}

export const getColors = (state) => {
  if (state.sport === 'nhl') {
    const abbr = HOCKEY_TEAM_NAME_TO_ABBR[state.nhl.favoriteTeam];
    return HOCKEY_TEAM_ABBR_TO_COLORS[abbr];
  }
  if (state.sport === 'nfl') {
    const abbr = FOOTBALL_TEAM_NAME_TO_ABBR[state.nfl.favoriteTeam];
    return FOOTBALL_TEAM_ABBR_TO_COLORS[abbr];
  }
}

export const changeTimeZone = (date, timeZone) => {
  if (typeof date === 'string') {
    return new Date(
      new Date(date).toLocaleString('en-US', {
        timeZone,
      }),
    );
  }

  return new Date(
    date.toLocaleString('en-US', {
      timeZone,
    }),
  );
}
