// The Studio: a private review workspace. Claude seeds songs, glossary and the
// checklist into this page's database; the reviewer edits and decides here;
// Claude pulls the decisions back into the repository.

import { h, $, $$, append, copyText, announce, autosize, words, store } from './dom.mjs';

/** replaceChildren that skips null/false like h() does. */
const fill = (el, ...kids) => { el.replaceChildren(); append(el, kids); return el; };
import { TERM_RE, problems as markupProblems, terms as termsOf, strip } from '../../lib/markup.mjs';
import * as M from './model.mjs';
import * as A from './store.mjs';
import { diffWords } from './diff.mjs';
import { createSync } from './sync.mjs';
import { whyPrompt, askWhy, WHY_ERRORS } from './why.mjs';
import { lookups } from '../../lib/lookup.mjs';
import { makePlaces } from '../../lib/places.mjs';

const S = {
  env: { db: null, sample: null, canWrite: true, fatal: null, started: false, noClaude: false },
  meta: new Map(), glossary: new Map(), decisions: new Map(), gdecisions: new Map(), receipts: new Map(),
  concord: new Map(),   // term id -> concordance doc (null: none), read once when the term is opened
  loaded: new Set(),
  text: '', unitId: '', unit: null,
  ui: { focus: 'head', editing: null, tab: 'terms', allTerms: false, diff: false, filter: 'all', drawer: null,
        sheet: null, termOpen: null, termFilter: '', whyOpen: null, redraftOpen: null, lastSent: '',
        termEdit: null, concordAll: null, pendingFocus: null, parallel: store('studio:parallel') === '1' },
  save: 'idle',
};
let sync = null;
const secEls = new Map();
const whyState = new Map();   // key -> {text, error, busy, ctl, question}
const now = () => new Date().toISOString();

// ---------------------------------------------------------------- lookups
const textMeta = () => S.meta.get('text-' + S.text);
const unit = () => (S.unit && S.unit.id === S.unitId ? S.unit : null);
const decision = () => S.decisions.get(S.unitId) || null;
const liveDecision = () => { const d = decision(); const u = unit(); return d && u && d.draftSha === u.draftSha ? d : null; };
const dsec = part => liveDecision()?.sections?.[part];
const entry = id => { const e = S.glossary.get(id); return e && e.text === S.text ? e : null; };
const gdec = id => S.gdecisions.get(id) || null;
const termDecided = id => A.termDecided(entry(id), gdec(id));
const sections = () => unit()?.sections || [];
const secByPart = part => sections().find(s => s.part === part);
const reviewableParts = () => sections().filter(M.reviewable).map(s => s.part);
const songs = () => textMeta()?.songs || [];

function attentionParts() {
  const u = unit(); if (!u) return [];
  return u.sections.filter(s => M.needsAttention(s, dsec(s.part), { termsOf, termDecided })).map(s => s.part);
}

// ---------------------------------------------------------------- actions
function commitDecision(doc, { immediate = false } = {}) {
  S.decisions.set(S.unitId, doc);
  if (sync && S.env.canWrite) sync.save('decisions/' + S.unitId, doc, { immediate });
}

function editText(part, change, opts = {}) {
  const u = unit(); if (!u) return;
  const { doc, cleared } = A.edit(decision(), u, part, change, now());
  commitDecision(doc, opts);
  if (cleared) announce(`Approval of ${labelOf(secByPart(part))} cleared: its text changed.`);
  refreshSectionChrome(part);
  renderTop(); renderRail();
}

function decidePart(part, value) {
  const u = unit(); if (!u) return;
  commitDecision(A.decide(decision(), u, part, value, now()), { immediate: true });
  renderSection(part); renderTop(); renderRail(); renderPanel();
}

function setNextNote(part, text) {
  const u = unit(); if (!u) return;
  commitDecision(A.noteForNextDraft(decision(), u, part, text, now()));
}

function revertPart(part) {
  const u = unit(); if (!u) return;
  commitDecision(A.revert(decision(), u, part, now()), { immediate: true });
  renderSection(part); renderTop(); renderRail();
  announce(`${labelOf(secByPart(part))} is back to Claude's draft.`);
}

function approveAndMove(part, { attentionOnly = false } = {}) {
  finishEdit();
  if (!secByPart(part) || !M.reviewable(secByPart(part))) return;
  decidePart(part, 'ok');
  const order = reviewableParts();
  const pool = attentionOnly ? attentionParts() : order;
  const next = order.slice(order.indexOf(part) + 1).find(p => pool.includes(p)) || (attentionOnly ? pool[0] : null);
  announce(`${labelOf(secByPart(part))} approved.${next ? ` Now on ${labelOf(secByPart(next))}.` : ' That was the last passage.'}`);
  if (next) focusSection(next);
}

function sendToClaude() {
  const u = unit(); if (!u) return;
  const doc = A.send(decision(), u, now(), true);
  commitDecision(doc, { immediate: true });
  S.ui.sheet = 'send';
  renderSheet(); renderTop(); renderRail();
}

function answerQuestion(q, text) {
  const u = unit(); if (!u) return;
  commitDecision(A.answer(decision(), u, q, text, now()));
}

function glossaryChange(id, fn, { immediate = false } = {}) {
  const e = entry(id); if (!e) return;
  const res = fn(gdec(id), e);
  const doc = res.doc || res;
  S.gdecisions.set(id, doc);
  if (sync && S.env.canWrite) sync.save('glossaryDecisions/' + id, doc, { immediate });
  if (res.cleared) announce(`Decision on “${e.en}” cleared: you changed the entry.`);
}

function startNewDraftReview() {
  const u = unit(); if (!u) return;
  const { doc, kept, reset } = M.carryOver(u, decision(), now());
  S.ui.previous = reset;
  commitDecision(doc, { immediate: true });
  announce(`Reviewing the new draft. Kept ${kept.length} unchanged passage${kept.length === 1 ? '' : 's'}.`);
  renderAll();
}

// ---------------------------------------------------------------- text rendering
function termNode(surface, id) {
  const e = entry(id);
  const status = !e ? 'unknown' : termDecided(id) ? 'ok' : 'open';
  return h('button', {
    type: 'button', class: `term term--${status}`, title: e ? `${e.en} · ${e.type}${status === 'open' ? ' · to decide' : ''}` : `unknown term ${id}`,
    onclick: ev => { ev.stopPropagation(); openTerm(id); },
  }, surface);
}

function richText(s) {
  const out = []; let last = 0; const str = String(s || '');
  for (const m of str.matchAll(TERM_RE)) {
    if (m.index > last) out.push(str.slice(last, m.index));
    out.push(termNode(m[1], m[2]));
    last = m.index + m[0].length;
  }
  if (last < str.length) out.push(str.slice(last));
  return out;
}

function diffNodes(before, after) {
  return diffWords(strip(before), strip(after)).map(p =>
    p.op === 'eq' ? p.text : p.op === 'del'
      ? h('del', {}, h('span', { class: 'sr-only' }, 'removed: '), p.text)
      : h('ins', {}, h('span', { class: 'sr-only' }, 'added: '), p.text));
}

const labelOf = sec => !sec ? '' : sec.kind === 'head' ? 'the title and summary' : sec.kind === 'heading' ? 'the heading'
  : sec.kind === 'comment' ? `${sec.who} on ${sec.label}` : `passage ${sec.label}`;

// ---------------------------------------------------------------- shell
function renderAll() {
  const app = $('#app');
  app.removeAttribute('aria-busy');
  if (!$('#top', app)) {
    fill(app, 
      h('header', { id: 'top', class: 'top' }),
      h('div', { id: 'banner', class: 'banner', hidden: true }),
      h('div', { class: 'cols' },
        h('nav', { id: 'rail', class: 'rail', 'aria-label': 'Songs and progress' }),
        h('main', { id: 'grid', class: 'grid', tabindex: '-1' }),
        h('aside', { id: 'panel', class: 'panel', 'aria-label': 'Glossary and questions' })),
      h('div', { id: 'bar', class: 'bar' }),
      h('div', { id: 'sheet', class: 'sheet', hidden: true }),
    );
  }
  renderTop(); renderBanner(); renderRail(); renderGrid(); renderPanel(); renderBar(); renderSheet();
}

function saveLabel() {
  return { idle: '', saving: 'Saving…', saved: 'Saved', error: 'Not saved' }[S.save] || '';
}

function receiptLabel() {
  const d = decision(); const r = S.receipts.get(S.unitId);
  if (!d?.ready) return '';
  if (r && r.decisionUpdatedAt === d.updatedAt) {
    return { approved: 'Claude has this · approved', 'not-approved': 'Claude has this · still in review', stale: 'Claude has this · the draft had changed',
      problems: 'Claude has this · see problems', skipped: 'Claude skipped this' }[r.result] || 'Claude has this';
  }
  return r ? 'Changed since Claude read it' : 'Sent · waiting for Claude';
}

