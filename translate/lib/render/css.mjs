/**
 * The Reading Room stylesheet, written once to translations/assets/reader.css.
 * Set like a printed edition: one book face (self-hosted, with its real small
 * capitals), structure from space and italic, red passage numbers in the
 * margin, the ॥ mark between couplets. House rules, checked by the tests: no
 * sans-serif, no uppercase transforms, no shadows, no gradients, no rounded
 * boxes.
 */

import { themeCss } from '../design/tokens.mjs';

const FACES = String.raw`
@font-face { font-family: 'Illuminated Text'; src: url('fonts/IlluminatedText-Regular.woff2') format('woff2'); font-weight: 400; font-style: normal; font-display: swap; }
@font-face { font-family: 'Illuminated Text'; src: url('fonts/IlluminatedText-Italic.woff2') format('woff2'); font-weight: 400; font-style: italic; font-display: swap; }
@font-face { font-family: 'Illuminated Text'; src: url('fonts/IlluminatedText-Bold.woff2') format('woff2'); font-weight: 700; font-style: normal; font-display: swap; }
@font-face { font-family: 'Tiro Bangla'; src: url('fonts/TiroBangla-Bengali.woff2') format('woff2'); font-weight: 400; font-style: normal; font-display: swap;
  unicode-range: U+0951-0952, U+0964-0965, U+0980-09FE, U+1CD0-1CFF, U+200C-200D, U+20B9, U+25CC, U+A8F1; }
@font-face { font-family: 'Noto Serif Tibetan'; src: url('fonts/NotoSerifTibetan-Tibetan.woff2') format('woff2'); font-weight: 400; font-style: normal; font-display: swap; unicode-range: U+0F00-0FFF, U+25CC; }
`;

