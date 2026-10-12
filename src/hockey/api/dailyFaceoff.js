import axios from 'axios';
import { STARTING_GOALIES_BASE } from '../constants';

// A day's starting goalies (YYYY-MM-DD), parsed from Daily Faceoff's page by the proxy:
// { date, games: [{ start, away, home }], complete }
export const getStartingGoalies = async (date) => {
  const response = await axios.get(`${STARTING_GOALIES_BASE}/${date}`);
  return response.data;
};