function renderTop() {
  const top = $('#top'); if (!top) return;
  const meta = textMeta(); const u = unit();
  const song = songs().find(s => s.id === S.unitId);
  const p = u ? M.progress(u, liveDecision()) : null;
  fill(top, 
    h('button', { type: 'button', class: 'top__toggle only-narrow', 'aria-label': 'Songs', 'aria-expanded': S.ui.drawer === 'rail' ? 'true' : 'false',
      onclick: () => toggleDrawer('rail') }, 'Songs'),
    h('div', { class: 'brand' }, h('span', { class: 'brand__mark', 'aria-hidden': 'true' }, '॥'), h('span', { class: 'brand__name' }, 'Studio')),
    meta ? h('div', { class: 'top__where' },
      h('span', { class: 'top__text' }, meta.title),
      song ? h('span', { class: 'top__song' }, `${meta.unitLabel} ${song.n}${song.poet ? ' · ' + song.poet : ''}`) : null) : h('div', { class: 'top__where' }),
    h('div', { class: 'top__status' },
      p ? h('span', { class: 'top__progress', title: 'Passages decided' }, `${p.ok + p.redraft} of ${p.total} decided`) : null,
      h('span', { class: `top__save top__save--${S.save}`, role: 'status' }, saveLabel(),
        S.save === 'error' ? h('button', { type: 'button', class: 'link', onclick: () => sync?.retry() }, 'Retry') : null),
      receiptLabel() ? h('span', { class: 'top__receipt' }, receiptLabel()) : null),
    h('div', { class: 'top__actions' },
      u && S.env.canWrite ? h('button', { type: 'button', class: 'btn btn--primary', onclick: sendToClaude,
        title: 'Mark this song ready for Claude to pull into the repository' }, 'Send to Claude') : null,
      h('button', { type: 'button', class: 'btn btn--quiet only-narrow', 'aria-expanded': S.ui.drawer === 'panel' ? 'true' : 'false',
        onclick: () => toggleDrawer('panel') }, 'Terms'),
      h('button', { type: 'button', class: 'btn btn--quiet', 'aria-label': 'Keyboard shortcuts', onclick: () => { S.ui.sheet = 'keys'; renderSheet(); } }, '?')),
  );
}

function renderBanner() {
  const b = $('#banner'); if (!b) return;
  const d = decision(); const u = unit();
  if (S.env.fatal) {
    b.hidden = false;
    fill(b, h('p', {}, 'The Studio lost its connection to its database. Reload the page to continue; anything shown as Saved is kept.'));
    return;
  }
  if (!S.env.canWrite && u) {
    b.hidden = false;
    fill(b, h('p', {}, 'You can read this Studio but not change it. Only its owner can review here.'));
    return;
  }
  if (d && u && d.draftSha !== u.draftSha) {
    const { kept } = M.carryOver(u, d, now());
    b.hidden = false;
    fill(b, 
      h('p', {}, `Claude loaded a new draft of this song. Your earlier decisions were made on the previous draft; ${kept.length} passage${kept.length === 1 ? ' is' : 's are'} unchanged and will keep your decisions.`),
      S.env.canWrite ? h('button', { type: 'button', class: 'btn btn--primary', onclick: startNewDraftReview }, 'Start review of the new draft') : null);
    return;
  }
  b.hidden = true; fill(b);
}

function toggleDrawer(which) {
  S.ui.drawer = S.ui.drawer === which ? null : which;
  document.body.dataset.drawer = S.ui.drawer || '';
  renderTop();
}

// ---------------------------------------------------------------- rail
function renderRail() {
  const rail = $('#rail'); if (!rail) return;
  const meta = textMeta();
  const parts = [];
  const texts = [...S.meta.values()].filter(m => m.slug);
  if (texts.length > 1) {
    parts.push(h('label', { class: 'rail__label', for: 'text-pick' }, 'Text'),
      h('select', { id: 'text-pick', class: 'rail__select', onchange: e => chooseText(e.target.value) },
        texts.map(m => h('option', { value: m.slug, selected: m.slug === S.text }, m.title))));
  }
  const steps = checklist();
  if (steps.some(s => !s.done)) {
    parts.push(h('section', { class: 'check', 'aria-labelledby': 'check-h' },
      h('h2', { id: 'check-h', class: 'rail__label' }, 'Getting started'),
      h('ol', { class: 'check__list' }, steps.map(s => h('li', { class: `check__step${s.done ? ' is-done' : ''}` },
        h('span', { class: 'check__mark', 'aria-hidden': 'true' }, s.done ? '✓' : ''),
        h('div', { class: 'check__body' },
          h('span', { class: 'check__label' }, s.label, s.done ? h('span', { class: 'sr-only' }, ' (done)') : null),
          !s.done && s.prompt ? promptBox(s.prompt) : null))))));
  }
  if (meta) {
    const counts = { approved: 0, review: 0 };
    for (const s of meta.songs) { if (s.approved) counts.approved++; else if (s.reviewable) counts.review++; }
    parts.push(h('h2', { class: 'rail__label' }, `${meta.unitLabel}s`,
      h('span', { class: 'rail__count' }, `${counts.review} in review · ${counts.approved} approved`)));
    parts.push(h('ol', { class: 'songs' }, meta.songs.map(s => songItem(s, meta))));
    const toDecide = [...S.glossary.values()].filter(e => e.text === S.text && e.status === 'proposed' && !termDecided(e.id)).length;
    parts.push(h('button', { type: 'button', class: 'rail__glossary', onclick: () => { S.ui.tab = 'terms'; S.ui.allTerms = true; S.ui.drawer = 'panel'; document.body.dataset.drawer = 'panel'; renderPanel(); renderTop(); } },
      h('span', {}, 'Glossary'), h('span', { class: 'rail__count' }, toDecide ? `${toDecide} to decide` : 'all decided')));
  }
  fill(rail, ...parts);
}

function songItem(s, meta) {
  const d = S.decisions.get(s.id);
  const live = S.unitId === s.id && unit() ? M.progress(unit(), liveDecision()) : d?.progress;
  let status = s.approved ? '✓ approved' : !s.reviewable ? s.stage : live ? `${live.ok} of ${live.total}` : 'not started';
  if (d?.ready && !s.approved) status = 'sent';
  const current = s.id === S.unitId;
  const body = [
    h('span', { class: 'songs__n' }, String(s.n)),
    h('span', { class: 'songs__t' }, s.title || (s.reviewable ? 'Untitled draft' : 'Not drafted'), s.poet ? h('span', { class: 'songs__poet' }, s.poet) : null),
    h('span', { class: 'songs__s' }, status),
  ];
  return h('li', { class: `songs__item${current ? ' is-current' : ''}${s.reviewable || s.approved ? '' : ' is-idle'}` },
    s.reviewable || s.approved
      ? h('button', { type: 'button', class: 'songs__btn', 'aria-current': current ? 'true' : null, onclick: () => chooseSong(s.id) }, body)
      : h('div', { class: 'songs__btn' }, body));
}

function checklist() {
  const meta = textMeta();
  const base = meta?.checklist || [
    { id: 'source', label: 'Load a text', done: false, prompt: 'Load the practice song into my Studio.' },
  ];
  const sent = [...S.decisions.values()].some(d => d.ready);
  return base.map(s => (s.id === 'review' && sent ? { ...s, done: true } : s));
}

function promptBox(text) {
  const p = h('code', { class: 'prompt__text' }, text);
  const btn = h('button', { type: 'button', class: 'link prompt__copy' }, 'Copy prompt');
  btn.addEventListener('click', async () => {
    const ok = await copyText(text, p);
    btn.textContent = ok ? 'Copied' : 'Selected: press Ctrl+C';
    setTimeout(() => { btn.textContent = 'Copy prompt'; }, 2200);
  });
  return h('div', { class: 'prompt' }, h('span', { class: 'prompt__lead' }, 'Ask Claude in the session:'), p, btn);
}

// ---------------------------------------------------------------- grid
function renderGrid() {
  const grid = $('#grid'); if (!grid) return;
  const u = unit();
  secEls.clear();
  if (!S.env.started) { fill(grid, h('p', { class: 'empty' }, 'Opening the Studio…')); return; }
  if (!textMeta()) {
    fill(grid, h('div', { class: 'empty' },
      h('h1', { class: 'empty__title' }, 'Nothing is loaded yet'),
      h('p', {}, 'Claude fills this Studio with drafts from the translation engine. Ask in the session:'),
      promptBox('Load the practice song into my Studio.')));
    return;
  }
  if (!S.unitId || !u) {
    const first = songs().find(s => s.reviewable || s.approved);
    fill(grid, h('div', { class: 'empty' },
      h('h1', { class: 'empty__title' }, first ? 'Choose a song' : 'No song is ready for review yet'),
      first ? h('p', {}, 'Pick a song from the list to start reviewing.') : h('p', {}, 'When Claude has drafted a song and woven its commentary, it appears here.'),
      !first ? promptBox(textMeta().checklist?.find(c => !c.done)?.prompt || 'Draft the next song and load it into my Studio.') : null));
    return;
  }
  const list = h('div', { class: 'secs' });
  const att = new Set(attentionParts());
  for (const sec of u.sections) {
    if (S.ui.filter === 'attention' && sec.kind !== 'head' && !att.has(sec.part)) continue;
    const el = buildSection(sec);
    secEls.set(sec.part, el);
    list.append(el);
  }
  fill(grid, songHeader(u), toolbar(u, att), list,
    S.ui.filter === 'attention' && att.size === 0 ? h('p', { class: 'empty empty--inline' }, 'Nothing needs your attention in this song. Send it to Claude when you are ready.') : null);
  markFocus();
}

function songHeader(u) {
  const meta = textMeta();
  return h('div', { class: 'song' },
    h('p', { class: 'song__eyebrow' }, `${meta.unitLabel} ${u.n}${meta.total ? ' of ' + meta.total : ''}`,
      u.raga ? h('span', { class: 'song__raga' }, ` · rāga ${u.raga}`) : null,
      u.poet ? h('span', {}, ` · ${u.poet}`) : null),
    u.questions.length ? h('button', { type: 'button', class: 'link song__q', onclick: () => { S.ui.tab = 'questions'; S.ui.drawer = 'panel'; document.body.dataset.drawer = 'panel'; renderPanel(); renderTop(); } },
      `${u.questions.length} question${u.questions.length === 1 ? '' : 's'} from the drafter`) : null);
}

