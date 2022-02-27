export const getLeagueId = () => {
  const url = location.href;
  const matches = url.match(/leagues\/\d{1,6}/);
  return matches[0].split("/")[1];
};

export const convertEpochToTimeString = (epoch) => {
  return new Date(parseInt(epoch, 10)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export const beginningOfWeek = () => {
  let d = new Date();
  const day = d.getDay();

  if (day > 1) {
    d = new Date(d.setHours(-24 * (day - 1)))
  } else if (day < 1) {
    d = new Date(d.setHours(-24 * 6))
  }

  return d;
}

/**
 * Gets the previous or current monday
 */
export const beginningOfWeekString = () => {
  return beginningOfWeek().toISOString().split('T')[0]
}


export const endOfWeek = () => {
  let d = new Date();
  const day = d.getDay();

  if (day > 0) {
    d = new Date(d.setHours(24 * (7 - day)))
  }

  return d;
}

/**
 * Gets the next or current sunday
 */
export const endOfWeekString = () => {
  return endOfWeek().toISOString().split('T')[0]
}
