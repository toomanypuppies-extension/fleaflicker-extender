// Categorical slots 1 and 2 (blue, orange) of the dataviz reference palette, stepped for each theme
// and checked with its palette validator against the app's #e2e2e2 and #333333 surfaces.
// In light mode the orange is under 3:1, so charts always label values and offer a table view.
const SERIES_COLORS = {
  light: ['#2a78d6', '#eb6834'],
  dark: ['#3987e5', '#d95926'],
};

export const seriesColor = (index, darkMode) => SERIES_COLORS[darkMode ? 'dark' : 'light'][index];
