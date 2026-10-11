import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { convertPlayerObjects } from '../src/hockey/collections/players.js';

// Trimmed FetchPlayerListing players from a real league
const { skater, goalie } = JSON.parse(readFileSync(new URL('./fixtures/listingPlayers.json', import.meta.url)));

test('converts a skater', () => {
  const [player] = convertPlayerObjects([skater]);

  assert.equal(player.id, 4033);
  assert.equal(player.name, 'Auston Matthews');
  assert.equal(player.team, 'TOR');
  assert.equal(player.owner, 'Dumpster Fire Brigade');
  assert.equal(player.points, 43.25);
  assert.equal(player.avg, 7.21);
  assert.equal(player.gamesPlayed, 6);
  assert.equal(player.goals, 4);
  assert.equal(player.assists, 6);
  assert.equal(player.goalsAgainst, undefined);
  assert.equal(player.savePct, undefined);
  assert.equal(player.percentOwned, 98);
  assert.equal(player.rank, 6);
  assert.equal(player.positionRank, 4);
  assert.equal(player.positionRankLabel, 'C');
  assert.equal(player.consistency, 6.4310074);
  assert.deepEqual([player.last1, player.last5, player.last10], [17.45, 8.5, 7.21]);
  assert.deepEqual([player.trend1, player.trend5, player.trend10], ['hot', undefined, undefined]);
});

test('converts a goalie', () => {
  const [player] = convertPlayerObjects([goalie]);

  assert.equal(player.name, 'Jeremy Swayman');
  assert.equal(player.gamesPlayed, 6);
  assert.equal(player.goalsAgainst, 9);
  assert.ok(Math.abs(player.savePct - 0.93233086) < 1e-9);
  assert.equal(player.goals, undefined);
  assert.equal(player.assists, undefined);
});

test('a player without stats has no games played or ranks', () => {
  const [player] = convertPlayerObjects([{
    proPlayer: { id: 1, nameFull: 'New Player', proTeamAbbreviation: 'SEA', position: 'D', positionEligibility: ['D'] },
  }]);

  assert.equal(player.points, 0);
  assert.equal(player.avg, 0);
  assert.equal(player.gamesPlayed, 0);
  assert.equal(player.percentOwned, undefined);
  assert.equal(player.rank, undefined);
  assert.equal(player.trend5, undefined);
});