function toolbar(u, att) {
  const p = M.progress(u, liveDecision());
  const pct = n => (p.total ? (100 * n / p.total).toFixed(2) + '%' : '0');
  return h('div', { class: 'tools', role: 'toolbar', 'aria-label': 'Review tools' },
    h('div', { class: 'tools__filter', role: 'group', 'aria-label': 'Show' },
      h('button', { type: 'button', class: 'seg', 'aria-pressed': S.ui.filter === 'all' ? 'true' : 'false', onclick: () => { S.ui.filter = 'all'; renderGrid(); } }, 'All passages'),
      h('button', { type: 'button', class: 'seg', 'aria-pressed': S.ui.filter === 'attention' ? 'true' : 'false', onclick: () => { S.ui.filter = 'attention'; renderGrid(); } },
        `Needs attention (${att.size})`)),
    h('label', { class: 'tools__diff' },
      h('input', { type: 'checkbox', id: 'diff-toggle', checked: S.ui.diff, onchange: e => { S.ui.diff = e.target.checked; renderGrid(); } }),
      ' Show changes from Claude’s draft'),
    u.parallels?.length ? h('label', { class: 'tools__diff', title: u.parallels.map(p => p.label).join('; ') },
      h('input', { type: 'checkbox', id: 'parallel-toggle', checked: S.ui.parallel, onchange: e => setParallel(e.target.checked) }),
      ` Show ${u.parallels.map(p => p.name).join(' and ')}`) : null,
    h('div', { class: 'meter', role: 'img', 'aria-label': `${p.ok} approved, ${p.redraft} sent back for redraft, ${p.total - p.ok - p.redraft} undecided` },
      h('span', { class: 'meter__ok', style: `width:${pct(p.ok)}` }),
      h('span', { class: 'meter__redo', style: `width:${pct(p.redraft)}` })));
}

function setParallel(on) {
  S.ui.parallel = on;
  store('studio:parallel', on ? '1' : null);
  renderGrid(); renderPanel();
}

/** A parallel witness's text (the Tibetan): script above transliteration, under the Bengali. */
function parBlock(par) {
  if (!S.ui.parallel || !par?.length) return null;
  const labels = new Map((unit()?.parallels || []).map(p => [p.id, p]));
  return par.map(p => h('div', { class: 'par' },
    h('p', { class: 'par__label' }, labels.get(p.witness)?.name || p.witness),
    h('p', { class: 'src', lang: p.html }, p.src),
    p.translit ? h('p', { class: 'tl', lang: p.html + '-Latn' }, p.translit) : null));
}

function buildSection(sec) {
  const d = dsec(sec.part);
  if (sec.kind === 'lacuna') {
    return h('section', { class: 'sec sec--lacuna', id: 's-' + sec.part, 'data-part': sec.part },
      h('div', { class: 'sec__gutter' }), h('div', { class: 'sec__body' }, h('p', {}, `A gap in the manuscript${sec.note ? ': ' + sec.note : ''}. Nothing to translate.`)));
  }
  const status = M.statusOf(sec, d);
  const el = h('section', {
    class: `sec sec--${sec.kind} is-${status}`, id: 's-' + sec.part, 'data-part': sec.part, tabindex: '-1',
    'aria-label': `${labelOf(sec)}, ${M.STATUS_LABEL[status]}`,
    onfocusin: () => { if (S.ui.focus !== sec.part) { S.ui.focus = sec.part; markFocus(); renderBar(); } },
    onclick: () => { if (S.ui.focus !== sec.part) { S.ui.focus = sec.part; markFocus(); renderBar(); } },
  });
  const gutter = h('div', { class: 'sec__gutter' },
    sec.kind === 'group' ? h('a', { class: 'pno', href: '#s-' + sec.part, onclick: e => { e.preventDefault(); focusSection(sec.part); } }, sec.label)
      : sec.kind === 'comment' ? h('span', { class: 'cmark', 'aria-hidden': 'true' }, '§') : null);
  const body = h('div', { class: 'sec__body' });
  append(body, [sec.kind === 'head' ? headBody(sec, d) : sec.kind === 'comment' ? commentBody(sec, d) : groupBody(sec, d),
    notesBlock(sec, d), sectionFoot(sec, d, status), S.ui.redraftOpen === sec.part ? redraftBox(sec, d) : null]);
  el.append(gutter, body);
  return el;
}

function headBody(sec, d) {
  const c = M.current(sec, d);
  return [
    h('p', { class: 'sec__label' }, 'Title and summary'),
    fieldView(sec, 'title', c.title, sec.title, 'song__title'),
    fieldView(sec, 'summary', c.summary, sec.summary, 'song__summary'),
  ];
}

function groupBody(sec, d) {
  const c = M.current(sec, d);
  const tags = [sec.refrain && 'Refrain', sec.bhanita && 'The poet names himself'].filter(Boolean);
  return [
    sec.kind === 'heading' ? h('p', { class: 'sec__label' }, 'Heading') : null,
    tags.length ? h('p', { class: 'sec__tags' }, tags.join(' · ')) : null,
    ...sec.lines.map(l => h('div', { class: 'line', 'data-line': l.part },
      h('div', { class: 'line__ref' },
        h('p', { class: 'src', lang: l.html }, l.src),
        h('p', { class: 'tl', lang: l.html + '-Latn' }, l.drafterTranslit || l.translit),
        l.gloss ? h('p', { class: 'lit' }, l.gloss) : null,
        l.emended.length ? h('p', { class: 'emend' }, 'Emended: ' + l.emended.map(e => `${e.from} → ${e.to}`).join('; ')) : null,
        parBlock(l.par)),
      h('div', { class: 'line__en' },
        fieldView(sec, 'en:' + l.part, c.en[l.part], l.en, 'en'),
        l.flags.length ? h('ul', { class: 'flags' }, l.flags.map(f => h('li', { class: `flag flag--${f.level}` },
          h('span', { class: 'flag__kind' }, `${f.kind} · ${f.level}`), ' ', f.note))) : null,
        sec.kind === 'group' ? whyBlock(sec, l) : null))),
  ];
}

function commentBody(sec, d) {
  const c = M.current(sec, d);
  const n = words(strip(c.note));
  return [
    h('p', { class: 'sec__label' }, `${sec.who} on ${sec.label}`),
    h('details', { class: 'csrc' }, h('summary', {}, 'Source and transliteration'),
      h('p', { class: 'src', lang: unit().commentLang }, sec.src),
      h('p', { class: 'tl', lang: unit().commentLang + '-Latn' }, sec.translit)),
    S.ui.parallel && sec.par?.length ? h('details', { class: 'csrc' },
      h('summary', {}, `${(unit().parallels || []).map(p => p.name).join(' and ')} translation of this passage`), parBlock(sec.par)) : null,
    h('div', { class: 'field' }, h('p', { class: 'field__label' }, 'Translation'),
      fieldView(sec, 'translation', c.translation, sec.translation, 'ctrans')),
    h('div', { class: 'field' }, h('p', { class: 'field__label' }, 'Note beside the passage',
      h('span', { class: `field__count${n > 60 ? ' is-over' : ''}` }, ` · ${n} of 60 words`)),
      fieldView(sec, 'note', c.note, sec.note, 'cnote')),
    sec.equations.length ? h('p', { class: 'eqs' }, h('span', { class: 'field__label' }, 'Glosses in the commentary: '),
      sec.equations.map((e, i) => [i ? '; ' : '', h('i', {}, e.src), ' = ', e.en, e.term ? [' (', termNode(entry(e.term)?.en || e.term, e.term), ')'] : ''])) : null,
    sec.citations.length ? h('p', { class: 'eqs' }, h('span', { class: 'field__label' }, 'Quotes: '),
      sec.citations.map((q, i) => [i ? '; ' : '', `“${q.quoted}” (${q.work || 'unidentified'}${q.confident ? '' : ', unsure'})`])) : null,
    sec.flags.length ? h('ul', { class: 'flags' }, sec.flags.map(f => h('li', { class: `flag flag--${f.level}` }, h('span', { class: 'flag__kind' }, `${f.kind} · ${f.level}`), ' ', f.note))) : null,
  ];
}

function fieldView(sec, field, value, draftValue, cls) {
  const editing = S.ui.editing && S.ui.editing.part === sec.part && S.ui.editing.field === field;
  if (editing) return editorFor(sec, field, value);
  const changed = M.flat(value) !== M.flat(draftValue);
  const content = S.ui.diff && changed ? diffNodes(draftValue, value) : richText(value);
  return h('p', {
    class: `fv ${cls}${changed ? ' is-changed' : ''}`, 'data-field': field,
    ondblclick: () => startEdit(sec.part, field),
  }, content.length ? content : h('span', { class: 'fv__empty' }, '(empty)'),
  S.env.canWrite ? h('button', { type: 'button', class: 'fv__edit', 'aria-label': `Edit ${fieldName(field)}`, onclick: e => { e.stopPropagation(); startEdit(sec.part, field); } }, 'Edit') : null);
}

const fieldName = f => f.startsWith('en:') ? `line ${f.slice(3)}` : f.startsWith('note:') ? `note ${f.slice(5)}` : f;

function readField(sec, field) {
  const c = M.current(sec, dsec(sec.part));
  if (field.startsWith('en:')) return c.en[field.slice(3)];
  if (field.startsWith('note:')) return (c.notes.find(n => String(n.n) === field.slice(5)) || {}).text || '';
  return c[field];
}

