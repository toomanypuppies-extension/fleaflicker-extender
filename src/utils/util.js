export const getLeagueId = () => {
  const url = location.href;
  const matches = url.match(/leagues\/\d{1,6}/);
  return matches[0].split("/")[1];
};

export const convertEpochToTimeString = (epoch) => {
  return new Date(parseInt(epoch, 10)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}