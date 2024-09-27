import { HOCKEY_TEAM_NAME_TO_ABBR, HOCKEY_TEAM_ABBR_TO_COLORS } from '../hockey/constants';

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
  const abbr = HOCKEY_TEAM_NAME_TO_ABBR[state.favoriteTeam];
  return HOCKEY_TEAM_ABBR_TO_COLORS[abbr];
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

// Returns key=val1&key=val2@key=val3
export const mapToQueryArrayString = (array, key) => {
  let queryString = '';
  array.forEach((item, index) => {
    if (index !== (array.length - 1)) {
      queryString = queryString.concat(`${key}=${item}&`)
    } else {
      queryString = queryString.concat(`${key}=${item}`)
    }
  })
  return queryString;
}