function writeField(sec, field, text) {
  if (field.startsWith('en:')) return editText(sec.part, { en: { [field.slice(3)]: text } });
  if (field.startsWith('note:')) {
    const n = Number(field.slice(5));
    const notes = M.current(sec, dsec(sec.part)).notes.map(x => (x.n === n ? { ...x, text } : x));
    return editText(sec.part, { notes });
  }
  editText(sec.part, { [field]: text });
}

function editorFor(sec, field, value) {
  const ta = h('textarea', { class: 'ed__ta', id: `ed-${sec.part}-${field.replace(':', '-')}`, 'aria-label': `Edit ${fieldName(field)}`, spellcheck: 'true' });
  ta.value = value || '';
  const preview = h('p', { class: 'ed__preview', 'aria-live': 'polite' });
  const issues = h('p', { class: 'ed__issues' });
  const update = () => {
    const probs = markupProblems(ta.value);
    const unknown = termsOf(ta.value).filter(t => !entry(t.id)).map(t => `unknown term {${t.id}}`);
    issues.textContent = [...probs, ...unknown].join(' · ');
    fill(preview, ...richText(ta.value));
  };
  ta.addEventListener('input', () => { autosize(ta); update(); writeField(sec, field, ta.value); });
  ta.addEventListener('keydown', ev => editorKeys(ev, sec, field, ta));
  queueMicrotask(() => { autosize(ta); update(); });
  const wrap = h('div', { class: 'ed', 'data-field': field },
    ta, preview, issues,
    h('p', { class: 'ed__hint' }, h('kbd', {}, 'Esc'), ' done · ', h('kbd', {}, 'Ctrl'), '+', h('kbd', {}, 'Enter'), ' approve and next · ',
      h('kbd', {}, 'Ctrl'), '+', h('kbd', {}, 'K'), ' insert a glossary term'),
    S.ui.picker === sec.part + field ? termPicker(ta, sec, field) : null);
  return wrap;
}

function editorKeys(ev, sec, field, ta) {
  const mod = ev.ctrlKey || ev.metaKey;
  if (ev.key === 'Escape') { ev.preventDefault(); if (S.ui.picker) { S.ui.picker = null; renderSection(sec.part); focusEditor(); } else finishEdit(true); }
  else if (mod && ev.key === 'Enter') { ev.preventDefault(); approveAndMove(sec.part, { attentionOnly: ev.shiftKey }); }
  else if (mod && (ev.key === 'k' || ev.key === 'K')) {
    ev.preventDefault();
    S.ui.pickerSel = [ta.selectionStart, ta.selectionEnd];
    S.ui.picker = sec.part + field;
    renderSection(sec.part);
    setTimeout(() => $('.picker__q')?.focus(), 0);
  }
}

function termPicker(ta, sec, field) {
  const q = h('input', { type: 'search', class: 'picker__q', id: 'picker-q', placeholder: 'Find a glossary term', 'aria-label': 'Find a glossary term' });
  const list = h('ul', { class: 'picker__list', role: 'listbox' });
  const all = [...S.glossary.values()].filter(e => e.text === S.text && e.status !== 'rejected');
  const fill = () => {
    const f = q.value.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
    const hits = all.filter(e => (e.en + ' ' + e.id + ' ' + e.forms.map(x => x.translit).join(' ')).toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').includes(f)).slice(0, 8);
    fill(list, ...hits.map((e, i) => h('li', { role: 'option', class: 'picker__opt', 'aria-selected': i === 0 ? 'true' : 'false', 'data-id': e.id,
      onmousedown: ev => { ev.preventDefault(); insertTerm(e); } }, h('b', {}, e.en), ' ', h('span', { class: 'picker__id' }, e.id))));
  };
  const insertTerm = e => {
    const [a, b] = S.ui.pickerSel || [ta.value.length, ta.value.length];
    const cur = readField(sec, field) || '';
    const sel = cur.slice(a, b) || e.en;
    const next = cur.slice(0, a) + `[${sel}]{${e.id}}` + cur.slice(b);
    S.ui.picker = null;
    writeField(sec, field, next);
    renderSection(sec.part); focusEditor();
  };
  q.addEventListener('input', fill);
  q.addEventListener('keydown', ev => {
    const opts = $$('.picker__opt', list);
    const i = opts.findIndex(o => o.getAttribute('aria-selected') === 'true');
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      ev.preventDefault();
      const j = Math.max(0, Math.min(opts.length - 1, i + (ev.key === 'ArrowDown' ? 1 : -1)));
      opts.forEach((o, k) => o.setAttribute('aria-selected', k === j ? 'true' : 'false'));
    } else if (ev.key === 'Enter') { ev.preventDefault(); const id = opts[Math.max(0, i)]?.dataset.id; if (id) insertTerm(entry(id)); }
    else if (ev.key === 'Escape') { ev.preventDefault(); S.ui.picker = null; renderSection(sec.part); focusEditor(); }
  });
  queueMicrotask(fill);
  return h('div', { class: 'picker' }, q, list);
}

function notesBlock(sec, d) {
  if (sec.kind === 'comment') return [];
  const notes = M.current(sec, d).notes;
  const out = [];
  if (notes.length) {
    out.push(h('ol', { class: 'notes' }, notes.map(n => h('li', { class: 'note' },
      h('span', { class: 'note__kind' }, `Note ${n.n} · ${n.kind}${n.cites.length ? ' · cites ' + n.cites.join(', ') : ''}`),
      fieldView(sec, 'note:' + n.n, n.text, (sec.notes.find(x => x.n === n.n) || {}).text || '', 'note__text')))));
  }
  if (S.env.canWrite) {
    out.push(h('div', { class: 'addnote' },
      h('select', { class: 'addnote__kind', id: `addnote-${sec.part}`, 'aria-label': 'Kind of note' },
        ['imagery', 'philology', 'doctrine', 'witness'].map(k => h('option', { value: k }, k))),
      h('button', { type: 'button', class: 'link', onclick: e => {
        const kind = e.target.previousElementSibling.value;
        const all = M.current(sec, dsec(sec.part)).notes;
        const maxN = Math.max(unit().notesCount, ...sections().flatMap(s => M.current(s, dsec(s.part)).notes.map(x => x.n)), 0);
        editText(sec.part, { notes: [...all, { n: maxN + 1, kind, text: '', cites: [] }] }, { immediate: true });
        startEdit(sec.part, 'note:' + (maxN + 1));
      } }, 'Add a note')));
  }
  return out;
}

function sectionFoot(sec, d, status) {
  const canAct = S.env.canWrite;
  return h('div', { class: 'foot' },
    h('span', { class: `status status--${status}` }, M.STATUS_LABEL[status]),
    canAct ? h('div', { class: 'foot__actions' },
      h('button', { type: 'button', class: 'btn btn--ok', 'aria-pressed': d?.decision === 'ok' ? 'true' : 'false',
        onclick: e => { e.stopPropagation(); d?.decision === 'ok' ? decidePart(sec.part, null) : approveAndMove(sec.part); } },
        d?.decision === 'ok' ? 'Approved' : 'Approve'),
      h('button', { type: 'button', class: 'btn btn--quiet', 'aria-pressed': d?.decision === 'redraft' ? 'true' : 'false',
        onclick: e => { e.stopPropagation(); S.ui.redraftOpen = S.ui.redraftOpen === sec.part ? null : sec.part; renderSection(sec.part);
          if (S.ui.redraftOpen) setTimeout(() => $(`#next-${sec.part}`)?.focus(), 0); } }, 'Redraft…'),
      M.edited(sec, d) ? h('button', { type: 'button', class: 'btn btn--quiet', onclick: e => { e.stopPropagation(); revertPart(sec.part); } }, 'Undo my edits') : null,
      S.ui.previous?.[sec.part] ? h('span', { class: 'foot__prev', title: 'Your version on the previous draft' }, 'You had edits on the previous draft') : null) : null);
}

function redraftBox(sec, d) {
  const ta = h('textarea', { class: 'ed__ta', id: `next-${sec.part}`, placeholder: 'What should change? Claude reads this when it redrafts.' });
  ta.value = d?.next || '';
  ta.addEventListener('input', () => { autosize(ta); setNextNote(sec.part, ta.value); });
  return h('div', { class: 'redraft' },
    h('label', { class: 'field__label', for: `next-${sec.part}` }, 'Note for the next draft'),
    ta,
    h('div', { class: 'redraft__actions' },
      h('button', { type: 'button', class: 'btn btn--redo', onclick: () => { S.ui.redraftOpen = null; decidePart(sec.part, 'redraft'); announce(`${labelOf(sec)} marked for redraft.`); } }, 'Ask for a redraft'),
      h('button', { type: 'button', class: 'btn btn--quiet', onclick: () => { S.ui.redraftOpen = null; renderSection(sec.part); } }, 'Close')));
}

