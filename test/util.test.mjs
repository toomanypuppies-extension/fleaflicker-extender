import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextEasternTime, easternDay } from '../src/utils/util.js';

const FIVE_AM = { hour: 5, minute: 0 };

test('the next 5 AM Eastern, in summer (EDT) and winter (EST)', () => {
  // 10 PM EDT Oct 10 -> 5 AM EDT Oct 11
  assert.equal(nextEasternTime(Date.parse('2026-10-11T02:00:00Z'), FIVE_AM), Date.parse('2026-10-11T09:00:00Z'));
  // 7 PM EST Jan 5 -> 5 AM EST Jan 6
  assert.equal(nextEasternTime(Date.parse('2026-01-06T00:00:00Z'), FIVE_AM), Date.parse('2026-01-06T10:00:00Z'));
});

test('the same day when it is still earlier', () => {
  // 3 AM EDT -> 5 AM EDT the same day
  assert.equal(nextEasternTime(Date.parse('2026-10-11T07:00:00Z'), FIVE_AM), Date.parse('2026-10-11T09:00:00Z'));
});

test('exactly at the time moves on to the next day', () => {
  assert.equal(nextEasternTime(Date.parse('2026-10-11T09:00:00Z'), FIVE_AM), Date.parse('2026-10-12T09:00:00Z'));
});

test('across a daylight saving change and a month end', () => {
  // 10 PM EDT Oct 31 -> 5 AM EST Nov 1 (DST ends at 2 AM)
  assert.equal(nextEasternTime(Date.parse('2026-11-01T02:00:00Z'), FIVE_AM), Date.parse('2026-11-01T10:00:00Z'));
  // 10 PM EST Mar 13 2027 -> 5 AM EDT Mar 14 (DST starts at 2 AM)
  assert.equal(nextEasternTime(Date.parse('2027-03-14T03:00:00Z'), FIVE_AM), Date.parse('2027-03-14T09:00:00Z'));
});

test('eastern day', () => {
  assert.equal(easternDay(Date.parse('2026-10-11T03:00:00Z')), '10/10/2026');
});

test('league ids from what was typed or pasted', async () => {
  const { parseLeagueInput } = await import('../src/utils/util.js');
  assert.equal(parseLeagueInput(' 12089 '), '12089');
  assert.equal(parseLeagueInput('https://www.fleaflicker.com/nhl/leagues/12089'), '12089');
  assert.equal(parseLeagueInput('www.fleaflicker.com/nhl/leagues/12089/players?position=C'), '12089');
  assert.equal(parseLeagueInput('https://www.fleaflicker.com/nhl/leagues/12089/teams/63133'), '12089');
  assert.equal(parseLeagueInput('abc'), null);
  assert.equal(parseLeagueInput(''), null);
  assert.equal(parseLeagueInput(undefined), null);
});
