/**
 * Design tokens for the Reading Room direction, shared by the Studio and the
 * published translation pages. Inspired by the restraint of 84000's Reading
 * Room (soft graphite text, navy term links, brick margin numbers), in our own
 * palette: cool paper, never cream; rubrication is the one bold move.
 */

export const COLORS = {
  //        light      dark
  paper:   ['#FBFBF9', '#15191C'],   // page ground
  surface: ['#F2F4F3', '#1D2226'],   // rails, panels
  raised:  ['#FFFFFF', '#232A2F'],   // editors, popovers
  ink:     ['#2E3336', '#D9DEE1'],   // text
  muted:   ['#6F777C', '#8E979C'],   // secondary text
  faint:   ['#9AA2A7', '#6C757A'],   // tertiary, placeholders
  rule:    ['#D9DDDF', '#2E353A'],   // hairlines
  navy:    ['#1F4E6B', '#8DB8D6'],   // links, glossary underline, focus
  navyWash:['#E6EEF3', '#1E3140'],   // selected rows, term highlight
  rubric:  ['#B4452F', '#E0806A'],   // passage numbers, note markers, rāga line
  ok:      ['#3F6B4A', '#8CC09A'],   // approved
  okWash:  ['#E8F0EA', '#1C2B21'],
  warn:    ['#8A6A1F', '#D7B865'],   // flags, needs attention
  warnWash:['#F6F0E1', '#2E2816'],
  redo:    ['#9B3B2B', '#E39A89'],   // redraft requested
  redoWash:['#F7E9E6', '#33201C'],
};

export const FONTS = {
  // 'Illuminated Text' is our self-hosted subset of Gentium Book Plus (see translate/assets/fonts/).
  text: "'Illuminated Text', 'Gentium Book Plus', 'Gentium Plus', 'Charis SIL', 'Noto Serif', Georgia, serif",
  bengali: "'Tiro Bangla', 'Noto Serif Bengali', 'Kohinoor Bangla', serif",
  // Self-hosted on the published pages (a Tibetan-block subset); from Google Fonts in the Studio.
  tibetan: "'Noto Serif Tibetan', 'Jomolhari', 'Kailasa', 'Microsoft Himalaya', serif",
  ui: "'Source Sans 3', 'Source Sans Pro', 'Segoe UI', system-ui, sans-serif",
  mono: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
};

export const FONT_URL = 'https://fonts.googleapis.com/css2?'
  + 'family=Gentium+Book+Plus:ital,wght@0,400;0,700;1,400;1,700'
  + '&family=Source+Sans+3:ital,wght@0,400;0,600;0,700;1,400'
  + '&family=Tiro+Bangla:ital@0;1'
  + '&family=Noto+Serif+Tibetan:wght@400'
  + '&display=swap';

const block = i => Object.entries(COLORS).map(([k, v]) => `  --${k.replace(/[A-Z]/g, c => '-' + c.toLowerCase())}: ${v[i]};`).join('\n');

/**
 * Theme CSS: the light palette on :root; dark under prefers-color-scheme
 * unless the page says light; dark again under [data-theme="dark"] so an
 * explicit choice wins in both directions. The reading pages pass ui: false:
 * they are set in the book face alone.
 */
export function themeCss({ ui = true } = {}) {
  return `:root {
${block(0)}
  --font-text: ${FONTS.text};
  --font-bengali: ${FONTS.bengali};
  --font-tibetan: ${FONTS.tibetan};
${ui ? `  --font-ui: ${FONTS.ui};\n` : ''}  --font-mono: ${FONTS.mono};
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
${block(1).replace(/^/gm, '  ')}
    color-scheme: dark;
  }
}
:root[data-theme="dark"] {
${block(1)}
  color-scheme: dark;
}
`;
}
