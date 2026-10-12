import { POSITIONS } from "./boxscores";
import { IR_ELIGIBLE_INJURIES, ROSTER_GROUPS } from "./league";

// Positions a listing like W or F stands for
const POSITION_GROUPS = { W: ['LW', 'RW'], F: ['C', 'LW', 'RW'] };

const round = (value) => Math.round(value * 100) / 100;

// The positions a player can fill: their eligibility, or their listed position(s)
export const eligiblePositions = (player) => {
  const listed = [
    ...(player.positions || []),
    ...(player.position || '').split('/'),
  ].flatMap(position => POSITION_GROUPS[position] || [position]);
  return POSITIONS.filter(position => listed.includes(position));
};

/**
 * Everyone on a roster, IR and taxi included, with their stats from the player table where it has
 * them: [{ ...rosterPlayer, ...stats, onIr, hurt }]
 */
export const rosterPlayers = (roster, playersById) => (roster?.groups || []).flatMap(group => group.slots
  .map(slot => slot.player)
  .filter(Boolean)
  .map(player => {
    const stats = playersById.get(player.id) || {};
    const merged = { ...player, ...stats };
    return {
      ...merged,
      onIr: group.group === ROSTER_GROUPS.injured,
      hurt: IR_ELIGIBLE_INJURIES.includes(merged.injury),
      hasStats: !!playersById.get(player.id),
    };
  }));

/**
 * How deep a roster is at each position: [{ position, players, healthy }] in POSITIONS order, the
 * players best first by season points. A player eligible at two positions counts at both.
 */
export const positionDepth = (players) => POSITIONS.map(position => {
  const eligible = players
    .filter(player => eligiblePositions(player).includes(position))
    .sort((a, b) => (b.points || 0) - (a.points || 0));
  return { position, players: eligible, healthy: eligible.filter(player => !player.hurt).length };
});

/**
 * Points per game this season minus last season's, or null when either is missing
 */
export const changeFromLastSeason = (player) => (
  player.gamesPlayed > 0 && typeof player.avg === 'number' && typeof player.lastSeasonAvg === 'number'
    ? round(player.avg - player.lastSeasonAvg)
    : null
);
