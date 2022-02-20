export const getLeagueId = () => {
  const url = location.href;
  const matches = url.match(/leagues\/\d{1,6}/);
  return matches[0].split("/")[1];
};