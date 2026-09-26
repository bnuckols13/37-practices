/**
 * The Reading Room stylesheet, shared by every published translation page
 * (written once to translations/assets/reader.css). Built on the design
 * tokens; the one bold move is rubrication: passage numbers in brick in the
 * margin, as a manuscript marks its sections in red.
 */

import { themeCss } from '../design/tokens.mjs';

export const READER_CSS = themeCss() + String.raw`
*, *::before, *::after { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body { margin: 0; background: var(--paper); color: var(--ink); font: 19px/1.6 var(--font-text); font-variant-numeric: oldstyle-nums; -webkit-font-smoothing: antialiased; }
a { color: var(--navy); text-decoration-thickness: 1px; text-underline-offset: 3px; }
:focus-visible { outline: 2px solid var(--navy); outline-offset: 2px; }
:lang(bn) { font-family: var(--font-bengali); font-variant-numeric: normal; }
:lang(bo) { font-family: var(--font-tibetan); line-height: 1.9; font-variant-numeric: normal; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.skip { position: absolute; left: 12px; top: -40px; padding: 6px 10px; background: var(--raised); border: 1px solid var(--rule); font: 600 14px var(--font-ui); z-index: 100; }
.skip:focus { top: 8px; }
@media (prefers-reduced-motion: reduce) { * { transition: none !important; scroll-behavior: auto !important; } }
.ui { font-family: var(--font-ui); font-variant-numeric: lining-nums; }
.smallcaps { font: 700 11.5px/1.4 var(--font-ui); letter-spacing: .14em; text-transform: uppercase; }

/* ---------- top bar ---------- */
.bar { position: sticky; top: 0; z-index: 40; display: flex; align-items: center; gap: 16px; padding: 10px clamp(16px, 3vw, 32px);
  background: color-mix(in srgb, var(--paper) 92%, transparent); backdrop-filter: saturate(1.2) blur(6px); border-bottom: 1px solid var(--rule); }
.bar__home { display: flex; align-items: baseline; gap: 8px; text-decoration: none; color: var(--ink); white-space: nowrap; }
.bar__mark { font: 700 20px/1 var(--font-text); color: var(--rubric); letter-spacing: -1px; }
.bar__name { font: 700 11.5px/1 var(--font-ui); letter-spacing: .16em; text-transform: uppercase; }
.bar__text { font-style: italic; color: var(--ink); text-decoration: none; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1 1 auto; font-size: 17px; }
.bar__text:hover { text-decoration: underline; }
.bar__tools { display: flex; gap: 6px; align-items: center; }
.bar__short { display: none; }
.btn { display: inline-flex; align-items: center; gap: 6px; padding: 5px 11px; font: 600 13px/1.3 var(--font-ui); color: var(--ink); background: var(--raised);
  border: 1px solid var(--rule); border-radius: 3px; cursor: pointer; white-space: nowrap; text-decoration: none; }
.btn:hover { border-color: var(--muted); }
.btn--quiet { background: transparent; border-color: transparent; color: var(--muted); }
.btn--quiet:hover { color: var(--ink); border-color: var(--rule); }
.btn kbd { font: 600 11px var(--font-ui); color: var(--faint); border: 1px solid var(--rule); border-radius: 3px; padding: 0 4px; }
.crumbs { padding: 10px clamp(16px, 3vw, 32px) 0; font: 13px/1.4 var(--font-ui); color: var(--muted); }
.crumbs a { color: var(--muted); text-decoration: none; } .crumbs a:hover { color: var(--navy); text-decoration: underline; }
.crumbs .sep { margin: 0 7px; color: var(--faint); }

/* ---------- reading layout ---------- */
.room { display: grid; grid-template-columns: 15rem minmax(0, 1fr); gap: 0 clamp(24px, 3vw, 48px); padding: 0 clamp(16px, 3vw, 32px) 80px; max-width: 1440px; }
.rail { position: sticky; top: 64px; align-self: start; max-height: calc(100vh - 80px); overflow: auto; padding: 24px 4px 24px 0; font-family: var(--font-ui); }
.rail__h { margin: 0 0 8px; color: var(--muted); }
.rail ol { list-style: none; margin: 0; padding: 0; }
.rail .ri { display: grid; grid-template-columns: 1.9rem minmax(0, 1fr); gap: 6px; padding: 4px 6px; border-radius: 3px; text-decoration: none; font-size: 14px; line-height: 1.35; color: var(--ink); }
a.ri:hover { background: var(--navy-wash); }
a.ri[aria-current="page"] { background: var(--navy-wash); font-weight: 600; }
.rail .n { color: var(--rubric); font-weight: 700; text-align: right; font-variant-numeric: tabular-nums; }
.ri--idle { color: var(--faint); }
.ri--idle .n { color: color-mix(in srgb, var(--rubric) 45%, transparent); }
.rail .p { display: block; color: var(--muted); font-size: 12.5px; font-weight: 400; }
.rail__more { margin-top: 18px; padding-top: 12px; border-top: 1px solid var(--rule); display: grid; gap: 2px; }
.rail__more a { padding: 4px 6px; font-size: 14px; color: var(--ink); text-decoration: none; border-radius: 3px; }
.rail__more a:hover { background: var(--navy-wash); }

.text { min-width: 0; padding-top: 28px; }
.head { max-width: 40rem; margin-left: 4.5rem; }
.head__eyebrow { margin: 0 0 6px; color: var(--rubric); }
.head h1 { margin: 0 0 10px; font-weight: 400; font-size: clamp(30px, 3.4vw, 40px); line-height: 1.15; text-wrap: balance; }
.head__meta { margin: 0; font: 14.5px/1.55 var(--font-ui); color: var(--muted); }
.head__meta .dot { margin: 0 6px; color: var(--faint); }
.head__meta a { color: var(--ink); }
.prov { margin: 14px 0 0; font: 13.5px/1.5 var(--font-ui); color: var(--muted); }
.prov.draft { color: var(--redo); font-weight: 600; }
.summary { max-width: 40rem; margin: 22px 0 8px 4.5rem; font-size: 18px; color: var(--ink); }

.passages { margin-top: 26px; border-top: 1px solid var(--rule); }
.passage { display: grid; grid-template-columns: 4.5rem minmax(0, 40rem) minmax(13rem, 19rem); column-gap: 0; padding: 16px 0 14px; border-bottom: 1px solid var(--rule); scroll-margin-top: 80px; }
.passage:target, .gentry:target { background: var(--warn-wash); box-shadow: -12px 0 0 var(--warn-wash); }
.passage__no { grid-column: 1; padding-top: 5px; }
.pno { font: 700 13px/1.4 var(--font-ui); color: var(--rubric); text-decoration: none; background: none; border: 0; padding: 0; cursor: pointer; font-variant-numeric: tabular-nums; }
.pno:hover { text-decoration: underline; }
.passage__verse { grid-column: 2; min-width: 0; }
.tag { margin: 0 0 4px; font: 600 11px/1.3 var(--font-ui); letter-spacing: .1em; text-transform: uppercase; color: var(--faint); }
.ln { margin: 0 0 3px; }
.en { margin: 0; font-size: 21px; line-height: 1.55; }
.src, .tl, .lit { display: none; margin: 1px 0 0; }
.src { font-size: 18px; line-height: 1.55; color: var(--ink); }
.tl { font-style: italic; font-size: 16px; color: var(--muted); }
.lit { font: 12.5px/1.5 var(--font-ui); color: var(--faint); letter-spacing: .01em; }
html[data-display="bilingual"] .src, html[data-display="study"] .src, html[data-display="study"] .tl, html[data-display="study"] .lit { display: block; }
html[data-display="study"] .ln { margin-bottom: 10px; }
.heading { padding: 12px 0 10px; }
.heading .en { font: 700 12px/1.5 var(--font-ui); letter-spacing: .14em; text-transform: uppercase; color: var(--rubric); }
.lacuna { grid-column: 2; font: 14px/1.5 var(--font-ui); color: var(--faint); }
.nref { font: 700 11px var(--font-ui); vertical-align: super; line-height: 0; margin-left: 1px; }
.nref a { color: var(--rubric); text-decoration: none; }

/* glossary terms: body colour, dotted navy underline */
a.gl { color: inherit; text-decoration: none; border-bottom: 1.5px dotted var(--navy); cursor: pointer; }
a.gl:hover, a.gl[aria-expanded="true"] { background: var(--navy-wash); }
html[data-focus="on"] a.gl { border-bottom-color: transparent; }

/* sidenotes: Munidatta beside the passage he reads */
.sidenote { grid-column: 3; padding: 4px 0 0 28px; font-size: 15.5px; line-height: 1.55; color: var(--ink); }
.sidenote + .sidenote { grid-column: 3; padding-top: 10px; }
.sidenote__who { margin: 0 0 2px; color: var(--rubric); }
.sidenote p { margin: 0; }
.sidenote details { margin-top: 6px; }
.sidenote summary { font: 600 12.5px var(--font-ui); color: var(--navy); cursor: pointer; }
.sidenote .full { margin-top: 6px; color: var(--muted); }
.sidenote .full .tl { display: block; font-size: 14px; }
html[data-comm="hidden"] .sidenote { display: none; }
html[data-comm="inline"] .passage { grid-template-columns: 4.5rem minmax(0, 40rem); }
html[data-comm="inline"] .sidenote { grid-column: 2; padding: 10px 0 0 14px; border-left: 2px solid var(--rule); margin-top: 8px; }
.song-comment { max-width: 40rem; margin: 16px 0 0 4.5rem; padding: 10px 0 0 14px; border-left: 2px solid var(--rule); font-size: 16px; }
html[data-comm="hidden"] .song-comment { display: none; }

.after { max-width: 40rem; margin-left: 4.5rem; }
.after h2 { margin: 36px 0 10px; color: var(--muted); }
.notes { padding-left: 1.3em; font-size: 16.5px; line-height: 1.6; }
.notes li { margin-bottom: 8px; padding-left: 4px; }
.notes li::marker { color: var(--rubric); font: 700 13px var(--font-ui); }
.notes .kind { color: var(--faint); font: 600 11px var(--font-ui); letter-spacing: .1em; text-transform: uppercase; margin-right: 6px; }
.terms { columns: 2; column-gap: 32px; padding: 0; list-style: none; font-size: 16.5px; }
.terms li { break-inside: avoid; padding: 2px 0; }
.pager { display: flex; justify-content: space-between; gap: 16px; margin: 40px 0 0 4.5rem; max-width: 40rem; padding-top: 16px; border-top: 1px solid var(--rule); font-family: var(--font-ui); }
.pager a { text-decoration: none; color: var(--ink); max-width: 48%; }
.pager .dir { display: block; color: var(--muted); }
.pager .t { font: 17px/1.35 var(--font-text); }
.pager .next { text-align: right; margin-left: auto; }

/* ---------- panel, preview, menus, dialogs ---------- */
.glpanel { position: fixed; z-index: 60; top: 0; right: 0; bottom: 0; width: min(24rem, 100vw); overflow: auto; padding: 18px 22px 40px; background: var(--raised);
  border-left: 1px solid var(--rule); box-shadow: -14px 0 36px color-mix(in srgb, var(--ink) 14%, transparent); }
.glpanel__close { float: right; }
.glpanel h2 { margin: 6px 0 2px; font-size: 26px; font-weight: 700; line-height: 1.2; }
.glpanel__type { margin: 0 0 10px; color: var(--faint); }
.glpanel__forms { margin: 0 0 10px; font-size: 16px; color: var(--muted); }
.glpanel__def { margin: 0 0 10px; }
.glpanel__sym { margin: 0 0 10px; font-style: italic; color: var(--muted); font-size: 17px; }
.glpanel__where { font: 14px/1.6 var(--font-ui); color: var(--muted); }
.glpanel__where a { margin-right: 6px; }
.att { display: inline-block; margin-left: 4px; padding: 0 4px; font: 600 10px/1.5 var(--font-ui); letter-spacing: .04em; color: var(--muted); border: 1px solid var(--rule); border-radius: 2px; vertical-align: 2px; }
.preview { position: absolute; z-index: 55; width: min(20rem, calc(100vw - 32px)); padding: 10px 12px; background: var(--raised); border: 1px solid var(--rule); border-radius: 3px;
  box-shadow: 0 10px 28px color-mix(in srgb, var(--ink) 14%, transparent); font-size: 15.5px; line-height: 1.5; pointer-events: none; }
.preview b { display: block; font-size: 17px; }
.preview .ui { color: var(--faint); font-size: 12px; }
.menu { position: absolute; z-index: 55; min-width: 14rem; padding: 6px; background: var(--raised); border: 1px solid var(--rule); border-radius: 3px;
  box-shadow: 0 10px 28px color-mix(in srgb, var(--ink) 14%, transparent); font-family: var(--font-ui); }
.menu button { display: block; width: 100%; text-align: left; padding: 7px 10px; font: 600 13.5px var(--font-ui); background: none; border: 0; border-radius: 3px; color: var(--ink); cursor: pointer; }
.menu button:hover, .menu button:focus-visible { background: var(--navy-wash); }
.menu .cite { margin: 6px 4px 2px; padding: 8px; font: 13.5px/1.5 var(--font-text); background: var(--paper); border: 1px solid var(--rule); border-radius: 3px; user-select: all; max-width: 22rem; }
.dialog { position: fixed; inset: 0; z-index: 70; display: grid; place-items: start center; padding: 10vh 16px 16px; background: color-mix(in srgb, var(--ink) 30%, transparent); }
.dialog__card { width: min(38rem, 100%); max-height: 78vh; overflow: auto; padding: 18px 20px; background: var(--raised); border: 1px solid var(--rule); border-radius: 4px;
  box-shadow: 0 20px 50px color-mix(in srgb, var(--ink) 25%, transparent); }
.dialog h2 { margin: 0 0 10px; font-size: 22px; font-weight: 400; }
.settings fieldset { border: 0; margin: 0 0 14px; padding: 0; }
.settings legend { margin-bottom: 6px; color: var(--muted); }
.settings label { display: flex; gap: 8px; align-items: baseline; padding: 4px 0; font: 15px/1.4 var(--font-ui); cursor: pointer; }
.settings .hint { display: block; color: var(--faint); font-size: 13px; }
.search__q { width: 100%; padding: 9px 12px; font: 17px var(--font-text); border: 1px solid var(--rule); border-radius: 3px; background: var(--paper); color: var(--ink); }
.search__res { list-style: none; margin: 12px 0 0; padding: 0; }
.search__res li a { display: block; padding: 8px 10px; border-radius: 3px; text-decoration: none; color: var(--ink); }
.search__res li a:hover, .search__res li a:focus-visible { background: var(--navy-wash); }
.search__res .k { display: block; color: var(--muted); font: 600 11.5px var(--font-ui); letter-spacing: .08em; text-transform: uppercase; }
.search__res mark { background: var(--warn-wash); color: inherit; }
.search__none { color: var(--muted); font: 15px var(--font-ui); }
.hint-gl { display: flex; gap: 12px; align-items: baseline; margin: 10px 0 4px; padding: 8px 12px; font: 14px/1.45 var(--font-ui); color: var(--ink);
  background: var(--navy-wash); border-radius: 3px; max-width: 40rem; }
.hint-gl button { margin-left: auto; }

/* ---------- title page ---------- */
.titlepage { max-width: 46rem; margin: 0 auto; padding: 40px clamp(16px, 4vw, 32px) 80px; }
.frame { position: relative; margin-top: 18px; padding: 42px 28px 30px; text-align: center; border: 1px solid var(--rule); outline: 1px solid var(--rule); outline-offset: 5px; }
.frame::before { content: '॥'; position: absolute; top: -17px; left: 50%; transform: translateX(-50%); padding: 0 12px; background: var(--paper); color: var(--rubric); font: 700 26px/1 var(--font-text); }
.frame__orig { margin: 0 0 6px; font-size: 44px; line-height: 1.25; color: var(--ink); }
.frame h1 { margin: 0 0 8px; font-weight: 400; font-size: clamp(30px, 5vw, 42px); line-height: 1.15; text-wrap: balance; }
.frame__alt { margin: 0 0 14px; font-style: italic; color: var(--muted); font-size: 18px; }
.frame__by { margin: 0 auto 14px; max-width: 30rem; font-size: 18px; }
.frame__wit { margin: 0; color: var(--muted); }
.imprint { margin: 22px 0 0; text-align: center; font: 14.5px/1.6 var(--font-ui); color: var(--muted); }
.imprint strong { color: var(--ink); }
.toc { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px 22px; margin: 22px 0 0; padding: 12px 0; border-top: 1px solid var(--rule); border-bottom: 1px solid var(--rule); font: 600 14px var(--font-ui); }
.toc a { text-decoration: none; }
.section-h { margin: 44px 0 12px; color: var(--muted); }
.lede { font-size: 18.5px; }
.howto { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 15rem); gap: 20px 32px; align-items: start; padding: 18px 0; }
.howto .passage { grid-template-columns: 3rem minmax(0, 1fr); border: 0; padding: 0; }
.howto .passage .sidenote { grid-column: 2; padding: 10px 0 0 14px; border-left: 2px solid var(--rule); margin-top: 8px; }
.howto ol { margin: 0; padding-left: 1.2em; font: 14.5px/1.55 var(--font-ui); color: var(--ink); }
.howto li { margin-bottom: 8px; }
.howto li::marker { color: var(--rubric); font-weight: 700; }
.callout { font: 700 10.5px/1 var(--font-ui); color: var(--paper); background: var(--rubric); border-radius: 50%; display: inline-grid; place-items: center; width: 17px; height: 17px; vertical-align: 3px; margin: 0 3px; }
.songtable { width: 100%; border-collapse: collapse; font: 15px/1.45 var(--font-ui); }
.songtable th { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--rule); color: var(--muted); font: 700 11px var(--font-ui); letter-spacing: .12em; text-transform: uppercase; }
.songtable td { padding: 7px 8px; border-bottom: 1px solid var(--rule); vertical-align: top; }
.songtable td:first-child { color: var(--rubric); font-weight: 700; text-align: right; width: 2.5rem; font-variant-numeric: tabular-nums; }
.songtable a { font: 16.5px var(--font-text); color: var(--ink); }
.songtable .st { color: var(--muted); }
.songtable tr.idle td { color: var(--faint); }
.tablewrap { overflow-x: auto; }

/* ---------- glossary and prose pages ---------- */
.prose { max-width: 42rem; margin: 0 auto; padding: 32px clamp(16px, 4vw, 32px) 80px; }
.prose h1 { margin: 0 0 10px; font-weight: 400; font-size: clamp(30px, 4vw, 38px); line-height: 1.15; }
.prose h2 { margin: 36px 0 10px; font-weight: 400; font-size: 24px; }
.prose p, .prose li { font-size: 18.5px; }
.prose dl { display: grid; grid-template-columns: max-content 1fr; gap: 6px 14px; font-size: 17px; }
.prose dt { font-weight: 700; }
.prose dd { margin: 0; }
.alpha { display: flex; flex-wrap: wrap; gap: 2px 4px; margin: 16px 0; font: 700 14px var(--font-ui); }
.alpha a { padding: 3px 7px; text-decoration: none; border-radius: 3px; }
.alpha a:hover { background: var(--navy-wash); }
.gtools { display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: center; margin: 10px 0 6px; }
.gtools input { flex: 1 1 14rem; padding: 7px 10px; font: 16px var(--font-text); border: 1px solid var(--rule); border-radius: 3px; background: var(--raised); color: var(--ink); }
.seg { padding: 4px 10px; font: 600 13px var(--font-ui); border: 1px solid var(--rule); background: transparent; color: var(--muted); cursor: pointer; }
.seg + .seg { margin-left: -1px; }
.seg[aria-pressed="true"] { background: var(--raised); color: var(--ink); border-color: var(--muted); position: relative; }
.letter { margin: 30px 0 4px; color: var(--rubric); font: 700 13px var(--font-ui); letter-spacing: .14em; }
.gentry { padding: 14px 0; border-bottom: 1px solid var(--rule); scroll-margin-top: 80px; }
.gentry[hidden] { display: none; }
.gentry h3 { margin: 0; font-size: 23px; font-weight: 700; line-height: 1.25; }
.gentry .ty { margin: 2px 0 6px; color: var(--faint); font-size: 11px; }
.gentry p { margin: 4px 0; font-size: 17.5px; }
.gentry .forms, .gentry .where { font-size: 16px; color: var(--muted); }
.prose dt .pno { cursor: default; }
.prose dt .glx { font-weight: 400; border-bottom: 1.5px dotted var(--navy); }
.sources li { margin-bottom: 8px; }
.shelf { list-style: none; margin: 30px 0 0; padding: 0; }
.shelf li { padding: 18px 0; border-top: 1px solid var(--rule); }
.shelf__orig { margin: 0; font-size: 24px; line-height: 1.3; }
.shelf__title { margin: 0; font-size: 26px; line-height: 1.25; }
.shelf__title a { color: var(--ink); text-decoration: none; } .shelf__title a:hover { color: var(--navy); text-decoration: underline; }
.shelf__desc { margin: 4px 0 0; }
.shelf__meta { margin: 6px 0 0; font: 14px/1.5 var(--font-ui); color: var(--muted); }
.prose .legend { margin-top: 30px; font: 13.5px/1.8 var(--font-ui); color: var(--muted); }

/* ---------- footer ---------- */
.foot { max-width: 1440px; padding: 22px clamp(16px, 3vw, 32px) 48px; border-top: 1px solid var(--rule); font: 13px/1.7 var(--font-ui); color: var(--muted); }
.foot p { max-width: 80ch; margin: 0 0 8px; }
.foot a { color: var(--muted); }

.only-narrow { display: none; }

/* ---------- responsive ---------- */
@media (max-width: 1180px) {
  .passage { grid-template-columns: 3.5rem minmax(0, 40rem); }
  .sidenote, .sidenote + .sidenote { grid-column: 2; padding: 10px 0 0 14px; border-left: 2px solid var(--rule); margin-top: 8px; }
  .head, .summary, .after, .pager, .song-comment { margin-left: 3.5rem; }
}
@media (max-width: 900px) {
  .room { grid-template-columns: minmax(0, 1fr); }
  .rail { position: fixed; z-index: 50; top: 0; left: 0; bottom: 0; align-self: stretch; height: 100vh; height: 100dvh; max-height: none; width: min(20rem, 86vw); padding: 20px 16px; background: var(--surface);
    border-right: 1px solid var(--rule); transform: translateX(-105%); visibility: hidden; transition: transform .18s ease, visibility 0s linear .18s; }
  html[data-rail="open"] .rail { transform: none; visibility: visible; transition: transform .18s ease; box-shadow: 12px 0 30px color-mix(in srgb, var(--ink) 16%, transparent); }
  .only-narrow { display: inline-flex; }
  .bar__label { display: none; }
  .bar__short { display: inline; }
}
@media (max-width: 640px) {
  body { font-size: 18px; }
  .passage { grid-template-columns: 2.6rem minmax(0, 1fr); }
  .head, .summary, .after, .pager, .song-comment { margin-left: 0; }
  .en { font-size: 19.5px; }
  .terms { columns: 1; }
  .howto { grid-template-columns: minmax(0, 1fr); }
  .frame { padding: 34px 16px 24px; }
  .frame__orig { font-size: 36px; }
  .bar { gap: 10px; }
  .bar__name, .bar__text, .btn kbd { display: none; }
  .bar__home { margin-right: auto; }
}

/* ---------- print: everything inline, no chrome ---------- */
@media print {
  body { background: #fff; color: #000; font-size: 11.5pt; }
  .bar, .crumbs, .rail, .pager, .glpanel, .preview, .menu, .dialog, .hint-gl, .only-narrow, .skip, .gtools, .alpha { display: none !important; }
  .room { display: block; padding: 0; }
  .passage { grid-template-columns: 2.5rem minmax(0, 1fr); break-inside: avoid; }
  .sidenote { display: block !important; grid-column: 2; border-left: 1px solid #999; padding-left: 10px; }
  .src, .tl { display: block !important; }
  a.gl { border: 0; }
  .sidenote details > * { display: block; }
}
`;
