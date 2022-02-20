import { getLeagueId } from "./util";

export const setStore = (key, payload) => {
  const id = getLeagueId()
  const stringified = JSON.stringify(payload);
  localStorage.setItem(`ff-extender-${id}-${key}`, stringified);
}

export const getStore = (key) => {
  const id = getLeagueId()
  const stringified = localStorage.getItem(`ff-extender-${id}-${key}`);
  return JSON.parse(stringified);
}