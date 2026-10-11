// Fails if the extension's built CSS has a selector that could style fleaflicker's own page.
//
// The extension's CSS is added to every fleaflicker league page, so every rule has to be limited to
// our elements: Vue scoped styles, vuestic's .va-* classes, or rules inside .mainContent or
// .fleaflicker-extender-drawer (see the comment in Main.vue).
//
// Usage: node scripts/check-extension-css.mjs [path to main.css]
// Runs after the extension builds, see package.json.

import { readFileSync } from 'node:fs';

const file = process.argv[2] || 'dist/extension/main.css';

const ALLOWED_SELECTORS = [
  // Vue scoped styles
  /\[data-v-[a-z0-9]+\]/,
  // Vuestic's own classes and variables
  /^(html )?\.va-/,
  /^(html)?:root$/,
  /^:host$/,
  // Our roots
  /^\.(mainContent|fleaflicker-extender-drawer)\b/,
  // Only added while a vuestic modal is open, and our modals pass allow-body-scroll so it never is
  /^body\.va-modal-open$/,
];

// What a :where(...) at the start of a selector can list
const ALLOWED_WHERE = /^\.(mainContent|fleaflicker-extender-drawer|va-[\w-]+)$/;

// Font families we define, none of which fleaflicker uses
const ALLOWED_FONTS = ['Source Sans Pro', 'Material Icons'];

// Splits "a, :where(b, c) d" into ["a", ":where(b, c) d"]
const splitSelectorList = (list) => {
  const selectors = [];
  let depth = 0;
  let current = '';
  for (const char of list) {
    if (char === '(') depth++;
    if (char === ')') depth--;
    if (char === ',' && depth === 0) {
      selectors.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  selectors.push(current.trim());
  return selectors.filter(Boolean);
};

const isAllowed = (selector) => {
  const where = selector.match(/^:where\(([^)]*)\)/);
  if (where) {
    return where[1].split(',').every(part => ALLOWED_WHERE.test(part.trim()));
  }
  return ALLOWED_SELECTORS.some(pattern => pattern.test(selector));
};

const css = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const problems = [];

for (const [, family] of css.matchAll(/@font-face\s*\{[^}]*?font-family:\s*["']?([^;"']+)["']?/g)) {
  if (!ALLOWED_FONTS.includes(family.trim())) {
    problems.push(`@font-face ${family.trim()}`);
  }
}

// Rule selectors, outside @font-face and @keyframes blocks. @media and @supports blocks are looked inside of.
const rules = css
  .replace(/@font-face\s*\{[^}]*\}/g, '')
  .replace(/@(-webkit-)?keyframes[^{]*\{(?:[^{}]*\{[^}]*\})*\s*\}/g, '')
  .replace(/@(media|supports)[^{]*\{/g, '');

const selectors = new Set();
for (const [, selectorList] of rules.matchAll(/([^{}]+)\{[^{}]*\}/g)) {
  splitSelectorList(selectorList).forEach(selector => selectors.add(selector));
}

for (const selector of selectors) {
  if (!isAllowed(selector)) {
    problems.push(selector);
  }
}

if (problems.length) {
  console.error(`${file} has CSS that could restyle fleaflicker's page:\n  ${problems.join('\n  ')}`);
  console.error('Scope it to the component (<style scoped>) or put it inside .mainContent.');
  process.exit(1);
}
console.log(`${file}: all ${selectors.size} selectors are limited to the extension`);