// ---------------------------------------------------------------- why
function whyBlock(sec, line) {
  if (!S.env.sample) return null;
  const key = sec.part + ':' + line.part;
  const st = whyState.get(key);
  const open = S.ui.whyOpen === key;
  if (!open) {
    return h('button', { type: 'button', class: 'link why__open', onclick: () => { S.ui.whyOpen = key; renderSection(sec.part); setTimeout(() => $(`#why-q-${key.replace(':', '-')}`)?.focus(), 0); } },
      st?.text ? 'Show Claude’s explanation' : 'Why this rendering?');
  }
  const q = h('input', { type: 'text', class: 'why__q', id: `why-q-${key.replace(':', '-')}`, value: st?.question || '', placeholder: 'Why this rendering?', 'aria-label': 'Your question about this line' });
  const out = h('p', { class: 'why__text' }, st?.text || '');
  const err = h('p', { class: 'why__err' }, st?.error || '');
  const ask = h('button', { type: 'button', class: 'btn btn--quiet' }, st?.busy ? 'Thinking…' : 'Ask Claude');
  const stop = h('button', { type: 'button', class: 'btn btn--quiet', hidden: !st?.busy }, 'Stop');
  ask.addEventListener('click', () => runWhy(sec, line, key, q.value, { out, err, ask, stop }));
  q.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); ask.click(); } });
  stop.addEventListener('click', () => whyState.get(key)?.ctl?.abort());
  return h('div', { class: 'why' },
    h('p', { class: 'why__label' }, 'Claude’s explanation, written now. It is not the drafter’s reasoning and it isn’t saved.'),
    h('div', { class: 'why__row' }, q, ask, stop), out, err,
    h('button', { type: 'button', class: 'link', onclick: () => { S.ui.whyOpen = null; renderSection(sec.part); } }, 'Close'));
}

async function runWhy(sec, line, key, question, els) {
  const u = unit(); const meta = textMeta();
  const c = M.current(sec, dsec(sec.part));
  const comment = u.sections.find(s => s.kind === 'comment' && s.anchorPart === sec.part);
  const termIds = new Set([...(line.termHits || []), ...termsOf(c.en[line.part]).map(t => t.id)]);
  const prompt = whyPrompt({
    textTitle: meta.title, songLabel: `${meta.unitLabel} ${u.n}, passage ${sec.label}`,
    line, draftEn: strip(line.en), currentEn: strip(c.en[line.part]),
    neighbours: sec.lines.filter(l => l.part !== line.part).map(l => strip(M.current(sec, dsec(sec.part)).en[l.part])).join(' / '),
    comment: comment ? strip(M.current(comment, dsec(comment.part)).translation) : '',
    terms: [...termIds].map(id => entry(id)).filter(Boolean).map(e => `${e.en} (${e.id}): ${e.definition}`).join('; '),
    question,
  });
  const st = { question, text: '', error: '', busy: true, ctl: new AbortController() };
  whyState.set(key, st);
  els.ask.textContent = 'Thinking…'; els.ask.disabled = true; els.stop.hidden = false; els.err.textContent = ''; els.out.textContent = 'Thinking…';
  try {
    st.text = await askWhy(S.env.sample, prompt, { signal: st.ctl.signal, onText: ({ text }) => { st.text = text; els.out.textContent = text; } });
    els.out.textContent = st.text;
  } catch (e) {
    st.text = e?.text || '';
    els.out.textContent = st.text;
    st.error = WHY_ERRORS[e?.code] ?? 'Claude could not answer just now. Try again, or ask in the session.';
    els.err.textContent = st.error;
    if (e?.code === 'not_granted' || e?.code === 'sampling_disabled') { S.env.sample = null; }
  } finally {
    st.busy = false; els.ask.textContent = 'Ask Claude'; els.ask.disabled = false; els.stop.hidden = true;
  }
}

// ---------------------------------------------------------------- editing & focus
function startEdit(part, field) {
  if (!S.env.canWrite) return;
  finishEdit();
  S.ui.editing = { part, field };
  S.ui.focus = part;
  renderSection(part);
  focusEditor();
}

function focusEditor() {
  setTimeout(() => { const ta = $('.ed__ta'); if (ta) { ta.focus(); const n = ta.value.length; ta.setSelectionRange(n, n); } }, 0);
}

function finishEdit(refocus = false) {
  if (!S.ui.editing) return;
  const { part } = S.ui.editing;
  S.ui.editing = null; S.ui.picker = null;
  sync?.flushAll();
  renderSection(part);
  if (refocus) focusSection(part);
}

function renderSection(part) {
  const old = secEls.get(part) || document.getElementById('s-' + part);
  const sec = secByPart(part);
  if (!old || !sec) return renderGrid();
  const el = buildSection(sec);
  old.replaceWith(el);
  secEls.set(part, el);
  markFocus();
}

/** Update status and labels in place while an editor keeps focus. */
function refreshSectionChrome(part) {
  const el = secEls.get(part); const sec = secByPart(part);
  if (!el || !sec) return;
  const status = M.statusOf(sec, dsec(part));
  el.className = `sec sec--${sec.kind} is-${status}${S.ui.focus === part ? ' is-focused' : ''}`;
  const st = el.querySelector('.status');
  if (st) { st.className = `status status--${status}`; st.textContent = M.STATUS_LABEL[status]; }
  const ok = el.querySelector('.btn--ok');
  if (ok) { const on = dsec(part)?.decision === 'ok'; ok.setAttribute('aria-pressed', on ? 'true' : 'false'); ok.textContent = on ? 'Approved' : 'Approve'; }
  const count = el.querySelector('.field__count');
  if (count && sec.kind === 'comment') { const n = words(strip(M.current(sec, dsec(part)).note)); count.textContent = ` · ${n} of 60 words`; count.classList.toggle('is-over', n > 60); }
}

function focusSection(part) {
  S.ui.focus = part;
  const el = secEls.get(part) || document.getElementById('s-' + part);
  markFocus();
  if (el) { el.focus({ preventScroll: true }); el.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); }
  renderBar();
}

function markFocus() {
  for (const [p, el] of secEls) el.classList.toggle('is-focused', p === S.ui.focus);
}

function moveFocus(delta) {
  const order = sections().filter(s => s.kind !== 'lacuna' && secEls.has(s.part)).map(s => s.part);
  const i = order.indexOf(S.ui.focus);
  const next = order[Math.max(0, Math.min(order.length - 1, (i < 0 ? 0 : i + delta)))];
  if (next) focusSection(next);
}

function firstField(sec) {
  if (sec.kind === 'head') return 'title';
  if (sec.kind === 'comment') return 'translation';
  return 'en:' + sec.lines[0].part;
}

// ---------------------------------------------------------------- panel
function openTerm(id) {
  S.ui.tab = 'terms'; S.ui.termOpen = id;
  if (!songTermIds().includes(id)) S.ui.allTerms = true;
  S.ui.drawer = 'panel'; document.body.dataset.drawer = 'panel';
  renderPanel(); renderTop();
  setTimeout(() => document.getElementById('t-' + id)?.scrollIntoView({ block: 'nearest' }), 0);
}

function songTermIds() {
  const u = unit(); if (!u) return [];
  const ids = new Set(u.termsToDecide);
  for (const s of u.sections) for (const id of M.termsIn(s, dsec(s.part), termsOf)) ids.add(id);
  return [...ids].filter(id => entry(id));
}

function renderPanel() {
  const panel = $('#panel'); if (!panel) return;
  const u = unit();
  const tabs = [['terms', 'Terms'], ['questions', `Questions${u?.questions.length ? ` (${u.questions.length})` : ''}`], ['style', 'Style notes']];
  const head = h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Panel' }, tabs.map(([id, label]) => h('button', {
    type: 'button', role: 'tab', class: 'tab', id: 'tab-' + id, 'aria-selected': S.ui.tab === id ? 'true' : 'false', 'aria-controls': 'tabpanel',
    onclick: () => { S.ui.tab = id; renderPanel(); } }, label)),
    h('button', { type: 'button', class: 'btn btn--quiet only-narrow panel__close', onclick: () => toggleDrawer('panel') }, 'Close'));
  const body = h('div', { class: 'tabpanel', id: 'tabpanel', role: 'tabpanel', 'aria-labelledby': 'tab-' + S.ui.tab });
  append(body, [S.ui.tab === 'terms' ? termsTab() : S.ui.tab === 'questions' ? questionsTab() : styleTab()]);
  fill(panel, head, body);
}

function termsTab() {
  const scope = h('div', { class: 'tools__filter', role: 'group', 'aria-label': 'Which terms' },
    h('button', { type: 'button', class: 'seg', 'aria-pressed': !S.ui.allTerms ? 'true' : 'false', disabled: !unit(), onclick: () => { S.ui.allTerms = false; renderPanel(); } }, 'This song'),
    h('button', { type: 'button', class: 'seg', 'aria-pressed': S.ui.allTerms ? 'true' : 'false', onclick: () => { S.ui.allTerms = true; renderPanel(); } }, 'All terms'));
  const filter = h('input', { type: 'search', class: 'terms__filter', id: 'terms-filter', placeholder: 'Filter terms', 'aria-label': 'Filter terms', value: S.ui.termFilter });
  filter.addEventListener('input', () => { S.ui.termFilter = filter.value; renderTermList(listEl); });
  const listEl = h('div', { class: 'terms' });
  renderTermList(listEl);
  if (!S.glossary.size) {
    return [scope, h('div', { class: 'empty empty--inline' }, h('p', {}, 'Terms Claude proposes appear here for you to approve.'))];
  }
  return [scope, filter, listEl];
}

