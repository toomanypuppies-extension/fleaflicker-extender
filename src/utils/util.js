import { HOCKEY_TEAM_NAME_TO_ABBR, HOCKEY_TEAM_ABBR_TO_COLORS } from '../hockey/constants';

// The league in a fleaflicker or site address, this page's by default
export const getLeagueId = (url = location.href) => {
  const matches = url.match(/leagues\/\d{1,8}/);
  return matches && matches[0].split("/")[1];
};

export const getSport = () => {
  const url = location.href;
  const matches = url.match(/[a-z]+\/leagues\/\d{1,8}/);
  return matches && matches[0].split("/")[0];
}

// The calendar day in the NHL's and fleaflicker's time zone, e.g. "1/5/2026"
export const easternDay = (epochMilli) => new Date(epochMilli).toLocaleDateString('en-US', { timeZone: 'America/New_York' });

const EASTERN = 'America/New_York';

const easternParts = (epochMilli) => Object.fromEntries(
  new Intl.DateTimeFormat('en-US', {
    timeZone: EASTERN,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(new Date(epochMilli))
    .filter(part => part.type !== 'literal')
    .map(part => [part.type, parseInt(part.value, 10)])
);

// The instant a wall clock time happens in Eastern, e.g. 5:00 AM on Jan 5 2026 (month is 1-12)
const easternWallTimeToEpoch = ({ year, month, day, hour, minute }) => {
  const asUtc = Date.UTC(year, month - 1, day, hour, minute);
  // Eastern is 4 or 5 hours behind UTC, try both
  return [4, 5]
    .map(hours => asUtc + hours * 60 * 60 * 1000)
    .find(epoch => {
      const parts = easternParts(epoch);
      return parts.day === day && parts.hour === hour && parts.minute === minute;
    }) ?? asUtc + 5 * 60 * 60 * 1000;
};

/**
 * The first time after `after` that an Eastern clock shows hour:minute,
 * e.g. when the next 5:00 AM waiver processing happens
 */
export const nextEasternTime = (after, { hour, minute = 0 }) => {
  const { year, month, day } = easternParts(after);
  for (let offset = 0; offset < 3; offset++) {
    // Date.UTC rolls over month and year ends
    const date = new Date(Date.UTC(year, month - 1, day + offset));
    const epoch = easternWallTimeToEpoch({
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
      hour,
      minute,
    });
    if (epoch > after) {
      return epoch;
    }
  }
  return null;
};

// A name as it appears in site URLs: "Ryan O'Reilly" -> "ryan-oreilly", "Tim Stützle" -> "tim-stutzle"
// 1st, 2nd, 3rd, 4th … 11th, 12th, 13th … 21st
export const ordinal = (n) => {
  const teen = Math.floor(n / 10) % 10 === 1;
  const suffix = teen ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th');
  return `${n}${suffix}`;
};

export const slugify = (name) => (name || '')
  .normalize('NFD')
  // Accents, split off by normalize
  .replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .replace(/['’.]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

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

/**
 * In the extension, the user's team from fleaflicker's top menu, whose Team item links to it when
 * signed in (it's disabled when signed out). Null if it isn't there.
 */
export const findMyTeamIdOnPage = (leagueId) => {
  const links = typeof document === 'undefined' ? [] : document.querySelectorAll('.navbar-nav a[href]');
  for (const link of links) {
    const match = link.getAttribute('href').match(/\/leagues\/(\d+)\/teams\/(\d+)/);
    if (match && match[1] === String(leagueId) && link.textContent.trim() === 'Team') {
      return parseInt(match[2], 10);
    }
  }
  return null;
};

/**
 * A league id typed or pasted on the home page: "12089", or a fleaflicker link like
 * "https://www.fleaflicker.com/nhl/leagues/12089/players". Null if there isn't one.
 */
export const parseLeagueInput = (text) => {
  const trimmed = (text || '').trim();
  if (/^\d{1,9}$/.test(trimmed)) {
    return trimmed;
  }
  return trimmed.match(/leagues\/(\d{1,9})(?:\D|$)/)?.[1] || null;
};
