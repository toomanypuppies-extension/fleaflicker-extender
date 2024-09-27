import { getLeagueId } from "./util";

export const setLocalStorage = (key, payload, leagueId) => {
  const id = leagueId || getLeagueId()
  const stringified = JSON.stringify(payload);
  localStorage.setItem(`ff-extender-${id}-${key}`, stringified);
}

export const getLocalStorage = (key, leagueId) => {
  const id = leagueId || getLeagueId()
  const stringified = localStorage.getItem(`ff-extender-${id}-${key}`);
  return JSON.parse(stringified);
}

export const clearLocalStorage = (key, payload, leagueId) => {
  const id = leagueId || getLeagueId()
  const stringified = JSON.stringify(payload);
  localStorage.removeItem(`ff-extender-${id}-${key}`);
}
