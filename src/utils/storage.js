import { getLeagueId } from "./util";

export const setLocalStorage = (key, payload) => {
  const id = getLeagueId()
  const stringified = JSON.stringify(payload);
  localStorage.setItem(`ff-extender-${id}-${key}`, stringified);
}

export const getLocalStorage = (key) => {
  const id = getLeagueId()
  const stringified = localStorage.getItem(`ff-extender-${id}-${key}`);
  return JSON.parse(stringified);
}