function renderTermList(listEl) {
  const ids = S.ui.allTerms || !unit() ? [...S.glossary.values()].filter(e => e.text === S.text).map(e => e.id) : songTermIds();
  const f = S.ui.termFilter.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  const all = ids.map(entry).filter(Boolean)
    .filter(e => !f || (e.en + ' ' + e.id + ' ' + e.definition).toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').includes(f));
  const open = all.filter(e => !termDecided(e.id) && gdec(e.id)?.decision !== 'reject');
  const done = all.filter(e => !open.includes(e));
  const fold = s => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const sort = list => list.sort((a, b) => fold(a.en).localeCompare(fold(b.en)));
  fill(listEl, 
    open.length ? h('h3', { class: 'panel__h' }, `To decide (${open.length})`) : null,
    ...sort(open).map(termBlock),
    done.length ? h('h3', { class: 'panel__h' }, `Decided (${done.length})`) : null,
    ...sort(done).map(termBlock));
}

// Readable names for ids ("Munidatta on 1.1" for cp.01.m2), rebuilt when the text's index changes.
let placesFor = null, placesMemo = null;
function places() {
  const m = textMeta();
  if (placesFor !== m) {
    placesFor = m;
    placesMemo = makePlaces({ prefix: m?.idPrefix || '', unitLabel: m?.unitLabel || 'Song', groupLabel: m?.groupLabel || 'passage',
      commentator: m?.commentary || 'the commentary', comments: m?.comments || {} });
  }
  return placesMemo;
}

/** Go to the passage an id names, if that song is in the Studio. */
function canGo(id) {
  const unitId = String(id).split('.').slice(0, 2).join('.');
  return songs().some(x => x.id === unitId && (x.reviewable || x.approved));
}
function goToId(id) {
  const [, , p = ''] = String(id).split('.');
  const unitId = String(id).split('.').slice(0, 2).join('.');
  const part = !p ? 'head' : /^m\d+$/.test(p) ? p : /^h/.test(p) ? 'h' : p.replace(/[a-z]$/, '');
  if (S.ui.drawer === 'panel') toggleDrawer('panel');
  if (unitId !== S.unitId) { chooseSong(unitId); S.ui.pendingFocus = part; }
  else focusSection(part);
}
const placeNode = (id, form = 'long') => canGo(id)
  ? h('button', { type: 'button', class: 'link tb__at', onclick: ev => { ev.stopPropagation(); goToId(id); } }, places()[form](id))
  : places()[form](id);

// Where a form comes from, in words: the glossary's attestation codes (AS, AO…) spelled out.
function formSource(f) {
  const at = places().isId(f.where) ? f.where : '';
  const says = {
    AS: at ? ['in ', placeNode(at)] : null,   // the manuscript, which goes without saying
    AO: f.lang === 'bod' ? (at ? ['in the Tibetan of ', placeNode(at)] : ['in the Tibetan translation']) : ['in another manuscript'],
    AD: ['from the dictionaries'],
    AA: ['an approximation'],
    RP: ['reconstructed from its sound'],
    RS: ['reconstructed from its sense'],
  }[f.att];
  return says ? h('span', { class: 'tb__src', title: !at && f.where ? f.where : null }, ' (', ...says, ')') : null;
}

/**
 * How the image is read: the image, then each reading on its own line with who gives
 * it and where. An edited value is shown as typed.
 */
function symbolicBlock(e, v) {
  const sym = v('symbolic');
  if (!sym) return null;
  const parts = e.symbolicParts;
  if (sym !== e.symbolic || !parts || (!parts.image && !parts.readings.length)) {
    return h('p', { class: 'tb__sym' }, h('span', { class: 'tb__label' }, 'Read symbolically: '), places().text(sym));
  }
  // Group the places by reader: "Munidatta, at 10.2, 10.4".
  const at = r => r.where.length ? [', at ', ...r.where.flatMap((id, i) => [i ? ', ' : null, canGo(id)
    ? h('button', { type: 'button', class: 'link tb__at', onclick: ev => { ev.stopPropagation(); goToId(id); } }, places().ref(id)) : places().ref(id)])] : [];
  return h('div', { class: 'tb__sym' },
    parts.image ? h('p', {}, h('span', { class: 'tb__label' }, 'The image: '), parts.image) : null,
    parts.readings.length ? h('p', { class: 'tb__label' }, 'Read as:') : null,
    parts.readings.length ? h('ul', { class: 'tb__readings' }, parts.readings.map(r => h('li', {}, r.referent,
      h('span', { class: 'tb__src' }, ' (', r.per || 'unattributed', ...at(r), ')')))) : null);
}

/** The entry's forms, one row per language: the word in its script, its transliteration, and where it comes from. */
function formsBlock(e) {
  const meta = textMeta();
  const names = meta?.langNames || {}, html = meta?.htmlLangs || {};
  const byLang = new Map();
  for (const f of e.forms) {
    const list = byLang.get(f.lang) || byLang.set(f.lang, []).get(f.lang);
    if (!list.some(x => x.script === f.script && x.translit === f.translit)) list.push(f);
  }
  if (!byLang.size) return null;
  const open = S.ui.termOpen === e.id;
  return h('dl', { class: 'tb__forms' }, [...byLang].flatMap(([lang, list]) => {
    const shown = open ? list : list.slice(0, 2);
    return [h('dt', {}, names[lang] || lang), h('dd', {},
      ...shown.flatMap((f, i) => [i ? h('span', { class: 'tb__sep', 'aria-hidden': 'true' }, ' · ') : null,
        f.script ? h('span', { class: 'tb__script', lang: html[lang] || null }, f.script) : null, f.script && f.translit ? ' ' : null,
        f.translit ? h('i', { lang: (html[lang] || 'und') + '-Latn' }, f.translit) : null, formSource(f)]),
      list.length > shown.length ? h('span', { class: 'tb__muted' }, ` and ${list.length - shown.length} more`) : null)];
  }));
}

function termBlock(e) {
  const gd = gdec(e.id);
  const live = gd && gd.entrySha === e.entrySha ? gd : null;
  const v = f => A.glossaryValue(e, live, f);
  const expanded = S.ui.termOpen === e.id;
  const state = live?.decision === 'approve' ? 'Approved here' : live?.decision === 'reject' ? 'Rejected here' : live?.decision === 'defer' ? 'Deferred'
    : e.status === 'approved' ? 'Approved' : e.status === 'rejected' ? 'Rejected' : 'Proposed by Claude';
  const decideBtn = (value, label, cls) => h('button', { type: 'button', class: `btn ${cls}`, 'aria-pressed': live?.decision === value ? 'true' : 'false',
    disabled: !S.env.canWrite,
    onclick: () => { glossaryChange(e.id, (g, en) => A.glossaryDecide(g, en, live?.decision === value ? null : value, now()), { immediate: true }); renderPanel(); renderGrid(); renderRail(); } }, label);
  const el = h('article', { class: `tb${expanded ? ' is-open' : ''}`, id: 't-' + e.id },
    h('button', { type: 'button', class: 'tb__head', 'aria-expanded': expanded ? 'true' : 'false', onclick: () => { S.ui.termOpen = expanded ? null : e.id; renderPanel(); } },
      h('span', { class: 'tb__en' }, v('en')), v('type') !== 'term' ? h('span', { class: 'tb__type' }, v('type')) : null, h('span', { class: 'tb__state' }, state)),
    h('p', { class: 'tb__def' }, places().text(v('definition')) || h('i', {}, 'No definition yet')),
    formsBlock(e),
    symbolicBlock(e, v),
    e.usedIn.length ? h('p', { class: 'tb__used' }, 'Our English uses it at ' + [...new Set(e.usedIn)].map(id => places().short(id)).join(', ')) : null,
    h('div', { class: 'tb__actions' }, decideBtn('approve', 'Approve', 'btn--ok'), decideBtn('reject', 'Reject', 'btn--quiet'), decideBtn('defer', 'Later', 'btn--quiet')),
    expanded ? termDetail(e, live, v) : null);
  return el;
}

// An opened term: where it occurs and how it has been rendered, then where to look it up.
// Editing the entry is one step further, so the card stays quiet by default.
function termDetail(e, live, v) {
  if (S.ui.termEdit === e.id) {
    return h('div', { class: 'tb__more' }, termEditor(e, live, v),
      h('button', { type: 'button', class: 'btn btn--quiet tb__editbtn', onclick: () => { S.ui.termEdit = null; renderPanel(); } }, 'Done editing'));
  }
  loadConcord(e.id);
  const c = S.concord.get(e.id);
  const names = textMeta()?.langNames || {};
  const look = lookups(e);
  return h('div', { class: 'tb__more' },
    c === undefined ? h('p', { class: 'tb__muted' }, 'Finding where it occurs…')
      : c === null ? h('p', { class: 'tb__muted' }, 'It does not occur in the source loaded so far.')
      : usageBlock(e, c),
    look.length ? h('div', { class: 'tb__look' }, h('h4', { class: 'tb__h' }, 'Look it up in'),
      ...look.map(r => h('p', { class: 'look' },
        h('span', { class: 'look__form' }, (names[r.lang] || r.lang) + ' ', h('i', {}, r.form)), ' ',
        ...r.links.flatMap((l, i) => [i ? h('span', { class: 'look__sep', 'aria-hidden': 'true' }, ' · ') : null,
          h('a', { href: l.href, target: '_blank', rel: 'noopener noreferrer' }, l.label)])))) : null,
    h('button', { type: 'button', class: 'btn btn--quiet tb__editbtn', disabled: !S.env.canWrite, onclick: () => { S.ui.termEdit = e.id; renderPanel(); } }, 'Edit entry'));
}

function loadConcord(id) {
  if (S.concord.has(id) || !S.env.db) return;
  S.concord.set(id, undefined);
  S.env.db.doc('concord/' + id).get()
    .then(snap => { S.concord.set(id, snap.exists ? snap.data() : null); })
    .catch(() => { S.concord.set(id, null); })
    .finally(() => { if (S.ui.termOpen === id) renderPanel(); });
}

function usageBlock(e, c) {
  const all = S.ui.concordAll === e.id;
  const hits = all ? c.hits : c.hits.slice(0, 5);
  const who = textMeta()?.commentary || 'the commentary';
  const times = n => (n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`);
  const where = c.verse && c.comm ? ` (${c.verse} in the songs, ${c.comm} in ${who}’s commentary)` : c.comm ? ` in ${who}’s commentary` : c.verse ? ' in the songs' : '';
  return [
    c.renderings.length ? h('p', { class: 'tb__rend' }, h('span', { class: 'tb__label' }, 'Translated as '),
      ...c.renderings.flatMap((r, i) => [i ? ', ' : null, '“', h('b', {}, r.surface), '”', h('span', { class: 'tb__count' }, ` ${times(r.n)}`)])) : null,
    c.tibetan?.forms?.length ? h('p', { class: 'tb__rend' }, h('span', { class: 'tb__label' }, 'The Tibetan translators wrote '),
      ...c.tibetan.forms.flatMap((f, i) => [i ? ', ' : null, h('span', { class: 'tb__bo', lang: 'bo' }, f.script), ' ', h('i', { lang: 'bo-Latn' }, f.wylie), h('span', { class: 'tb__count' }, ` ${times(f.n)}`)]),
      h('span', { class: 'tb__count' }, ` (of ${c.tibetan.aligned} ${c.tibetan.aligned === 1 ? 'place that has' : 'places that have'} Tibetan)`)) : null,
    c.total ? h('h4', { class: 'tb__h' }, `Where it occurs: ${c.total} ${c.total === 1 ? 'place' : 'places'}${where}`) : null,
    c.total ? h('ol', { class: 'kwic' }, hits.map(kwicRow)) : null,
    c.hits.length > 5 ? h('button', { type: 'button', class: 'btn btn--quiet kwic__more',
      onclick: () => { S.ui.concordAll = all ? null : e.id; renderPanel(); } }, all ? 'Show fewer' : `Show all ${c.hits.length}`) : null,
    all && c.capped ? h('p', { class: 'tb__muted' }, `The first ${c.hits.length} of ${c.total} are listed.`) : null,
  ];
}

function kwicRow(hit) {
  const meta = textMeta();
  const html = meta?.htmlLangs?.[hit.lang] || '';
  const who = meta?.commentary || 'the commentary';
  const ref = hit.kind === 'comm' ? (hit.on ? `${hit.n}.${hit.on}` : `${hit.n}`) : hit.kind === 'heading' ? `${hit.n}` : `${hit.n}.${hit.part}`;
  const what = hit.kind === 'comm' ? (hit.on ? `${who}’s comment` : `${who}’s introduction`) : hit.kind === 'heading' ? 'Heading' : '';
  const ell = (cut, s, end) => (cut && !(end ? s.endsWith('…') : s.startsWith('…')) ? '…' : '');
  const line = (pre, mid, post, cut, cls, lang, wordPre = '', wordPost = '') => h('p', { class: cls, lang: lang || null },
    ell(cut[0], pre || wordPre || '', false), pre ? pre + ' ' : '', wordPre, h('mark', {}, mid), wordPost,
    post ? (/^[।॥|,;.:]/u.test(post) ? '' : ' ') + post : '', ell(cut[1], post || wordPost || '', true));
  // Our English, with the term marked where it is rendered.
  const en = () => {
    const i = hit.surface ? hit.en.indexOf(hit.surface) : -1;
    return h('p', { class: 'kwic__en' }, ...(i < 0 ? [hit.en] : [hit.en.slice(0, i), h('mark', {}, hit.surface), hit.en.slice(i + hit.surface.length)]));
  };
  return h('li', { class: 'kwic__row' },
    h('button', { type: 'button', class: 'kwic__ref', title: `Go to ${places().long(hit.id)}`, onclick: () => goToHit(hit) }, ref),
    h('div', { class: 'kwic__body' },
      what ? h('p', { class: 'kwic__who' }, what) : null,
      hit.en ? en() : null,
      line(hit.pre, hit.hit, hit.post, hit.cut, 'kwic__src', html, hit.wordPre, hit.wordPost),
      hit.tlHit ? line(hit.tlPre, hit.tlHit, hit.tlPost, hit.cut, 'kwic__tl', html ? html + '-Latn' : '', hit.tlWordPre, hit.tlWordPost) : null,
      S.ui.parallel && hit.bo ? h('div', { class: 'kwic__bo' },
        hit.bo.at ? [line(hit.bo.at.pre, hit.bo.at.hit, hit.bo.at.post, hit.bo.at.cut, 'kwic__src', 'bo'),
          line(hit.bo.at.tlPre, hit.bo.at.tlHit, hit.bo.at.tlPost, hit.bo.at.cut, 'kwic__tl', 'bo-Latn')]
          : [h('p', { class: 'kwic__src', lang: 'bo' }, hit.bo.src), h('p', { class: 'kwic__tl', lang: 'bo-Latn' }, hit.bo.translit)]) : null));
}

function goToHit(hit) {
  const part = hit.kind === 'comm' ? hit.part : hit.kind === 'heading' ? 'h' : hit.part.replace(/[a-z]$/, '');
  if (S.ui.drawer === 'panel') toggleDrawer('panel');
  if (hit.unit !== S.unitId) { chooseSong(hit.unit); S.ui.pendingFocus = part; }
  else focusSection(part);
}

function termEditor(e, live, v) {
  const row = (field, label, input) => h('label', { class: 'tf' }, h('span', { class: 'tf__label' }, label), input);
  const text = (field, multiline) => {
    const val = v(field);
    const el = multiline ? h('textarea', { class: 'tf__input', id: `tf-${e.id}-${field}` }) : h('input', { type: 'text', class: 'tf__input', id: `tf-${e.id}-${field}` });
    el.value = Array.isArray(val) ? val.join('; ') : val || '';
    el.disabled = !S.env.canWrite;
    el.addEventListener('input', () => {
      const value = ['alt', 'variants', 'never'].includes(field) ? el.value.split(';').map(s => s.trim()).filter(Boolean) : el.value;
      glossaryChange(e.id, (g, en) => A.glossaryEdit(g, en, field, value, now()));
      if (multiline) autosize(el);
    });
    el.addEventListener('change', () => renderPanel());
    if (multiline) queueMicrotask(() => autosize(el));
    return el;
  };
  const select = (field, options) => {
    const el = h('select', { class: 'tf__input', id: `tf-${e.id}-${field}`, disabled: !S.env.canWrite },
      options.map(o => h('option', { value: o, selected: v(field) === o }, o)));
    el.addEventListener('change', () => { glossaryChange(e.id, (g, en) => A.glossaryEdit(g, en, field, el.value, now()), { immediate: true }); renderPanel(); });
    return el;
  };
  return h('div', { class: 'tb__edit' },
    row('en', 'English', text('en')),
    row('type', 'Type', select('type', ['term', 'person', 'place', 'text'])),
    row('policy', 'Policy', select('policy', ['translate', 'keep-source', 'keep-source-first-gloss'])),
    row('definition', 'Definition', text('definition', true)),
    row('symbolic', 'Image → reading (who, passage)', text('symbolic', true)),
    row('alt', 'Other renderings (separate with ;)', text('alt')),
    row('variants', 'Accepted variants (plural, possessive)', text('variants')),
    row('never', 'Never inside a verse line', text('never')),
    h('p', { class: 'tb__note' }, 'Changing a field clears an approval, so you approve exactly what you see.'));
}

function questionsTab() {
  const u = unit();
  if (!u) return [h('p', { class: 'empty empty--inline' }, 'Choose a song to see the drafter’s questions.')];
  if (!u.questions.length) return [h('p', { class: 'empty empty--inline' }, 'The drafter had no questions about this song.')];
  const answers = new Map((liveDecision()?.answers || []).map(a => [a.q, a.a]));
  return [h('p', { class: 'panel__lead' }, 'Your answers travel with this song to the next draft.'),
    ...u.questions.map((q, i) => {
      const ta = h('textarea', { class: 'tf__input', id: `qa-${i}`, placeholder: 'Your answer', disabled: !S.env.canWrite });
      ta.value = answers.get(q) || '';
      ta.addEventListener('input', () => { autosize(ta); answerQuestion(q, ta.value); });
      queueMicrotask(() => autosize(ta));
      return h('div', { class: 'qa' }, h('label', { class: 'qa__q', for: `qa-${i}` }, q), ta);
    })];
}

function styleTab() {
  const meta = textMeta();
  const style = (meta?.style || '').split('\n').filter(l => /^\s*-\s+\S/.test(l)).map(l => l.replace(/^\s*-\s+/, ''));
  return [
    h('p', { class: 'panel__lead' }, 'Standing preferences Claude follows in every draft of this text.'),
    style.length ? h('ul', { class: 'style' }, style.map(s => h('li', {}, s))) : h('p', { class: 'empty empty--inline' }, 'No style notes yet.'),
    promptBox(`Add to my style notes for ${meta?.title || 'this text'}: …`),
  ];
}

// ---------------------------------------------------------------- bottom bar (phones) and sheets
function renderBar() {
  const bar = $('#bar'); if (!bar) return;
  const sec = secByPart(S.ui.focus);
  if (!sec || !M.reviewable(sec) || !S.env.canWrite) { fill(bar); return; }
  const d = dsec(sec.part);
  fill(bar, 
    h('span', { class: 'bar__where' }, labelOf(sec)),
    h('button', { type: 'button', class: 'btn btn--ok', onclick: () => approveAndMove(sec.part) }, d?.decision === 'ok' ? 'Approved' : 'Approve'),
    h('button', { type: 'button', class: 'btn btn--quiet', onclick: () => startEdit(sec.part, firstField(sec)) }, 'Edit'),
    h('button', { type: 'button', class: 'btn btn--quiet', onclick: () => { S.ui.redraftOpen = sec.part; renderSection(sec.part); focusSection(sec.part); } }, 'Redraft'));
}

function renderSheet() {
  const sheet = $('#sheet'); if (!sheet) return;
  if (!S.ui.sheet) { sheet.hidden = true; fill(sheet); return; }
  const close = () => { S.ui.sheet = null; renderSheet(); $('#grid')?.focus(); };
  let body;
  if (S.ui.sheet === 'keys') {
    const rows = [['J or ↓', 'Next passage'], ['K or ↑', 'Previous passage'], ['E or Enter', 'Edit the passage'], ['Esc', 'Stop editing'],
      ['Ctrl+Enter', 'Approve and go to the next passage'], ['Ctrl+Shift+Enter', 'Approve and go to the next that needs attention'],
      ['R', 'Ask for a redraft, with a note'], ['Ctrl+K', 'Insert a glossary term while editing'], ['D', 'Show changes from Claude’s draft'], ['T', 'Show the Tibetan translation'],
      ['[ and ]', 'Previous and next song'], ['T', 'Terms'], ['?', 'This list']];
    body = [h('h2', { class: 'sheet__h', id: 'sheet-h' }, 'Keyboard'),
      h('p', { class: 'panel__lead' }, 'Single keys work when a passage has focus. Every action also has a button.'),
      h('dl', { class: 'keys' }, rows.map(([k, v]) => [h('dt', {}, h('kbd', {}, k)), h('dd', {}, v)]))];
  } else if (S.ui.sheet === 'send') {
    const u = unit(); const meta = textMeta(); const p = u ? M.progress(u, liveDecision()) : { ok: 0, redraft: 0, total: 0 };
    const left = p.total - p.ok - p.redraft;
    body = [h('h2', { class: 'sheet__h', id: 'sheet-h' }, 'Sent to Claude'),
      h('p', {}, `${meta.unitLabel} ${u?.n} is marked ready. ${p.ok} approved, ${p.redraft} for redraft${left ? `, ${left} still undecided (they stay in review)` : ''}.`),
      h('p', {}, 'The Studio can’t reach Claude by itself. Paste this into the Claude Code session:'),
      promptBox(`Pull my Studio decisions for ${meta.title}.`),
      h('p', { class: 'panel__lead' }, 'When Claude has read them, this song shows “Claude has this”.')];
  }
  sheet.hidden = false;
  fill(sheet, h('div', { class: 'sheet__card', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'sheet-h' },
    ...body, h('div', { class: 'sheet__actions' }, h('button', { type: 'button', class: 'btn btn--primary', id: 'sheet-close', onclick: close }, 'Done'))));
  setTimeout(() => $('#sheet-close')?.focus(), 0);
}

// ---------------------------------------------------------------- navigation
function chooseText(slug) {
  S.text = slug; store('studio:text', slug);
  const first = songs().find(s => s.id === store('studio:song:' + slug)) || songs().find(s => s.reviewable || s.approved);
  chooseSong(first?.id || '');
}

function chooseSong(id) {
  finishEdit();
  S.unitId = id; S.unit = null; S.ui.focus = 'head'; S.ui.filter = 'all'; S.ui.previous = null;
  if (id) { store('studio:song:' + S.text, id); sync?.watchUnit(id); }
  if (S.ui.drawer === 'rail') toggleDrawer('rail');
  renderAll();
}

function songStep(delta) {
  const list = songs().filter(s => s.reviewable || s.approved);
  const i = list.findIndex(s => s.id === S.unitId);
  const next = list[i + delta];
  if (next) chooseSong(next.id);
}

// ---------------------------------------------------------------- keyboard
function onKey(ev) {
  if (S.ui.sheet) { if (ev.key === 'Escape') { ev.preventDefault(); S.ui.sheet = null; renderSheet(); } return; }
  const t = ev.target;
  const typing = t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.isContentEditable);
  if (typing) return;           // editors handle their own keys
  const mod = ev.ctrlKey || ev.metaKey;
  const inSection = t && t.closest && t.closest('.sec');
  const sec = secByPart(S.ui.focus);
  if (mod && ev.key === 'Enter' && sec) { ev.preventDefault(); approveAndMove(sec.part, { attentionOnly: ev.shiftKey }); return; }
  if (mod || ev.altKey) return;
  if (ev.key === '?') { ev.preventDefault(); S.ui.sheet = 'keys'; renderSheet(); return; }
  if (ev.key === '[') { songStep(-1); return; }
  if (ev.key === ']') { songStep(1); return; }
  if (ev.key === 'Escape' && S.ui.drawer) { toggleDrawer(S.ui.drawer); return; }
  const onGrid = inSection || t === $('#grid') || t === document.body;
  if (!onGrid) return;
  if (ev.key === 'j' || ev.key === 'ArrowDown') { ev.preventDefault(); moveFocus(1); }
  else if (ev.key === 'k' || ev.key === 'ArrowUp') { ev.preventDefault(); moveFocus(-1); }
  else if ((ev.key === 'e' || ev.key === 'Enter') && sec && inSection && t.tagName !== 'BUTTON' && t.tagName !== 'A') { ev.preventDefault(); startEdit(sec.part, firstField(sec)); }
  else if (ev.key === 'r' && sec && M.reviewable(sec)) { ev.preventDefault(); S.ui.redraftOpen = sec.part; renderSection(sec.part); setTimeout(() => $(`#next-${sec.part}`)?.focus(), 0); }
  else if (ev.key === 'd') { S.ui.diff = !S.ui.diff; renderGrid(); announce(S.ui.diff ? 'Showing changes from Claude’s draft.' : 'Showing your text.'); }
  else if (ev.key === 't' && unit()?.parallels?.length) { setParallel(!S.ui.parallel); announce(S.ui.parallel ? 'Showing the Tibetan.' : 'Tibetan hidden.'); }
  else if (ev.key === 't') { S.ui.tab = 'terms'; renderPanel(); }
}

// ---------------------------------------------------------------- data in
function onCollection(name, docs) {
  if (name === 'meta') {
    S.meta = docs;
    if (!S.text || !S.meta.has('text-' + S.text)) {
      const texts = [...docs.values()].filter(m => m.slug);
      const remembered = store('studio:text');
      const pick = texts.find(m => m.slug === remembered) || texts[0];
      if (pick) { S.text = pick.slug; const song = pick.songs.find(s => s.id === store('studio:song:' + pick.slug)) || pick.songs.find(s => s.reviewable || s.approved); if (song) { S.unitId = song.id; sync.watchUnit(song.id); } }
    }
  } else if (name === 'glossary') S.glossary = docs;
  else if (name === 'receipts') S.receipts = docs;
  else if (name === 'decisions') {
    for (const [id, doc] of docs) if (!sync.dirty('decisions/' + id)) S.decisions.set(id, doc);
  } else if (name === 'glossaryDecisions') {
    for (const [id, doc] of docs) if (!sync.dirty('glossaryDecisions/' + id)) S.gdecisions.set(id, doc);
  }
  S.loaded.add(name);
  if (!S.env.started && ['meta', 'glossary', 'decisions', 'glossaryDecisions'].every(n => S.loaded.has(n))) S.env.started = true;
  if (!S.env.started) return;
  if (name === 'decisions' && S.ui.editing) { renderTop(); renderRail(); renderBanner(); return; }
  scheduleRender();
}

function onUnit(id, doc) {
  if (id !== S.unitId) return;
  if (doc && doc.v > 1) { S.unit = null; S.env.fatal = { code: 'version' }; renderBanner(); return; }
  S.unit = doc;
  if (S.ui.editing) return;          // never pull the text out from under an editor
  scheduleRender();
}

let pending = 0;
function scheduleRender() {
  if (pending) return;
  pending = requestAnimationFrame(() => {
    pending = 0;
    if (!S.ui.editing) renderAll(); else { renderTop(); renderRail(); renderPanel(); renderBanner(); }
    // A concordance line in another song: focus its passage once that song has loaded.
    if (S.ui.pendingFocus && unit()) { const p = S.ui.pendingFocus; S.ui.pendingFocus = null; focusSection(p); }
  });
}

// ---------------------------------------------------------------- boot
function renderAbsent(reason) {
  $('#app').removeAttribute('aria-busy');
  fill($('#app'), h('div', { class: 'absent' },
    h('p', { class: 'brand' }, h('span', { class: 'brand__mark', 'aria-hidden': 'true' }, '॥'), h('span', { class: 'brand__name' }, 'Studio')),
    h('h1', { class: 'absent__title' }, 'Open this Studio in Claude'),
    h('p', {}, reason === 'top'
      ? 'This page is a private review workspace. It works only inside claude.ai or the Claude app, where it can reach its database.'
      : 'This Studio keeps your review in its own database, and this view can’t reach it. Open it in claude.ai or the Claude app, signed in as its owner.'),
    h('p', { class: 'panel__lead' }, 'Nothing is lost: the drafts and your decisions are stored with the Studio, not in this browser.')));
}

export async function boot() {
  document.addEventListener('keydown', onKey);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') sync?.flushAll(); });
  renderAll();
  if (!window.claude || typeof window.claude.use !== 'function') { S.env.noClaude = true; renderAbsent('top'); return; }
  const [db, user, sample] = await Promise.all([window.claude.use('db'), window.claude.use('user'), window.claude.use('sample')]);
  if (!db) { renderAbsent('db'); return; }
  S.env.db = db;
  S.env.sample = sample || null;
  if (user) { const can = await user.can('data.write'); S.env.canWrite = can !== false; }
  sync = createSync(db, {
    onCollection, onUnit,
    onSaveState: state => { S.save = state; renderTop(); },
    onFatal: e => { S.env.fatal = e; S.env.canWrite = false; renderBanner(); renderTop(); },
  });
}