export const READER_CSS = FACES + themeCss({ ui: false }) + String.raw`
*, *::before, *::after { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body { margin: 0; background: var(--paper); color: var(--ink); font: 19px/1.6 var(--font-text); font-kerning: normal; font-variant-ligatures: common-ligatures; -webkit-font-smoothing: antialiased; }
a { color: inherit; text-decoration: underline; text-decoration-thickness: 1px; text-decoration-color: color-mix(in srgb, currentColor 35%, transparent); text-underline-offset: 3px; }
a:hover { color: var(--navy); text-decoration-color: currentColor; }
:focus-visible { outline: 2px solid var(--navy); outline-offset: 2px; }
:lang(bn) { font-family: var(--font-bengali); }
:lang(bo) { font-family: var(--font-tibetan); line-height: 1.9; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.skip { position: absolute; left: 12px; top: -48px; padding: 6px 10px; background: var(--paper); border: 1px solid var(--rule); z-index: 100; }
.skip:focus { top: 8px; }
@media (prefers-reduced-motion: reduce) { * { transition: none !important; scroll-behavior: auto !important; } }
.link { appearance: none; background: none; border: 0; padding: 0; margin: 0; font: inherit; color: inherit; cursor: pointer; text-decoration: underline; text-decoration-thickness: 1px;
  text-decoration-color: color-mix(in srgb, currentColor 35%, transparent); text-underline-offset: 3px; }
.link:hover { color: var(--navy); text-decoration-color: currentColor; }
.orn, .end, .tp__orn, .runhead__mark { font-family: var(--font-bengali), var(--font-text); }

/* ---------- running head ---------- */
.runhead { display: flex; align-items: baseline; gap: 28px; padding: 16px clamp(16px, 3vw, 32px) 13px; border-bottom: 1px solid var(--rule); font-size: 16.5px; color: var(--muted); }
.runhead a, .runhead .link { color: var(--muted); text-decoration: none; }
.runhead a:hover, .runhead .link:hover { color: var(--ink); text-decoration: underline; text-decoration-color: currentColor; }
.runhead__home { white-space: nowrap; }
.runhead__mark { color: var(--rubric); margin-right: 6px; }
.runhead__name { font-variant-caps: all-small-caps; letter-spacing: .07em; font-size: 18px; }
.runhead__text { font-style: italic; flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.runhead__tools { display: flex; gap: 24px; white-space: nowrap; }
.runhead__short { display: none; }
.only-narrow { display: none; }

/* ---------- reading layout ---------- */
.room { display: grid; grid-template-columns: 14rem minmax(0, 1fr); gap: 0 clamp(24px, 3.5vw, 56px); padding: 0 clamp(16px, 3vw, 32px) 72px; max-width: 1440px; }
.rail { position: sticky; top: 0; align-self: start; max-height: 100vh; overflow: auto; padding: 38px 4px 32px 0; font-size: 15.5px; line-height: 1.4; }
.rail__h { margin: 0 0 14px; font-style: italic; font-size: 17px; }
.rail__h a { text-decoration: none; }
.rail ol { list-style: none; margin: 0; padding: 0; }
.rail li { display: grid; grid-template-columns: 2.6rem minmax(0, 1fr); gap: 10px; padding: 3px 0; }
.rail .n { color: var(--rubric); text-align: right; white-space: nowrap; }
.rail li a { text-decoration: none; }
.rail li a:hover .t { text-decoration: underline; text-decoration-thickness: 1px; }
.rail li a[aria-current="page"] .t { font-style: italic; }
.rail .p { display: block; color: var(--muted); font-style: italic; font-size: 14px; }
.rail li.idle { color: var(--faint); font-style: italic; }
.rail li.idle .n { color: color-mix(in srgb, var(--rubric) 50%, transparent); font-style: normal; }
.rail__more { display: grid; gap: 3px; margin: 22px 0 0; padding-left: calc(2.6rem + 10px); }
.rail__more a { text-decoration: none; }
.rail__more a:hover { text-decoration: underline; }

.text { min-width: 0; padding-top: 46px; }
.head, .summary, .voice, .song-comment, .orn, .end, .colophon, .after, .pager { max-width: 38rem; margin-left: 4rem; }
.head { text-align: center; }
.head h1 { margin: 0; font-weight: 400; font-size: clamp(30px, 3.4vw, 40px); line-height: 1.15; text-wrap: balance; }
.head__sub { margin: 10px 0 0; font-size: 17px; color: var(--muted); }
.head__sub a.gl { color: var(--ink); }
.head__prov { margin: 2px 0 0; font-size: 15.5px; font-style: italic; color: var(--muted); }
.summary { margin-top: 32px; margin-bottom: 0; font-size: 17.5px; }
.song-comment { margin-top: 16px; font-size: 16.5px; }
.song-comment p { margin: 0; }
.passages { margin-top: 36px; }

.passage { display: grid; grid-template-columns: 4rem minmax(0, 38rem) minmax(12rem, 18rem); scroll-margin-top: 24px; }
.passage__no { grid-column: 1; padding-top: 3px; line-height: 1.3; }
.pno { font-size: 16px; color: var(--rubric); text-decoration: none; cursor: pointer; }
.pno:hover { color: var(--rubric); text-decoration: underline; }
.passage:target .pno { text-decoration: underline; text-decoration-thickness: 2px; }
.refrain { display: block; margin-top: 2px; font-style: italic; font-size: 13.5px; color: var(--muted); }
.passage__verse { grid-column: 2; min-width: 0; }
.ln { margin: 0; }
.en { margin: 0; padding-left: 1.3em; text-indent: -1.3em; font-size: 21px; line-height: 1.6; }
.src, .tl, .lit { display: none; margin: 0; }
.src { font-size: 19px; line-height: 1.6; }
.tl { font-style: italic; font-size: 16.5px; color: var(--muted); }
.lit { font-size: 14.5px; color: var(--muted); }
.heading { display: none; }
.heading .en { font-style: italic; color: var(--rubric); font-size: 18px; }
.lacuna { grid-column: 2; margin: 0; font-style: italic; color: var(--muted); }
.orn { margin-top: 14px; margin-bottom: 14px; text-align: center; color: color-mix(in srgb, var(--rubric) 70%, transparent); font-size: 15px; line-height: 1; }
.end { margin-top: 34px; margin-bottom: 0; text-align: center; color: var(--rubric); font-size: 17px; }
.colophon { margin-top: 8px; margin-bottom: 0; text-align: center; font-style: italic; font-size: 15.5px; line-height: 1.55; color: var(--muted); text-wrap: balance; }
.colophon.draft { color: var(--redo); }
.nref { font-size: 12px; line-height: 0; vertical-align: super; margin-left: 1px; }
.nref a { color: var(--rubric); text-decoration: none; }

/* the sung version (Display: As a song): the song sounded in English, its refrain cued, its rhyme heard */
.sung, .cue, .sungnote, .voice { display: none; }
html[data-display="sung"] .has-sung .en { display: none; }
html[data-display="sung"] .has-sung .heading { display: grid; }
html[data-display="sung"] .has-sung .heading .en { display: block; }
html[data-display="sung"] .sung { display: block; margin: 0; padding-left: 1.3em; text-indent: -1.3em; font-size: 21px; line-height: 1.6; }
html[data-display="sung"] .cue { display: block; margin: 1px 0 0; padding-left: 2.6em; font-style: italic; font-size: 17px; color: var(--muted); }
html[data-display="sung"] .sungnote { display: block; margin: 7px 0 4px 1.3em; font-size: 15.5px; line-height: 1.5; color: var(--muted); }
html[data-display="sung"] .voice { display: block; margin-top: 14px; margin-bottom: 0; font-size: 16.5px; }
.heard { margin: 0; font-style: italic; }
.heard .rh { font-style: normal; color: var(--rubric); }
.heard .sep { font-style: normal; color: var(--faint); }
.sungnote details { margin-top: 2px; }
.sungnote summary { display: inline; list-style: none; cursor: pointer; font-style: italic; color: var(--navy); }
.sungnote summary::-webkit-details-marker { display: none; }
.sungnote summary:hover { text-decoration: underline; }
.sungnote details p { margin: 3px 0 0; }

/* glossary terms: body colour, dotted navy underline */
a.gl { color: inherit; text-decoration: underline dotted; text-decoration-color: var(--navy); text-decoration-thickness: 1.5px; text-underline-offset: 4px; cursor: pointer; }
a.gl:hover, a.gl[aria-expanded="true"] { color: var(--navy); }

/* sidenotes: the commentator beside the couplet he reads */
.who { font-style: italic; }
.sidenote { grid-column: 3; padding: 5px 0 0 32px; font-size: 15.5px; line-height: 1.55; }
.sidenote + .sidenote { grid-column: 3; padding-top: 10px; }
.sidenote p { margin: 0; }
.sidenote details, .song-comment details { margin-top: 3px; }
.sidenote summary, .song-comment summary { display: inline; list-style: none; cursor: pointer; font-style: italic; font-size: 14.5px; color: var(--navy); }
.sidenote summary::-webkit-details-marker, .song-comment summary::-webkit-details-marker { display: none; }
.sidenote summary:hover, .song-comment summary:hover { text-decoration: underline; }
.full { margin-top: 6px; color: var(--muted); }
.full p { margin: 0 0 6px; }
.full .tl { display: block; font-size: 14.5px; }
html[data-comm="hidden"] .sidenote, html[data-comm="hidden"] .song-comment { display: none; }
html[data-comm="inline"] .passage { grid-template-columns: 4rem minmax(0, 38rem); }
html[data-comm="inline"] .sidenote { grid-column: 2; padding: 6px 0 4px 1.3em; font-size: 16px; }

/* the source beside the English, as a facing-page edition sets it */
html[data-display="bilingual"] .heading, html[data-display="study"] .heading { display: grid; }
html[data-display="bilingual"] .ln, html[data-display="study"] .ln { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr); column-gap: 36px; align-items: baseline; }
html[data-display="bilingual"] .en, html[data-display="study"] .en { grid-column: 2; grid-row: 1 / span 3; }
html[data-display="bilingual"] .src, html[data-display="study"] .src { display: block; grid-column: 1; grid-row: 1; }
html[data-display="study"] .tl { display: block; grid-column: 1; grid-row: 2; }
html[data-display="study"] .lit { display: block; grid-column: 1; grid-row: 3; }
html[data-display="study"] .ln { margin-bottom: 12px; }
.par { display: none; }
html[data-display="study"] .par { display: block; grid-column: 1; grid-row: 4; margin-top: 6px; }
.par__label { margin: 0; font-size: 14px; font-variant-caps: all-small-caps; letter-spacing: .06em; color: var(--muted); }
.par__src { margin: 0; font-size: 17px; line-height: 1.9; }
.par__tl { margin: 0; font-style: italic; font-size: 15px; color: var(--muted); }
html[data-display="bilingual"] .passage, html[data-display="study"] .passage { grid-template-columns: 4rem minmax(0, 60rem); }
html[data-display="bilingual"] .sidenote, html[data-display="study"] .sidenote { grid-column: 2; justify-self: end; width: calc(53.5% - 17px); padding: 6px 0 4px 1.3em; font-size: 16px; }

.after { margin-top: 40px; }
.after h2 { margin: 0 0 10px; text-align: center; font-weight: 400; font-size: 19px; font-variant-caps: all-small-caps; letter-spacing: .08em; color: var(--muted); }
.notes { margin: 0; padding-left: 1.6em; font-size: 16.5px; line-height: 1.6; }
.notes li { margin-bottom: 6px; }
.notes li::marker { color: var(--rubric); }
.notes .back { color: var(--muted); text-decoration: none; }
.terms { margin: 22px 0 0; font-size: 16.5px; color: var(--muted); }
.terms a { color: var(--ink); }
.pager { display: flex; justify-content: space-between; gap: 24px; margin-top: 44px; font-size: 16.5px; }
.pager a { text-decoration: none; }
.pager a:hover { text-decoration: underline; }
.pager .next { margin-left: auto; text-align: right; }

/* ---------- panel, preview, menus, dialogs ---------- */
.glpanel { position: fixed; z-index: 60; top: 0; right: 0; bottom: 0; width: min(25rem, 100vw); overflow: auto; padding: 22px 26px 40px; background: var(--raised); border-left: 1px solid var(--rule); }
.glpanel__close { float: right; color: var(--muted); }
.glpanel h2 { margin: 18px 0 0; font-size: 28px; font-weight: 700; line-height: 1.2; }
.glpanel__type { margin: 0 0 12px; font-style: italic; color: var(--muted); }
.glpanel__forms { margin: 0 0 10px; font-size: 16.5px; color: var(--muted); }
.glpanel__def { margin: 0 0 10px; }
.glpanel__sym { margin: 0 0 10px; font-style: italic; font-size: 17px; color: var(--muted); }
.glpanel__where { margin: 0 0 8px; font-size: 16px; color: var(--muted); }
.src-of { color: var(--muted); }
.preview { position: absolute; z-index: 55; width: min(20rem, calc(100vw - 32px)); padding: 10px 14px; background: var(--raised); border: 1px solid var(--rule); font-size: 15.5px; line-height: 1.5; pointer-events: none; }
.preview b { display: block; font-size: 17px; }
.preview i { color: var(--muted); }
.preview p { margin: 4px 0 0; }
.menu { position: absolute; z-index: 55; min-width: 15rem; padding: 6px 0; background: var(--raised); border: 1px solid var(--rule); font-size: 16px; }
.menu button { display: block; width: 100%; padding: 5px 14px; text-align: left; font: inherit; background: none; border: 0; color: var(--ink); cursor: pointer; }
.menu button:hover, .menu button:focus-visible { background: var(--navy-wash); outline: none; }
.menu .cite { margin: 6px 14px 4px; max-width: 24rem; font-size: 14.5px; line-height: 1.5; color: var(--muted); user-select: all; }
.dialog { position: fixed; inset: 0; z-index: 70; display: grid; place-items: start center; padding: 10vh 16px 16px; background: color-mix(in srgb, var(--paper) 72%, transparent); }
.dialog__card { width: min(36rem, 100%); max-height: 78vh; overflow: auto; padding: 22px 26px; background: var(--raised); border: 1px solid var(--rule); }
.dialog h2 { margin: 0 0 12px; font-size: 24px; font-weight: 400; }
.dialog__done { margin: 6px 0 0; text-align: right; }
.settings fieldset { border: 0; margin: 0 0 16px; padding: 0; }
.settings legend { margin-bottom: 4px; font-variant-caps: all-small-caps; letter-spacing: .08em; color: var(--muted); }
.settings label { display: flex; gap: 10px; align-items: baseline; padding: 3px 0; cursor: pointer; font-size: 17px; }
.settings input { accent-color: var(--rubric); }
.settings .hint { display: block; color: var(--muted); font-size: 15px; font-style: italic; }
.search__q { width: 100%; padding: 6px 0; font: inherit; font-size: 20px; border: 0; border-bottom: 1px solid var(--muted); border-radius: 0; background: transparent; color: var(--ink); }
.search__q:focus { outline: none; border-bottom: 2px solid var(--navy); }
.search__res { list-style: none; margin: 14px 0 0; padding: 0; }
.search__res a { display: block; padding: 7px 0; text-decoration: none; }
.search__res a:hover .t, .search__res a:focus-visible .t { text-decoration: underline; }
.search__res .k { display: block; color: var(--muted); font-style: italic; font-size: 15px; }
.search__res mark { background: var(--warn-wash); color: inherit; }
.search__none { color: var(--muted); font-style: italic; }

/* ---------- title page ---------- */
.titlepage { max-width: 44rem; margin: 0 auto; padding: 60px clamp(16px, 4vw, 32px) 80px; }
.tp { text-align: center; }
.tp__orn { margin: 0; text-align: center; color: var(--rubric); font-size: 26px; line-height: 1; }
.tp__orig { margin: 22px 0 0; font-size: 48px; line-height: 1.3; }
.tp h1 { margin: 2px 0 0; font-weight: 400; font-size: clamp(32px, 5vw, 46px); line-height: 1.15; text-wrap: balance; }
.tp__alt { margin: 10px 0 0; font-style: italic; color: var(--muted); font-size: 18px; }
.tp__desc { margin: 28px auto 0; max-width: 30rem; font-size: 19px; text-wrap: balance; }
.tp__wit { margin: 8px auto 0; max-width: 32rem; font-size: 16px; color: var(--muted); text-wrap: balance; }
.tp__imprint { margin: 44px 0 0; font-variant-caps: all-small-caps; letter-spacing: .07em; font-size: 20px; }
.tp__state { margin: 4px auto 0; max-width: 32rem; font-size: 15.5px; font-style: italic; color: var(--muted); text-wrap: balance; }
.tp__toc { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px 28px; margin: 36px 0 0; font-style: italic; font-size: 18px; }
.tp__toc a { text-decoration: none; }
.tp__toc a:hover { text-decoration: underline; }
.section-h { margin: 68px 0 20px; text-align: center; font-weight: 400; font-size: 20px; font-variant-caps: all-small-caps; letter-spacing: .09em; color: var(--muted); }
.howto { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 15rem); gap: 20px 40px; align-items: start; }
.howto .passage { grid-template-columns: 3.2rem minmax(0, 1fr); }
.howto .sidenote { grid-column: 2; padding: 10px 0 0 1.3em; }
.howto ol { margin: 0; padding-left: 1.4em; font-size: 16px; line-height: 1.55; }
.howto li { margin-bottom: 10px; }
.howto li::marker { color: var(--rubric); }
.key { color: var(--rubric); font-style: italic; font-size: 13px; line-height: 0; vertical-align: super; margin: 0 2px; }
.contents { list-style: none; margin: 0; padding: 0; font-size: 18px; }
.contents li { display: grid; grid-template-columns: 3.4rem minmax(0, 1fr) auto; gap: 16px; padding: 4px 0; align-items: baseline; }
.contents .n { color: var(--rubric); text-align: right; white-space: nowrap; }
.contents a { text-decoration: none; }
.contents a:hover { text-decoration: underline; }
.contents .p { font-style: italic; color: var(--muted); font-size: 16.5px; }
.contents li.idle { color: var(--faint); font-style: italic; font-size: 16.5px; }
.contents li.idle .n { font-style: normal; color: color-mix(in srgb, var(--rubric) 50%, transparent); }

/* ---------- glossary and prose pages ---------- */
.prose { max-width: 40rem; margin: 0 auto; padding: 56px clamp(16px, 4vw, 32px) 80px; }
.prose h1 { margin: 12px 0 16px; font-weight: 400; font-size: clamp(32px, 4vw, 42px); line-height: 1.15; text-align: center; }
.prose h2 { margin: 46px 0 10px; font-weight: 400; font-size: 20px; font-variant-caps: all-small-caps; letter-spacing: .09em; color: var(--muted); text-align: center; }
.prose p, .prose li, .prose dd { font-size: 18.5px; }
.prose .lede { font-size: 19px; }
.prose dl { display: grid; grid-template-columns: 4.5rem 1fr; gap: 10px 18px; }
.prose dt { text-align: right; color: var(--rubric); }
.prose dt .glx { color: var(--ink); text-decoration: underline dotted var(--navy) 1.5px; text-underline-offset: 4px; }
.prose dt i { color: var(--ink); }
.prose dd { margin: 0; }
.prose dt .pno { cursor: default; }
.sources { padding-left: 1.2em; }
.sources li { margin-bottom: 8px; }
.gtools { display: flex; flex-wrap: wrap; align-items: baseline; gap: 10px 26px; margin: 30px 0 6px; }
.gtools input { flex: 1 1 14rem; padding: 4px 0; font: inherit; font-size: 18px; border: 0; border-bottom: 1px solid var(--muted); border-radius: 0; background: transparent; color: var(--ink); }
.gtools input:focus { outline: none; border-bottom: 2px solid var(--navy); }
.gtypes { display: flex; gap: 18px; }
.seg { appearance: none; background: none; border: 0; padding: 0; font: inherit; font-size: 17px; color: var(--muted); cursor: pointer; }
.seg:hover { color: var(--ink); }
.seg[aria-pressed="true"] { color: var(--ink); text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 4px; }
.alpha { display: flex; flex-wrap: wrap; justify-content: center; gap: 2px 16px; margin: 22px 0 6px; font-size: 18px; }
.alpha a { text-decoration: none; }
.alpha a:hover { text-decoration: underline; }
.prose .letter { margin: 40px 0 4px; font-size: 30px; font-variant-caps: normal; letter-spacing: 0; color: var(--rubric); }
.gentry { padding: 10px 0; scroll-margin-top: 24px; }
.gentry[hidden], .letter[hidden] { display: none; }
.ghead { display: flex; flex-wrap: wrap; gap: 0 10px; align-items: baseline; }
.gentry h3 { margin: 0; font-size: 21px; font-weight: 700; line-height: 1.3; }
.gentry:target h3 { text-decoration: underline; text-decoration-color: var(--rubric); text-underline-offset: 5px; }
.gentry .ty { color: var(--muted); font-size: 17px; }
.gentry p { margin: 3px 0; font-size: 17.5px; }
.gentry .forms, .gentry .where { color: var(--muted); font-size: 16.5px; }
.gentry .sym { font-style: italic; }
.shelf { list-style: none; margin: 40px 0 0; padding: 0; }
.shelf li { padding: 14px 0 20px; text-align: center; }
.shelf__orig { margin: 0; font-size: 26px; line-height: 1.3; }
.shelf .shelf__title { margin: 0; font-size: 28px; line-height: 1.25; }
.shelf__title a { text-decoration: none; }
.shelf__title a:hover { text-decoration: underline; }
.shelf .shelf__desc { margin: 6px auto 0; max-width: 30rem; }
.shelf .shelf__meta { margin: 6px 0 0; font-size: 15.5px; font-style: italic; color: var(--muted); }

/* ---------- footer ---------- */
.foot { max-width: 1440px; margin-top: 24px; padding: 24px clamp(16px, 3vw, 32px) 48px; border-top: 1px solid var(--rule); font-size: 14.5px; line-height: 1.6; color: var(--muted); }
.foot p { max-width: 46rem; margin: 0 0 8px; }
.foot__links { display: flex; flex-wrap: wrap; gap: 4px 22px; }

/* ---------- responsive ---------- */
@media (max-width: 1180px) {
  .passage { grid-template-columns: 3.2rem minmax(0, 38rem); }
  .sidenote, .sidenote + .sidenote { grid-column: 2; padding: 6px 0 4px 1.3em; font-size: 16px; }
  .head, .summary, .voice, .song-comment, .orn, .end, .colophon, .after, .pager { margin-left: 3.2rem; }
  html[data-display="bilingual"] .passage, html[data-display="study"] .passage { grid-template-columns: 3.2rem minmax(0, 1fr); }
}
@media (max-width: 900px) {
  .room { grid-template-columns: minmax(0, 1fr); }
  .rail { position: fixed; z-index: 50; top: 0; left: 0; bottom: 0; align-self: stretch; height: 100vh; height: 100dvh; max-height: none; width: min(20rem, 86vw); padding: 26px 18px;
    background: var(--paper); border-right: 1px solid var(--rule); transform: translateX(-105%); visibility: hidden; transition: transform .18s ease, visibility 0s linear .18s; }
  html[data-rail="open"] .rail { transform: none; visibility: visible; transition: transform .18s ease; }
  .only-narrow { display: inline; }
  .runhead__label { display: none; }
  .runhead__short { display: inline; }
}
@media (max-width: 760px) {
  html[data-display="bilingual"] .ln, html[data-display="study"] .ln { display: block; }
  html[data-display="bilingual"] .sidenote, html[data-display="study"] .sidenote { width: auto; justify-self: stretch; }
}
@media (max-width: 640px) {
  body { font-size: 18px; }
  .runhead { gap: 18px; }
  .runhead__name, .runhead__text { display: none; }
  .runhead__home { margin-right: auto; }
  .passage, html[data-comm="inline"] .passage { grid-template-columns: 2.6rem minmax(0, 1fr); }
  .head, .summary, .voice, .song-comment, .orn, .end, .colophon, .after, .pager { margin-left: 0; }
  .orn { padding-left: 2.6rem; }
  .en { font-size: 19.5px; }
  .howto { grid-template-columns: minmax(0, 1fr); }
  .tp__orig { font-size: 38px; }
  .contents li { grid-template-columns: 2.8rem minmax(0, 1fr); }
  .contents .p { grid-column: 2; margin-top: -6px; }
}

/* ---------- print: everything inline, no chrome ---------- */
@media print {
  body { background: #fff; color: #000; font-size: 11.5pt; }
  .runhead, .rail, .pager, .glpanel, .preview, .menu, .dialog, .only-narrow, .skip, .gtools, .alpha, .tp__toc { display: none !important; }
  .room { display: block; padding: 0; }
  .passage { grid-template-columns: 2.5rem minmax(0, 1fr); break-inside: avoid; }
  .sidenote { display: block !important; grid-column: 2; padding-left: 1.3em; }
  .heading { display: grid !important; }
  .src, .tl { display: block !important; }
  a.gl { text-decoration: none; }
  .sidenote details > * { display: block; }
}
`;
