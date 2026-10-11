import { getLocalStorage, setLocalStorage } from "../../utils/storage";
import { getLeagueOwners } from "../../utils/flea";

// Team names rarely change. Membership changes in the activity feed also clear this (see players.js)
const OWNERS_MAX_AGE = 24 * 60 * 60 * 1000;

export const loadLeagueOwners = async (leagueId) => {
  const stored = getLocalStorage('hockey_owners');
  const now = new Date().getTime();

  if (stored?.owners?.length && now - stored.fetchedAt < OWNERS_MAX_AGE) {
    return stored.owners;
  }

  const owners = await getLeagueOwners(leagueId);
  if (owners.length) {
    setLocalStorage('hockey_owners', { owners, fetchedAt: now });
    return owners;
  }

  // Fetch failed, fall back to whatever we had
  return stored?.owners || [];
}
