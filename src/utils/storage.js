import { getLeagueId } from "./util";

export const setStore = (key, payload) => {
  const id = getLeagueId()
  const stringified = JSON.stringify(payload);
  localStorage.setItem(`${id}-${key}`, stringified);
}

export const getStore = (key) => {
  const id = getLeagueId()
  const stringified = localStorage.getItem(`${id}-${key}`);
  return JSON.parse(stringified);
}