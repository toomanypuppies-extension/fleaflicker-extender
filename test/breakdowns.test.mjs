import { test } from 'node:test';
import assert from 'node:assert/strict';
import { playerBreakdown, positionBreakdown, playerChartRows, positionChartRows } from '../src/hockey/collections/breakdowns.js';

const days = [{
  points: 9,
  lineup: [
    { group: 'START', playerId: 1, name: 'A', position: 'C', games: 1, points: 5 },
    { group: 'START', playerId: 2, name: 'B', position: 'D', games: 1, points: 4 },
    { group: 'BENCH', playerId: 3, name: 'C', position: 'LW', games: 1, points: 7 },
  ],
}];
// Player 4 hasn't scored this matchup but is projected to
const projection = {
  players: [
    { id: 1, name: 'A', position: 'C', positions: ['C'], expected: 6, games: 2 },
    { id: 4, name: 'D', position: 'F', positions: ['C', 'LW', 'RW'], expected: 12, games: 3 },
    { id: 5, name: 'E', position: 'G', positions: ['G'], expected: 0, games: 0 },
  ],
};

test('players projected to score show up even before they have', () => {
  const players = playerBreakdown(days, projection);

  assert.deepEqual(players.map(p => [p.id, p.scored, p.projected, p.starts]), [[4, 0, 12, 3], [1, 5, 6, 2], [2, 4, 0, 0]]);
  // Without a projection, only what's been scored
  assert.deepEqual(playerBreakdown(days).map(p => p.id), [1, 2]);
});

test('positions add projected starts to scored ones', () => {
  const positions = positionBreakdown(days, projection);

  assert.deepEqual(positions.map(p => [p.position, p.scored, p.projected, p.starts]), [
    ['C', 5, 18, 5], ['LW', 0, 0, 0], ['RW', 0, 0, 0], ['D', 4, 0, 0], ['G', 0, 0, 0],
  ]);
});

test('chart rows stack scored and projected, and fold the rest into one row', () => {
  const many = Array.from({ length: 15 }, (_, i) => ({ id: i, name: `P${i}`, position: 'C', scored: 15 - i, games: 1, projected: 1, starts: 1 }));

  const rows = playerChartRows(many, { stacked: true });
  assert.equal(rows.length, 13);
  assert.deepEqual(rows[0].values, [[15, 1]]);
  assert.deepEqual(rows[12], {
    key: 'others',
    label: '3 others',
    values: [[6, 3]],
    details: [['P12, P13, P14', 'P12, P13, P14']],
  });
  assert.deepEqual(playerChartRows(many.slice(0, 1)).map(row => row.values), [[15]]);
  // More shown, fewer in the rest
  const more = playerChartRows(many, { shown: 14 });
  assert.equal(more.length, 15);
  assert.equal(more[14].label, '1 other');
  assert.equal(playerChartRows(many, { shown: 22 }).length, 15);

  const positionRows = positionChartRows([positionBreakdown(days, projection), positionBreakdown(days)], { stacked: true });
  assert.deepEqual(positionRows[0].values, [[5, 18], [5, 0]]);
});
