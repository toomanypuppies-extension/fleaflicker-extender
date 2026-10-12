/**
 * Chart series colors from the favorite team's colors.
 *
 * Team colors aren't made for charts: some are near black or white, some sit too close to the
 * panel's background, and some teams' two colors are hard to tell apart with color blindness.
 * Each team color keeps its hue, with its lightness moved into the band charts need for the theme
 * and its chroma raised so it doesn't read as gray. If the two still aren't distinct enough, the
 * second steps through lightness until they are. Colors without a usable hue (black, white,
 * silver) and pairs that can't be separated fall back to the dataviz reference palette's blue
 * and orange. The checks are the dataviz skill's: OKLCH lightness band and chroma floor,
 * OKLab Delta E x100 >= 8 under protanopia and deuteranopia (Machado 2009) and >= 15 unsimulated.
 */

// The panel's background in each theme, see themeBaseColor in the store
export const CHART_SURFACES = { light: '#e2e2e2', dark: '#333333' };

// The reference palette's slots 1 and 2, checked against both surfaces
export const FALLBACK_COLORS = {
  light: ['#2a78d6', '#eb6834'],
  dark: ['#3987e5', '#d95926'],
};

const BAND = { light: [0.43, 0.77], dark: [0.48, 0.67] };
// Adjusted colors aim this far inside the band, so rounding to hex can't put them outside it
const BAND_MARGIN = 0.01;
const CHROMA_FLOOR = 0.10;
// Below this a color has no hue worth keeping
const HUELESS_CHROMA = 0.03;
const CVD_TARGET = 8;
const NORMAL_FLOOR = 15;
const CONTRAST_MIN = 3;

const MACHADO = {
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
};

const hexToSrgb = (hex) => [0, 2, 4].map(i => parseInt(hex.replace('#', '').slice(i, i + 2), 16) / 255);
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const linear = (hex) => hexToSrgb(hex).map(toLinear);

const linearToOklab = ([r, g, b]) => {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  ];
};

const oklabToLinear = ([L, a, b]) => {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ];
};

export const oklch = (hex) => {
  const [L, a, b] = linearToOklab(linear(hex));
  return { L, C: Math.hypot(a, b), h: Math.atan2(b, a) };
};

const inGamut = (rgb) => rgb.every(c => c >= -0.0001 && c <= 1.0001);

// The closest displayable color, giving up chroma rather than lightness or hue
const fromOklch = ({ L, C, h }) => {
  let chroma = C;
  let rgb = oklabToLinear([L, chroma * Math.cos(h), chroma * Math.sin(h)]);
  while (!inGamut(rgb) && chroma > 0) {
    chroma = Math.max(chroma - 0.005, 0);
    rgb = oklabToLinear([L, chroma * Math.cos(h), chroma * Math.sin(h)]);
  }
  const hex = rgb.map(c => Math.round(Math.min(Math.max(toSrgb(Math.min(Math.max(c, 0), 1)), 0), 1) * 255));
  return `#${hex.map(c => c.toString(16).padStart(2, '0')).join('')}`;
};

const luminance = (hex) => {
  const [r, g, b] = linear(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const contrast = (a, b) => {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
};

const simulate = (hex, kind) => {
  const [r, g, b] = linear(hex);
  return MACHADO[kind].map(row => Math.min(Math.max(row[0] * r + row[1] * g + row[2] * b, 0), 1));
};
export const deltaE = (a, b, kind) => {
  const [x, y] = [a, b].map(hex => linearToOklab(kind ? simulate(hex, kind) : linear(hex)));
  return 100 * Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
};

/**
 * Whether two series colors pass the dataviz checks for the theme. Contrast with the surface is
 * aimed for but not required: like the reference orange on the light theme, a color under 3:1 is
 * allowed because every chart labels its values and has a table view.
 */
export const passes = ([first, second], mode) => {
  const [low, high] = BAND[mode];
  const color = (hex) => {
    const { L, C } = oklch(hex);
    return L >= low && L <= high && C >= CHROMA_FLOOR;
  };
  return color(first) && color(second)
    && Math.min(deltaE(first, second, 'protan'), deltaE(first, second, 'deutan')) >= CVD_TARGET
    && deltaE(first, second) >= NORMAL_FLOOR;
};

// A team color moved into the theme's band, or null if it has no hue to keep
const adapt = (hex, mode, L = null) => {
  const color = oklch(hex);
  if (color.C < HUELESS_CHROMA) {
    return null;
  }
  const [low, high] = BAND[mode].map((edge, index) => edge + (index ? -BAND_MARGIN : BAND_MARGIN));
  const surface = CHART_SURFACES[mode];
  const lightness = Math.min(Math.max(L ?? color.L, low), high);
  // Away from the surface (lighter on dark, darker on light) until it has 3:1 contrast, or as close
  // as the band allows
  const step = mode === 'dark' ? 0.01 : -0.01;
  let closest = null;
  for (let target = lightness; target >= low - 1e-9 && target <= high + 1e-9; target += step) {
    const candidate = fromOklch({ L: target, C: Math.max(color.C, CHROMA_FLOOR + 0.01), h: color.h });
    const { L: candidateL, C: candidateC } = oklch(candidate);
    if (candidateC < CHROMA_FLOOR || candidateL < BAND[mode][0] || candidateL > BAND[mode][1]) continue;
    if (contrast(candidate, surface) >= CONTRAST_MIN) {
      return candidate;
    }
    if (!closest || contrast(candidate, surface) > contrast(closest, surface)) {
      closest = candidate;
    }
  }
  return closest;
};

// Lightness steps across the band, nearest to `from` first
const lightnessSteps = (from, [low, high]) => {
  const steps = [];
  for (let L = low; L <= high + 1e-9; L += 0.02) steps.push(L);
  return steps.sort((a, b) => Math.abs(a - from) - Math.abs(b - from));
};

/**
 * The two series colors for charts in a theme ('light' or 'dark'), from a team's primary and
 * secondary colors. Always passes the checks.
 */
export const teamSeriesColors = (team, mode) => {
  const fallback = FALLBACK_COLORS[mode];
  const first = (team?.primary && adapt(team.primary, mode))
    || (team?.secondary && adapt(team.secondary, mode))
    || fallback[0];
  // The second team color if it has a hue and isn't the one already used
  const secondSource = [team?.secondary, team?.primary].find(hex => hex && adapt(hex, mode) && adapt(hex, mode) !== first);

  if (secondSource) {
    const start = adapt(secondSource, mode);
    if (passes([first, start], mode)) {
      return [first, start];
    }
    for (const L of lightnessSteps(oklch(start).L, BAND[mode])) {
      const candidate = adapt(secondSource, mode, L);
      if (candidate && passes([first, candidate], mode)) {
        return [first, candidate];
      }
    }
  }
  // The team's other color can't be told apart from its first: whichever reference color can
  const other = fallback.find(hex => passes([first, hex], mode));
  return other ? [first, other] : fallback;
};
