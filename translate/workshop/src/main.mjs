// The Workshop, second design: the poem first. One couplet at a time on the
// stage, typed straight into the poem that grows beside it; the lens and the
// heat set once, above; Claude's ideas under the lines, on request. Plain DOM:
// every string from the data or the shelf goes in as text, never as markup.
import * as en from '../../lib/english.mjs';
import { englishBoard, compareBoards, temperature, CHANNELS, CHANNEL_NAMES } from '../../lib/board.mjs';
import { makeRooms } from './rooms.mjs';

const DATA = JSON.parse(document.getElementById('data').textContent);
const CMU = 'https://cdn.jsdelivr.net/npm/cmu-pronouncing-dictionary@3.0.0/index.js';
const KEY = 'charyapada-workshop-v2';
const OLD_KEY = 'charyapada-workshop-v1';

function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of kids.flat(Infinity)) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
}
const $ = id => document.getElementById(id);
const say = msg => { $('live').textContent = msg; };
const today = () => new Date().toISOString().slice(0, 10);
const clamp = x => Math.max(0, Math.min(1, x));
const r2 = x => Math.round(x * 100) / 100;
const meanOf = b => CHANNELS.reduce((n, ch) => n + b[ch], 0) / CHANNELS.length;
const shiftTo = (base, t) => { const d = t - meanOf(base); return Object.fromEntries(CHANNELS.map(ch => [ch, r2(clamp(base[ch] + d))])); };
const firstSentences = (s, n = 2) => (String(s).match(/[^.!?]+[.!?]+/g) || [s]).slice(0, n).join('').trim();

// ------------------------------------------------------------------ state

const load = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
const stored = load(KEY) || {};
const old = stored.folios ? null : load(OLD_KEY);
const firstSong = (DATA.songs.find(s => s.id === 'cp.14') || DATA.songs[0]).id;
const OWN = { id: 'own', name: 'No lens', after: 'Your own way', how: 'No poet stands behind this one: the board alone guides the ideas, and your ear does the rest.', why: '', touchstone: '' };
const LENSES = [...DATA.lenses, OWN];
const VIEWS = [['write', 'Write'], ['poems', 'Your poems'], ['practice', 'Practice'], ['study', 'Study'], ['shelf', 'Shelf'], ['guide', 'How to read']];
const TRADITIONS = [['english', 'English'], ['sufi', 'Sufi'], ['zen', 'Zen'], ['shakespeare', 'Shakespeare'], ['bardic', 'Bardic']];
const S = {
  view: VIEWS.some(([v]) => v === stored.view) ? stored.view : 'write',
  song: DATA.songs.some(s => s.id === stored.song) ? stored.song : firstSong,
  group: stored.group || old?.group || {},
  lens: LENSES.some(l => l.id === stored.lens) ? stored.lens : 'shanty',
  base: stored.base || null,
  temp: typeof stored.temp === 'number' ? stored.temp : null,
  latitude: stored.latitude === 'free' ? 'free' : 'close',
  folios: stored.folios || old?.folios || {},
  ideas: stored.ideas || {},
  drafts: stored.drafts || {},
  showBn: stored.showBn !== false,
  showStress: !!stored.showStress,
  busy: null, ear: 'spelling', notes: {},
  shelf: [], me: null, names: {}, sample: undefined, db: undefined, user: undefined,
};
let saveTimer = 0;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ view: S.view, song: S.song, group: S.group, lens: S.lens, base: S.base, temp: S.temp, latitude: S.latitude,
        folios: S.folios, ideas: S.ideas, drafts: S.drafts, showBn: S.showBn, showStress: S.showStress }));
    } catch { /* a private window keeps the poem only while the page is open */ }
  }, 250);
}

const song = () => DATA.songs.find(s => s.id === S.song);
const lens = () => LENSES.find(l => l.id === S.lens) || LENSES[0];
const lensTrad = () => S.lensTrad || (lens().id === 'own' ? 'english' : lens().tradition || 'english');
const lensById = id => LENSES.find(l => l.id === id);
const songBoard = s => Object.fromEntries(CHANNELS.map(ch => [ch, s.board[ch].heat]));
function board() {
  const base = S.base || (S.lens === 'own' ? songBoard(song()) : { ...lens().board });
  return S.temp == null ? { ...base } : shiftTo(base, S.temp);
}
const group = () => { const s = song(); return s.couplets.some(c => c.group === S.group[s.id]) ? S.group[s.id] : s.couplets[0].group; };
const couplet = g => song().couplets.find(c => c.group === g);
const linesOf = g => song().lines.filter(l => l.group === g);
function folio(id = S.song) {
  return (S.folios[id] ||= { title: '', voice: '', refrainCue: '', lines: {}, notes: {}, added: [], lens: '', dbId: '' });
}
const doneCount = s => s.lines.filter(l => (folio(s.id).lines[l.id] || '').trim()).length;
const coupletDone = g => linesOf(g).every(l => (folio().lines[l.id] || '').trim());

function refrainCue(f, s) {
  const first = s.lines.find(l => l.refrain);
  const t = first && (f.lines[first.id] || '').trim();
  if (!t) return '';
  const kept = String(f.refrainCue || '').trim().replace(/[…\s.]+$/, '');
  if (kept && t.startsWith(kept)) return kept;
  return t.split(/\s+/).slice(0, 4).join(' ').replace(/[,;:.!?—–]+$/, '');
}

// ------------------------------------------------------------------ the ear

const PLAIN = { absolute: 'the same word again', perfect: 'a full rhyme', vowel: 'a vowel rhyme', off: 'a near rhyme', para: 'a para rhyme', eye: 'an eye rhyme', alliteration: 'only alliteration', none: 'no rhyme' };
const HINTS = {
  lineation: x => (x >= 0.75 ? 'short, even lines, each closed; the refrain back word for word' : x >= 0.45 ? 'mostly closed lines of like length' : 'lines of different lengths that run on'),
  syntax: x => (x >= 0.75 ? 'phrases side by side: and… and…, commas, commands' : x >= 0.45 ? 'mostly side by side, a clause hung here and there' : 'phrases hung under others: when, because, which'),
  rhythm: x => (x >= 0.75 ? 'one steady beat, the same count every line' : x >= 0.45 ? 'a beat that bends' : 'speech rhythm, lines of different beats'),
  rhyme: x => (x >= 0.9 ? 'the same word again: refrain and mantra' : x >= 0.7 ? 'full rhymes' : x >= 0.5 ? 'vowel rhymes' : x >= 0.3 ? 'near rhymes' : x >= 0.15 ? 'para rhyme: the consonants kept, the vowel changed' : 'little or no rhyme'),
};
function hearCouplet(a, b) {
  const sa = en.scan(a || ''), sb = en.scan(b || '');
  return { beats: [sa.beats, sb.beats], rhyme: a && b ? en.rhymeLines(a, b) : { kind: 'none', a: '', b: '' } };
}
function hearView(c, a, b) {
  const p = h('p', { class: 'hear' });
  const src = c.kind;
  if (!a.trim() || !b.trim()) {
    p.append(src === 'none' ? 'The Bengali does not rhyme here, so your couplet need not.' : `The Bengali rhymes here (${c.ends.join(' / ')}): ${PLAIN[src]}.`);
    return p;
  }
  const x = hearCouplet(a, b);
  const mine = en.PLANETS[x.rhyme.kind].heat, theirs = en.PLANETS[src].heat;
  p.append(`${x.beats[0]} and ${x.beats[1]} beats. `);
  if (x.rhyme.kind === 'none') p.append('No rhyme');
  else p.append(h('b', { text: `${x.rhyme.a} / ${x.rhyme.b}` }), `: ${PLAIN[x.rhyme.kind]}`);
  if (src === 'none') p.append('; the Bengali does not rhyme here.');
  else if (mine >= theirs - 0.15) p.append('; ', h('span', { class: 'good', text: `as warm as the Bengali's ${PLAIN[src].replace(/^a /, '')}.` }));
  else p.append('; ', h('span', { class: 'warn', text: `the Bengali has ${PLAIN[src]} here (${c.ends.join(' / ')}). Pay it back another way, or say what the trade buys.` }));
  return p;
}
function forbiddenIn(lineId, text) {
  const l = song().lines.find(x => x.id === lineId);
  const plain = ` ${String(text || '').toLowerCase().replace(/[^\p{L}\s'-]/gu, ' ')} `;
  const hits = new Map();
  for (const f of l?.forbidden || []) if (plain.includes(` ${f.word.toLowerCase()} `)) hits.set(f.word, f.term);
  return [...hits].map(([word, term]) => `“${word}”: the glossary keeps that reading out of this line (${term} stays an image)`);
}
function scanView(text) {
  const box = h('div', { class: 'scan', 'aria-hidden': 'true' });
  for (const w of en.scan(text || '').words) {
    box.append(h('span', { class: 'w' }, h('span', { class: 'w__t', text: w.raw }), h('span', { class: 'w__m' }, ...w.stress.map(s => (s ? h('b', { text: '/' }) : '×')))));
  }
  return box;
}
async function loadEar() {
  try { const m = await import(CMU); en.useDictionary(m.dictionary); S.ear = 'dictionary'; } catch { S.ear = 'spelling'; }
  if (S.view === 'write') { refreshHear(); renderPoem(); }
  if (rooms.has(S.view)) rooms.rerender([S.view]);
}

// ------------------------------------------------------------------ capabilities

async function cap(name) {
  try { return window.claude?.use ? await window.claude.use(name) : null; } catch { return null; }
}
async function connect() {
  const [sample, db, user] = await Promise.all([cap('sample'), cap('db'), cap('user')]);
  S.sample = sample || false; S.db = db || false; S.user = user || false;
  if (user) { try { S.me = await user.id(); } catch { S.me = null; } }
  if (db) {
    db.collection('versions').onSnapshot(snap => {
      S.shelf = snap.docs.map(d => ({ dbId: d.id, ...d.data() }));
      renderShelf(); resolveNames();
    }, () => { S.db = false; renderShelf(); });
  }
  renderStageActions(); renderPoem(); renderShelf();
  rooms.connect();
}
async function resolveNames() {
  const ids = [...new Set(S.shelf.map(v => v.makerId).filter(id => id && !(id in S.names)))];
  if (!ids.length || !S.user) return;
  try {
    const ps = await S.user.profiles(ids);
    for (const id of ids) S.names[id] = (ps && ps[id] && ps[id].name) || '';
    renderShelf();
  } catch { /* names stay unknown */ }
}
const nameOf = id => (id && id === S.me ? 'you' : S.names[id] || 'someone');

// ------------------------------------------------------------------ toast

let toastTimer = 0;
function toast(text, undo) {
  const t = $('toast');
  t.replaceChildren(h('span', { text }), undo ? h('button', { class: 'btn btn--small', onclick: () => { undo(); t.hidden = true; }, text: 'Undo' }) : '');
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, undo ? 7000 : 3500);
  say(text);
}
function snapshot() { return JSON.stringify(folio()); }
function restore(snap) { S.folios[S.song] = JSON.parse(snap); persist(); renderWrite(); }

// ------------------------------------------------------------------ the bar

function renderBar() {
  $('songs').replaceChildren(...DATA.songs.map(s => h('button', {
    class: 'pill', 'aria-current': s.id === S.song ? 'true' : 'false',
    onclick: () => { S.song = s.id; S.base = S.base && S.lens !== 'own' ? S.base : null; persist(); renderAll(); },
  }, h('b', { text: s.no }), h('span', { text: s.title }))));
  $('songs').hidden = rooms.has(S.view);
  $('views').replaceChildren(...VIEWS.map(([id, label]) => h('button', {
    'aria-current': S.view === id ? 'true' : 'false', onclick: () => setView(id), text: label,
  })));
}
function setView(v) {
  S.view = v;
  for (const [id] of VIEWS) $(id).hidden = id !== v;
  persist();
  renderBar();
  if (v === 'shelf') renderShelf();
  if (v === 'guide') renderGuide();
  if (rooms.has(v)) rooms.rerender([v]);
  window.scrollTo({ top: 0 });
}

// ------------------------------------------------------------------ how: lens and heat

function renderHow() {
  const s = song(), L = lens(), b = board(), t = meanOf(b), songT = meanOf(songBoard(s));
  const word = h('span', { class: 'temp__word', text: `runs ${temperature(t)}` });
  const tick = h('span', { class: 'temp__song', text: 'the song' });
  tick.style.left = `${songT * 100}%`;
  const slider = h('input', { type: 'range', min: '0', max: '100', value: String(Math.round(t * 100)), 'aria-label': 'Temperature: cool to hot',
    oninput: e => { const x = Number(e.target.value) / 100; if (!S.base) S.base = board(); S.temp = x; word.textContent = `runs ${temperature(x)}`; persist(); renderTune(); } });
  const tune = h('details', { class: 'tune', id: 'tune' }, h('summary', { text: 'Fine-tune the four channels' }), h('div', { class: 'faders', id: 'faders' }));
  $('how').replaceChildren(
    h('div', { class: 'how__row' }, h('span', { class: 'label', text: 'Write it as' }),
      h('span', { class: 'seg', role: 'group', 'aria-label': 'Tradition' }, ...TRADITIONS.filter(([t]) => LENSES.some(x => (x.tradition || 'english') === t)).map(([t, label]) => h('button', {
        'aria-pressed': lensTrad() === t ? 'true' : 'false', onclick: () => { S.lensTrad = t; renderHow(); }, text: label }))),
      h('div', { class: 'lenses', role: 'group', 'aria-label': 'Lens' }, ...LENSES.filter(x => x.id === 'own' || (x.tradition || 'english') === lensTrad()).map(x => h('button', {
        class: 'chip', 'aria-pressed': x.id === S.lens ? 'true' : 'false', title: x.after,
        onclick: () => { S.lens = x.id; S.base = null; S.temp = null; persist(); renderHow(); },
      }, x.name)))),
    h('p', { class: 'how__lens' }, h('i', { text: L.after.replace(/^after /, 'After ') }), '. ', firstSentences(L.how)),
    h('div', { class: 'how__row' },
      h('span', { class: 'label', text: 'Heat' }),
      h('div', { class: 'temp' }, h('div', { class: 'temp__track' }, tick, slider), word),
      h('button', { class: 'btn btn--link btn--small', onclick: () => { S.base = songBoard(s); S.temp = null; persist(); renderHow(); }, text: 'As hot as the song' }),
      h('span', { class: 'seg', role: 'group', 'aria-label': 'Latitude' },
        ...[['close', 'Stay close'], ['free', 'Take liberties']].map(([x, label]) => h('button', { 'aria-pressed': S.latitude === x ? 'true' : 'false', title: x === 'close' ? 'Every image, none added' : 'May add what an image implies, and says so', onclick: () => { S.latitude = x; persist(); renderHow(); }, text: label })))),
    tune);
  renderTune();
}
function renderTune() {
  const box = $('faders');
  if (!box) return;
  const b = board(), s = song();
  box.replaceChildren(...CHANNELS.map(ch => {
    const val = h('span', { class: 'fader__val quiet', text: temperature(b[ch]) });
    const hint = h('p', { class: 'fader__hint', text: `${HINTS[ch](b[ch])} · the song: ${temperature(s.board[ch].heat)}` });
    return h('label', { class: 'fader' }, h('span', { class: 'label', text: CHANNEL_NAMES[ch] }),
      h('input', { type: 'range', min: '0', max: '100', value: String(Math.round(b[ch] * 100)),
        oninput: e => { const x = Number(e.target.value) / 100; S.base = { ...board(), [ch]: r2(x) }; S.temp = null; val.textContent = temperature(x); hint.textContent = `${HINTS[ch](x)} · the song: ${temperature(s.board[ch].heat)}`; persist(); } }),
      val, hint);
  }));
}

// ------------------------------------------------------------------ the stage

function renderStage() {
  const s = song(), g = group(), c = couplet(g), ls = linesOf(g), f = folio();
  const idx = s.couplets.findIndex(x => x.group === g);
  const dots = h('div', { class: 'dots', role: 'group', 'aria-label': 'Couplets' }, ...s.couplets.map((x, i) => h('button', {
    class: `dot${coupletDone(x.group) ? ' is-done' : ''}${x.refrain ? ' is-refrain' : ''}`, 'aria-current': x.group === g ? 'true' : 'false',
    'aria-label': `Couplet ${x.no}${x.refrain ? ', the refrain' : ''}${coupletDone(x.group) ? ', written' : ''}`, onclick: () => go(x.group), text: String(i + 1),
  })));
  const tl = h('p', { class: 'src__tl', lang: 'bn-Latn' });
  ls.forEach((l, i) => { if (i) tl.append(h('span', { class: 'sep', text: '/' })); tl.append(l.tl, h('span', { class: 'rh', text: l.tlEnd })); });

  const fields = h('div', { class: 'lines', id: 'lines' });
  ls.forEach((l, i) => {
    const ta = h('textarea', { rows: '1', 'data-line': l.id, 'aria-label': `Your line ${l.part} of couplet ${c.no}`, placeholder: i ? 'and the second…' : 'Your first line…', spellcheck: 'true' });
    ta.value = f.lines[l.id] || '';
    ta.addEventListener('input', () => { f.lines[l.id] = ta.value; fit(ta); persist(); refreshHear(); renderPoem(); renderDots(); });
    ta.addEventListener('keydown', e => {
      if (e.key !== 'Enter' || e.shiftKey) return;
      e.preventDefault();
      const next = fields.querySelectorAll('textarea')[i + 1];
      if (next) next.focus();
      else if (idx < s.couplets.length - 1) { go(s.couplets[idx + 1].group); focusFirst(); }
    });
    fields.append(h('div', { class: 'line' }, ta, h('span', { class: 'beats', 'data-beats': l.id })), h('div', { 'data-scan': l.id }));
  });
  fields.append(h('div', { id: 'hear' }));

  const noteBox = h('details', { class: 'gloss' }, h('summary', { text: 'Note what this couplet keeps and lets go (optional)' }),
    h('dl', {}, ...[['kept', 'Kept'], ['letGo', 'Let go']].map(([k, label]) => {
      const inp = h('input', { class: 'noteinput', value: f.notes[g]?.[k] || '', placeholder: k === 'kept' ? 'what your English keeps of the sound, image or feeling' : 'what it gives up' });
      inp.addEventListener('input', () => { (f.notes[g] ||= { kept: '', letGo: '' })[k] = inp.value; persist(); });
      return h('div', {}, h('dt', { text: label }), h('dd', {}, inp));
    })));

  $('stage').replaceChildren(
    h('div', { class: 'stage__head' },
      h('p', { class: 'stage__where' }, `Couplet ${idx + 1} of ${s.couplets.length}`, h('small', { text: [c.refrain && 'the refrain', c.bhanita && 'the poet signs'].filter(Boolean).join(' · ') })),
      dots),
    doneCount(s) ? '' : h('p', { class: 'note', text: 'Write two lines for each couplet: type them in the box below, or ask for suggestions and use the ones you like. Enter moves you on. Your poem grows beside the song, and saves itself as you go.' }),
    h('div', { class: 'src' },
      ...ls.map(l => h('p', { class: 'src__bn', lang: 'bn' }, l.bn ? l.bn + ' ' : '', h('span', { class: 'rh', text: l.bnEnd }), l.part === 'b' ? h('span', { class: 'dd', text: ' ॥' }) : '')),
      tl,
      h('p', { class: 'means' }, h('span', { class: 'label', text: 'It says' }), ...ls.map(l => h('span', { text: l.en }))),
      h('details', { class: 'gloss' }, h('summary', { text: 'Word by word' }),
        h('dl', {}, ...ls.flatMap(l => [h('div', {}, h('dt', { text: `line ${l.part}` }), h('dd', { text: l.gloss })), l.sung ? h('div', {}, h('dt', { text: 'sung' }), h('dd', { text: l.sung })) : ''])))),
    fields,
    h('div', { id: 'stage-acts' }),
    noteBox,
    h('div', { class: 'ideas', id: 'ideas' }));
  for (const ta of fields.querySelectorAll('textarea')) fit(ta);
  refreshHear();
  renderStageActions();
  renderIdeas();
}
function fit(ta) { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; }
function focusFirst() { setTimeout(() => $('lines')?.querySelector('textarea')?.focus(), 0); }
function go(g) { S.group[S.song] = g; persist(); renderStage(); renderPoem(); }
function renderDots() {
  const s = song();
  document.querySelectorAll('.dot').forEach((d, i) => d.classList.toggle('is-done', coupletDone(s.couplets[i].group)));
}
function refreshHear() {
  const g = group(), c = couplet(g), ls = linesOf(g), f = folio();
  for (const l of ls) {
    const t = f.lines[l.id] || '';
    const b = document.querySelector(`[data-beats="${l.id}"]`);
    if (b) b.textContent = t.trim() ? `${en.scan(t).beats} beats` : '';
    const sc = document.querySelector(`[data-scan="${l.id}"]`);
    if (sc) sc.replaceChildren(S.showStress && t.trim() ? scanView(t) : '');
  }
  const warn = ls.flatMap(l => forbiddenIn(l.id, f.lines[l.id]));
  const box = $('hear');
  if (box) box.replaceChildren(hearView(c, f.lines[ls[0].id] || '', f.lines[ls[1]?.id] || ''), ...warn.map(w => h('p', { class: 'hear warn', text: w })));
}
function renderStageActions() {
  const box = $('stage-acts');
  if (!box) return;
  const s = song(), g = group(), idx = s.couplets.findIndex(x => x.group === g);
  box.replaceChildren(h('div', { class: 'acts' },
    h('button', { class: 'btn btn--go', disabled: !S.sample || S.busy ? true : null, onclick: () => make('couplet'), text: '✦ Suggest lines' }),
    h('button', { class: 'btn btn--link', 'aria-pressed': S.showStress ? 'true' : 'false', onclick: () => { S.showStress = !S.showStress; persist(); refreshHear(); renderStageActions(); }, text: S.showStress ? 'Hide stresses' : 'Show stresses' }),
    h('span', { class: 'spacer' }),
    h('span', { class: 'acts nav' },
      h('button', { class: 'btn', disabled: idx === 0 ? true : null, onclick: () => { go(s.couplets[idx - 1].group); focusFirst(); }, text: '‹ Previous' }),
      h('button', { class: 'btn', disabled: idx === s.couplets.length - 1 ? true : null, onclick: () => { go(s.couplets[idx + 1].group); focusFirst(); }, text: 'Next ›' }))),
  h('div', { class: 'status', id: 'status' }),
  S.sample === false ? h('p', { class: 'note', text: 'Suggestions come from Claude when this page is open in Claude and you allow it. Writing, the ear and the poem work without it.' }) : '',
  S.notes.make ? h('p', { class: `note ${S.notes.make.kind || ''}`, text: S.notes.make.text }) : '');
  renderStatus();
}

// ------------------------------------------------------------------ ideas

function ideasFor(g) { return (S.ideas[g] ||= []); }
function renderIdeas() {
  const box = $('ideas');
  if (!box) return;
  const g = group(), ls = linesOf(g), c = couplet(g), f = folio(), s = song();
  const mine = ideasFor(g);
  const examples = mine.length ? [] : s.examples.map(x => {
    const a = x.lines.find(l => l.id === ls[0].id)?.en, b = x.lines.find(l => l.id === ls[1]?.id)?.en;
    const n = x.couplets.find(k => k.group === g) || {};
    return a && b ? { a, b, kept: n.kept || '', letGo: n.letGo || '', lens: x.lens, from: 'example', title: x.title } : null;
  }).filter(Boolean);
  const list = [...mine, ...examples];
  if (!list.length) { box.replaceChildren(); return; }
  box.replaceChildren(
    h('div', { class: 'ideas__head' }, h('span', { class: 'label', text: mine.length ? 'Ideas' : 'From the examples' }),
      mine.length ? h('button', { class: 'btn btn--link btn--small', onclick: () => { S.ideas[g] = []; persist(); renderIdeas(); }, text: 'Clear' }) : ''),
    ...list.map(v => {
      const used = (f.lines[ls[0].id] || '') === v.a && (f.lines[ls[1]?.id] || '') === v.b;
      const warn = [...forbiddenIn(ls[0].id, v.a), ...forbiddenIn(ls[1]?.id, v.b)];
      const x = hearCouplet(v.a, v.b);
      const L = lensById(v.lens);
      const why = h('p', { class: 'idea__why', hidden: true }, v.kept ? `Kept: ${v.kept} ` : '', v.letGo ? `Let go: ${v.letGo}` : '', v.added?.length ? ` Added: ${v.added.join('; ')}` : '');
      return h('article', { class: `idea${used ? ' is-used' : ''}` },
        h('div', { class: 'idea__lines' }, h('p', { text: v.a }), h('p', { text: v.b })),
        h('p', { class: 'idea__meta' }, h('b', { text: v.from === 'example' ? `from “${v.title}”` : L ? L.name : 'Claude' }),
          ` · ${PLAIN[x.rhyme.kind]} · ${x.beats[0]} and ${x.beats[1]} beats${v.shift ? ` · ${v.shift}` : ''}`),
        ...warn.map(w => h('p', { class: 'idea__warn', text: w })),
        why,
        h('div', { class: 'idea__acts' },
          h('button', { class: 'btn btn--link btn--small', disabled: warn.length || used ? true : null, onclick: () => useIdea(g, v), text: used ? 'In your poem' : 'Use these lines' }),
          h('button', { class: 'btn btn--link btn--small', disabled: !S.sample || S.busy ? true : null, onclick: () => make('hotter', v), text: 'Hotter' }),
          h('button', { class: 'btn btn--link btn--small', disabled: !S.sample || S.busy ? true : null, onclick: () => make('cooler', v), text: 'Cooler' }),
          v.kept || v.letGo ? h('button', { class: 'btn btn--link btn--small', onclick: e => { why.hidden = !why.hidden; e.target.textContent = why.hidden ? 'Why' : 'Hide why'; }, text: 'Why' }) : '',
          v.from !== 'example' ? h('button', { class: 'btn btn--link btn--small', onclick: () => { mine.splice(mine.indexOf(v), 1); persist(); renderIdeas(); }, text: 'Dismiss' }) : ''));
    }));
}
function useIdea(g, v) {
  const f = folio(), ls = linesOf(g);
  const had = ls.some(l => (f.lines[l.id] || '').trim());
  const snap = snapshot();
  f.lines[ls[0].id] = v.a; if (ls[1]) f.lines[ls[1].id] = v.b;
  f.notes[g] = { kept: v.kept || '', letGo: v.letGo || '' };
  if (v.added?.length) f.added = [...new Set([...(f.added || []), ...v.added])];
  f.lens = v.lens || S.lens;
  persist(); renderStage(); renderPoem();
  toast(had ? 'Replaced your lines.' : `Couplet ${couplet(g).no} is in your poem.`, had ? () => restore(snap) : null);
}

// ------------------------------------------------------------------ making with Claude

function songBlock(s) {
  const out = [`## The song: ${s.id}, ${s.poet}${s.raga ? `, rāga ${s.raga}` : ''}: "${s.title}"`, s.summary, '',
    'Each half-line: id · Old Bengali · transliteration · word by word · accurate English' + (s.lines.some(l => l.sung) ? ' · sung English' : '')];
  for (const l of s.lines) {
    const tags = [l.refrain && 'refrain', l.bhanita && 'the poet signs'].filter(Boolean);
    out.push(`- ${l.id}${tags.length ? ` (${tags.join(', ')})` : ''} · ${l.bn} ${l.bnEnd} · ${l.tl}${l.tlEnd} · ${l.gloss} · ${l.en}${l.sung ? ` · ${l.sung}` : ''}`);
  }
  return out.join('\n');
}
function buildPrompt(kind, base) {
  const s = song(), L = lens(), b = board(), f = folio(), g = group(), ls = linesOf(g);
  const forb = s.lines.filter(l => l.forbidden?.length).map(l => `- ${l.id}: ${[...new Set(l.forbidden.map(x => x.word))].join(', ')}`);
  const set = s.lines.filter(l => (f.lines[l.id] || '').trim()).map(l => `- ${l.id}: ${f.lines[l.id].trim()}`);
  const parts = [DATA.prompt,
    L.id === 'own' ? '## The lens: none. Write in plain, living English of your own; let the board guide the music.'
      : `## The lens: ${L.name}, ${L.after}\n${L.how}\nWhy this lens: ${L.why}` + (L.touchstone ? `\nTouchstone (to hear, never to borrow): ${L.touchstone}` : ''),
    `## The maker's board (0 cool .. 1 hot)\n${CHANNELS.map(ch => `- ${ch} ${b[ch]}: ${HINTS[ch](b[ch])}`).join('\n')}`,
    `## Latitude: ${S.latitude}`,
    `## Voice: ${f.voice || s.sungVoice || '(find it)'}`,
    songBlock(s),
    `## How the song works (the source's mixing board)\n${s.reading}`,
    forb.length ? `## Words that must never stand in these lines (the glossary keeps the reading out of the image)\n${forb.join('\n')}` : '',
    `## The teaching's words keep this English: ${DATA.teaching.map(t => t.en).join(', ')}`,
    set.length ? `## Lines the maker has already written (keep the poem consistent with them; do not rewrite them unless asked)\n${set.join('\n')}` : '',
  ];
  const variantJson = `{"variants":[{"a":"the line for ${ls[0].id}","b":"the line for ${ls[1]?.id}","kept":"…","letGo":"…","added":[]}]}`;
  if (kind === 'couplet') {
    parts.push(`## What to make\nMake three versions of couplet ${g} only (lines ${ls.map(l => l.id).join(' and ')}); the rest of the song is context. Make them different enough to be worth choosing between: one on the board as set, one that risks more in the lens's manner, one plainer. Reply with only this JSON, no other text:\n${variantJson}`);
  } else if (kind === 'hotter' || kind === 'cooler') {
    parts.push(`## What to make\nHere is a version of couplet ${g}:\n${ls[0].id}: ${base.a}\n${ls[1]?.id}: ${base.b}\nMake two new versions of this couplet that run about a quarter ${kind} on every channel than this one (${kind === 'hotter' ? 'hotter: more repetition, a rhyme nearer the sun, a steadier beat, lines closed' : 'cooler: less repetition, a looser rhyme or none, speech rhythm, a line that runs on'}), keeping every rule and every image. Reply with only this JSON, no other text:\n${variantJson}`);
  } else {
    parts.push(`## What to make\nMake the whole poem, every half-line, in order${set.length ? ', keeping the lines the maker has already written exactly as they are' : ''}. Reply with only this JSON, no other text:\n{"title":"…","voice":"…","refrainCue":"the opening words of your refrain","lines":[${s.lines.map(l => `{"id":"${l.id}","en":"…"}`).join(',')}],"couplets":[${s.couplets.map(c => `{"group":"${c.group}","kept":"…","letGo":"…"}`).join(',')}],"added":[]}`);
  }
  return parts.filter(Boolean).join('\n\n');
}

const ERR = {
  not_granted: 'Suggestions were not allowed for this page. Writing and the ear still work.',
  sampling_disabled: 'Claude is not available for this account here.',
  rate_limited: 'Claude is busy or your usage limit is near; try again in a minute.',
  refused: 'Claude declined that one. Try another lens or heat.',
  invalid_json: 'The answer came back in a shape the page could not read. Try again.',
  prompt_too_large: 'The request was too large.',
  session_expired: 'Sign in to Claude again, then try.',
};
async function make(kind, base) {
  const sample = S.sample;
  if (!sample || S.busy) return;
  const ctl = new AbortController();
  const g = group(), s = song();
  S.busy = { kind, started: Date.now(), ctl, chars: 0 };
  S.notes.make = null;
  renderStageActions(); renderIdeas(); renderPoem();
  const tick = setInterval(renderStatus, 1000);
  try {
    const out = await sample.json(buildPrompt(kind, base), {
      signal: ctl.signal, cache: false, modelTier: kind === 'song' ? 'complex' : 'default',
      onText: ({ text }) => { if (S.busy) S.busy.chars = text.length; },
    });
    const lensId = S.lens, lat = S.latitude, b0 = board();
    if (kind === 'song') {
      const lines = Object.fromEntries((Array.isArray(out?.lines) ? out.lines : []).filter(l => l && typeof l.id === 'string' && typeof l.en === 'string').map(l => [l.id, l.en.trim()]));
      if (!s.lines.every(l => lines[l.id])) throw { code: 'invalid_json' };
      S.drafts[s.id] = { lines, couplets: Array.isArray(out.couplets) ? out.couplets.map(c => ({ group: String(c.group || ''), kept: String(c.kept || ''), letGo: String(c.letGo || '') })) : [],
        title: String(out.title || ''), voice: String(out.voice || ''), refrainCue: String(out.refrainCue || ''), added: Array.isArray(out.added) ? out.added.map(String) : [], lens: lensId, latitude: lat, board: b0 };
      toast('Claude\'s draft of the whole poem is above your poem.');
      setTimeout(() => { const p = $('poem'); p.scrollTop = 0; if (window.matchMedia('(max-width: 980px)').matches) p.scrollIntoView({ behavior: 'smooth' }); }, 50);
    } else {
      const vs = (Array.isArray(out?.variants) ? out.variants : []).filter(v => v && typeof v.a === 'string' && typeof v.b === 'string' && v.a.trim() && v.b.trim());
      if (!vs.length) throw { code: 'invalid_json' };
      ideasFor(g).unshift(...vs.map(v => ({ a: v.a.trim(), b: v.b.trim(), kept: String(v.kept || ''), letGo: String(v.letGo || ''), added: Array.isArray(v.added) ? v.added.map(String) : [],
        lens: lensId, latitude: lat, board: b0, from: 'claude', shift: kind === 'couplet' ? '' : kind })));
      say(`${vs.length} ideas for couplet ${couplet(g).no}.`);
    }
    persist();
  } catch (e) {
    if (e?.code !== 'cancelled') {
      if (['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed'].includes(e?.code)) S.sample = false;
      S.notes.make = { kind: 'warn', text: ERR[e?.code] || 'Something went wrong on the way; try again.' };
      say(S.notes.make.text);
    }
  } finally {
    clearInterval(tick);
    S.busy = null;
    if (S.view === 'write') { renderStageActions(); renderIdeas(); renderPoem(); }
  }
}
function renderStatus() {
  const box = $('status');
  if (!box) return;
  if (!S.busy) { box.replaceChildren(); return; }
  const secs = Math.round((Date.now() - S.busy.started) / 1000);
  const what = { couplet: 'three ideas', song: 'the whole poem', hotter: 'two hotter ideas', cooler: 'two cooler ideas' }[S.busy.kind];
  box.replaceChildren(h('span', { class: 'pulse', 'aria-hidden': 'true' }),
    `${S.busy.chars ? 'Writing' : 'Thinking about'} ${what}… ${secs}s`,
    h('button', { class: 'btn btn--link btn--small', onclick: () => S.busy?.ctl.abort(), text: 'Stop' }));
}

// ------------------------------------------------------------------ the poem

function stanzaView(s, lines, { here = '', onpick = null, cue = '' } = {}) {
  const refrainIdx = s.couplets.findIndex(c => c.refrain);
  return h('ol', { class: 'stanzas' }, ...s.couplets.map((c, i) => {
    const ls = linesOf(c.group);
    const mine = ls.map(l => (lines[l.id] || '').trim());
    return h('li', { class: `st${c.refrain ? ' is-refrain' : ''}${c.group === here ? ' is-here' : ''}`, onclick: onpick ? () => onpick(c.group) : null },
      h('span', { class: 'st__no', text: String(i + 1) }),
      h('div', {},
        h('p', { class: 'st__bn', lang: 'bn', text: ls.map(l => `${l.bn} ${l.bnEnd}`).join(' । ') }),
        h('div', { class: 'st__en' }, ...(mine.some(Boolean) ? mine.map(t => h('p', {}, t || h('span', { class: 'gap', text: '…' }))) : [h('p', {}, h('span', { class: 'gap', text: 'not written yet' }))])),
        cue && refrainIdx >= 0 && i > refrainIdx && mine.some(Boolean) ? h('p', { class: 'st__cue', text: cue + '…' }) : ''));
  }));
}
function renderPoem() {
  const s = song(), f = folio(), g = group();
  const done = doneCount(s), total = s.lines.length;
  const L = lensById(f.lens || S.lens);
  const first = s.lines[0]?.bn || s.lines[0]?.bnEnd || '';
  const init = typeof Intl !== 'undefined' && Intl.Segmenter ? [...new Intl.Segmenter('bn', { granularity: 'grapheme' }).segment(first)][0]?.segment : first.charAt(0);
  const title = h('input', { class: 'plate__title', value: f.title, placeholder: s.title, 'aria-label': 'Title of your poem' });
  title.addEventListener('input', () => { f.title = title.value; persist(); });
  const voice = h('textarea', { placeholder: s.sungVoice || 'Whose voice, to whom, in what mood?', 'aria-label': 'The voice' });
  voice.value = f.voice;
  voice.addEventListener('input', () => { f.voice = voice.value; persist(); });
  const progress = h('div', { class: 'progress' }, `${done} of ${total} lines`, h('i', {}));
  progress.lastChild.style.setProperty('--p', `${Math.round(done / total * 100)}%`);

  let compare = '';
  const written = s.lines.filter(l => (f.lines[l.id] || '').trim());
  if (written.length >= 2) {
    const unit = { lines: s.lines.map(l => ({ id: l.id, group: l.group, role: 'line' })) };
    const mine = englishBoard(unit, written.map(l => ({ id: l.id, en: f.lines[l.id] })));
    const advice = compareBoards({ channels: s.board, couplets: s.couplets.map(c => ({ ...c, heat: en.PLANETS[c.kind].heat })) }, mine, { label: 'yours' }).filter(a => !/^cp\./.test(a));
    compare = h('details', {}, h('summary', { text: 'How hot it runs, against the song' }),
      h('ul', { class: 'compare' }, ...CHANNELS.map(ch => h('li', { text: `${CHANNEL_NAMES[ch]}: yours ${temperature(mine.channels[ch].heat)}, the song ${temperature(s.board[ch].heat)}` })),
        ...advice.map(a => h('li', { text: a }))));
  }
  const draft = S.drafts[s.id];
  const draftBox = draft ? h('div', { class: 'draft' },
    h('p', { class: 'label', text: `Claude's draft of the whole poem${draft.title ? `: “${draft.title}”` : ''}` }),
    stanzaView(s, draft.lines),
    h('div', { class: 'acts' },
      h('button', { class: 'btn btn--small', onclick: () => useDraft(draft, false), text: 'Use it all' }),
      done ? h('button', { class: 'btn btn--small', onclick: () => useDraft(draft, true), text: 'Fill only my empty lines' }) : '',
      h('button', { class: 'btn btn--link btn--small', onclick: () => { delete S.drafts[s.id]; persist(); renderPoem(); }, text: 'Discard' }))) : '';

  $('poem').replaceChildren(draftBox, h('div', { class: `plate${S.showBn ? '' : ' no-bn'}` },
    h('div', { class: 'plate__holes', 'aria-hidden': 'true' }, h('i'), h('i')),
    h('div', { class: 'plate__head' },
      h('div', { class: 'init', lang: 'bn', 'aria-hidden': 'true', text: init || '' }),
      title,
      h('p', { class: 'plate__by', text: `${L && L.id !== 'own' ? L.after.replace(/^after /, 'after ') : 'in your own way'} · from ${DATA.text.unitLabel.toLowerCase()} ${s.no}, ${s.poet}` })),
    stanzaView(s, f.lines, { here: g, onpick: gg => { go(gg); if (window.matchMedia('(max-width: 980px)').matches) $('stage').scrollIntoView({ behavior: 'smooth' }); }, cue: refrainCue(f, s) }),
    h('div', { class: 'plate__foot' },
      progress,
      done < total ? h('div', { class: 'acts' },
        h('button', { class: 'btn', disabled: !S.sample || S.busy || draft ? true : null, onclick: () => make('song'), text: done ? '✦ Draft the rest with Claude' : '✦ Draft the whole poem with Claude' })) : '',
      h('div', { class: 'acts' },
        h('button', { class: 'btn btn--go', disabled: !S.db || done < total ? true : null, title: done < total ? 'Finish every line first' : '', onclick: save, text: 'Save to the shelf' }),
        h('button', { class: 'btn', disabled: done < total ? true : null, onclick: copyForEngine, text: 'Copy' })),
      h('div', { class: 'acts minor' },
        'speechSynthesis' in window && done ? h('button', { class: 'btn btn--link btn--small', onclick: hearAloud, text: 'Read it aloud' }) : '',
        h('button', { class: 'btn btn--link btn--small', onclick: () => { S.showBn = !S.showBn; persist(); renderPoem(); }, text: S.showBn ? 'Hide the Bengali' : 'Show the Bengali' }),
        done ? h('button', { class: 'btn btn--link btn--small', onclick: startAgain, text: 'Start again' }) : ''),
      S.notes.plate ? h('p', { class: `note ${S.notes.plate.kind || ''}`, text: S.notes.plate.text }) : '',
      S.notes.copy || '',
      h('details', {}, h('summary', { text: 'The voice (optional)' }), voice),
      compare,
      S.db === false && done === total ? h('p', { class: 'note', text: 'The shared shelf opens when this page is viewed in Claude; Copy works anywhere.' }) : '')));
}
function useDraft(d, emptyOnly) {
  const s = song(), f = folio(), snap = snapshot();
  for (const l of s.lines) if (d.lines[l.id] && (!emptyOnly || !(f.lines[l.id] || '').trim())) f.lines[l.id] = d.lines[l.id];
  for (const c of d.couplets || []) if (!emptyOnly || !f.notes[c.group]) f.notes[c.group] = { kept: c.kept, letGo: c.letGo };
  if (d.title && !f.title) f.title = d.title;
  if (d.voice && !f.voice) f.voice = d.voice;
  if (!emptyOnly) { f.refrainCue = d.refrainCue || ''; f.lens = d.lens; f.added = d.added || []; }
  delete S.drafts[s.id];
  persist(); renderStage(); renderPoem();
  toast(emptyOnly ? 'The draft filled your empty lines.' : 'The draft is now your poem.', () => restore(snap));
}
function startAgain() {
  const snap = snapshot();
  delete S.folios[S.song]; S.notes = {}; persist(); renderStage(); renderPoem();
  toast('Your poem is cleared.', () => restore(snap));
}
function hearAloud() {
  try {
    const s = song(), f = folio();
    speechSynthesis.cancel();
    speechSynthesis.speak(new SpeechSynthesisUtterance(s.lines.map(l => f.lines[l.id]).filter(Boolean).join('. ')));
  } catch { /* no voice in this view */ }
}

// ------------------------------------------------------------------ keeping

function versionDoc() {
  const s = song(), f = folio();
  return {
    unit: s.id, title: f.title.trim(), lens: f.lens || S.lens, latitude: S.latitude, board: board(),
    voice: f.voice.trim(), refrainCue: refrainCue(f, s),
    lines: s.lines.map(l => ({ id: l.id, en: (f.lines[l.id] || '').trim() })),
    couplets: s.couplets.map(c => ({ group: c.group, kept: f.notes[c.group]?.kept || '', letGo: f.notes[c.group]?.letGo || '' })),
    added: f.added || [], note: '',
  };
}
function problems(doc) {
  const out = [];
  for (const l of doc.lines) for (const w of forbiddenIn(l.id, l.en)) out.push(`line ${l.id.split('.').slice(1).join('.')}: ${w}`);
  return out;
}
async function save() {
  const doc = versionDoc(), f = folio();
  const p = problems(doc);
  if (p.length) { S.notes.plate = { kind: 'warn', text: p.join('; ') }; renderPoem(); return; }
  try {
    const col = S.db.collection('versions');
    const mine = f.dbId && S.shelf.find(v => v.dbId === f.dbId && v.makerId && v.makerId === S.me);
    const ref = mine ? col.doc(f.dbId) : col.doc();
    await ref.set({ ...doc, makerId: S.me || '', made: today(), updatedAt: new Date().toISOString() });
    f.dbId = ref.id; persist();
    S.notes.plate = null;
    toast(mine ? 'Saved over your copy on the shelf.' : 'Saved to the shelf.');
  } catch (e) {
    S.notes.plate = { kind: 'warn', text: e?.code === 'invalid_argument' ? 'You can read the shelf but not add to it; ask the page\'s owner to make you a Contributor.' : 'The shelf did not take it; try again in a moment.' };
  }
  renderPoem();
}
async function copyForEngine() {
  const doc = versionDoc();
  const p = problems(doc);
  if (p.length) { S.notes.plate = { kind: 'warn', text: p.join('; ') }; renderPoem(); return; }
  let by = '';
  if (S.user && S.me) { try { const ps = await S.user.profiles([S.me]); by = ps?.[S.me]?.name || ''; } catch { /* unnamed */ } }
  const text = JSON.stringify({ versions: [{ ...doc, by, made: today(), via: 'workshop' }] }, null, 2);
  const cmd = `node translate/cli.mjs versions import ${DATA.text.slug} version.json${by ? '' : ' --by "Your Name"'}`;
  try {
    await navigator.clipboard.writeText(text);
    S.notes.copy = null;
    S.notes.plate = { kind: 'ok', text: `Copied as JSON for the edition. Save it as version.json, then run: ${cmd}` };
  } catch {
    const box = h('textarea', { class: 'copybox', readonly: true, 'aria-label': 'Your poem as JSON for the edition' });
    box.value = text;
    S.notes.copy = box;
    S.notes.plate = { kind: '', text: `Copy this, save it as version.json, then run: ${cmd}` };
    setTimeout(() => { box.focus(); box.select(); }, 0);
  }
  renderPoem();
}

// ------------------------------------------------------------------ the shelf

function renderShelf() {
  if (S.view !== 'shelf') return;
  const s = song();
  const made = S.shelf.filter(v => v.unit === s.id).sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  const unit = { lines: s.lines.map(l => ({ id: l.id, group: l.group, role: 'line' })) };
  const card = (v, from) => {
    const L = lensById(v.lens);
    const lines = Object.fromEntries((v.lines || []).map(l => [l.id, l.en]));
    const heard = englishBoard(unit, v.lines || []);
    return h('article', { class: 'card' },
      h('h3', { text: v.title || s.title }),
      h('p', { class: 'card__by', text: `${L && L.id !== 'own' ? L.after : 'in its own way'} · ${from === 'edition' ? `by ${v.by}` : `by ${nameOf(v.makerId)}`}${v.made ? `, ${v.made}` : ''}` }),
      h('div', { class: 'card__lines' }, ...(v.lines || []).slice(0, 2).map(l => h('p', { text: l.en }))),
      h('p', { class: 'idea__meta', text: `rhyme ${temperature(heard.channels.rhyme.heat)} · rhythm ${temperature(heard.channels.rhythm.heat)} · ${v.latitude === 'free' ? 'takes liberties' : 'stays close'}` }),
      h('details', {}, h('summary', { text: 'Read it all' }),
        h('div', { class: 'poemtext' }, ...s.couplets.map(c => h('p', { class: c.refrain ? 'rf' : '' }, ...linesOf(c.group).flatMap((l, i) => [i ? h('br') : '', lines[l.id] || '']))))),
      h('div', { class: 'acts' }, h('button', { class: 'btn btn--small', onclick: () => openVersion(v, from), text: 'Work from this' })));
  };
  $('shelf').replaceChildren(
    h('h2', { class: 'sec-h', id: 'shelf-h', text: `The shelf: ${s.title}` }),
    h('p', { class: 'sec-lede', text: `Poems made from ${DATA.text.unitLabel.toLowerCase()} ${s.no}: saved here by anyone with this page, and the edition's own examples. Work from one to make it yours; saving makes a new copy unless it was yours already.` }),
    S.db === false ? h('p', { class: 'note', text: 'The shared shelf opens when this page is viewed in Claude; the edition\'s examples are here either way.' }) : '',
    h('div', { class: 'grid' }, ...made.map(v => card(v, 'shelf')), ...s.examples.map(v => card(v, 'edition'))));
}
function openVersion(v, from) {
  const s = song(), snap = snapshot();
  S.folios[s.id] = {
    title: v.title || '', voice: v.voice || '', refrainCue: v.refrainCue || '', lens: v.lens, added: v.added || [],
    lines: Object.fromEntries((v.lines || []).map(l => [l.id, l.en])),
    notes: Object.fromEntries((v.couplets || []).map(c => [c.group, { kept: c.kept || '', letGo: c.letGo || '' }])),
    dbId: from === 'shelf' && v.makerId === S.me ? v.dbId : '',
  };
  if (lensById(v.lens)) S.lens = v.lens;
  S.base = v.board ? { ...v.board } : null; S.temp = null;
  if (v.latitude) S.latitude = v.latitude;
  persist(); setView('write'); renderWrite();
  toast(`“${v.title || s.title}” is open in your poem.`, () => restore(snap));
}

// ------------------------------------------------------------------ the guide

function heatBar(x) { const b = h('div', { class: 'heat' }); b.style.setProperty('--h', String(clamp(x))); return b; }
function renderGuide() {
  if (S.view !== 'guide') return;
  const s = song();
  $('guide').replaceChildren(
    h('h2', { class: 'sec-h', id: 'guide-h', text: 'Read the song before you sing it' }),
    h('p', { class: 'sec-lede', text: 'The method is Timothy Morton\'s, from his course How to Read a Poem: describe what the song does before deciding what it means, and read out of it, never into it.' }),
    h('div', { class: 'guide__cols' },
      h('div', { class: 'card' }, h('h3', { text: 'Five steps, in order' }), h('ol', {},
        h('li', {}, h('b', { text: 'Structure. ' }), 'Lines and phrases: couplets closed by ॥, the refrain (ধ্রু) coming round, phrases laid side by side.'),
        h('li', {}, h('b', { text: 'Texture. ' }), 'Rhythm is line, rhyme is colour. Count stresses, not syllables; find the groove, then what breaks it.'),
        h('li', {}, h('b', { text: 'Perception. ' }), 'What it makes you see, in order. Keep strange things strange: a riddle solved in the line is lost.'),
        h('li', {}, h('b', { text: 'Narrator. ' }), 'Who sings to whom, how close. The poet signs his song by name; a call like "hey" keeps its bite.'),
        h('li', {}, h('b', { text: 'Narrative. ' }), 'Where it turns, from A to not-A. Turn at the same couplet, as hard.'))),
      h('div', { class: 'card' }, h('h3', { text: 'Hot and cool' }),
        h('p', { text: 'Every channel of a song runs from cool (variation, surprise, speech) to hot (repetition, pattern, the mantra). The Heat slider moves all four; Fine-tune moves one. The gold mark shows the Bengali. Match it, or trade knowingly: a lost rhyme repaid by a name struck twice.' }),
        h('table', { class: 'planets' },
          h('thead', {}, h('tr', {}, h('th', { text: 'Rhyme' }), h('th', { text: 'What chimes' }), h('th', { text: 'Heat' }))),
          h('tbody', {}, ...Object.entries(en.PLANETS).filter(([k]) => k !== 'eye').map(([k, p]) => h('tr', {}, h('td', { text: k }), h('td', { text: p.says }), h('td', {}, heatBar(p.heat))))))),
      h('div', { class: 'card' }, h('h3', { text: 'Ways to make' }), h('ul', {},
        h('li', {}, h('b', { text: 'Hotter, cooler. ' }), 'Make the couplet twice, one hotter and one cooler, and keep the one nearer the song. Every idea has the two buttons.'),
        h('li', {}, h('b', { text: 'Twinkle, twinkle, little bat. ' }), 'Put nonsense on the Bengali\'s beat to hear the groove your English has to find.'),
        h('li', {}, h('b', { text: 'The blank sheet. ' }), 'Look at the leaf before the words: its lengths, its repeats, its ধ্রু. That shape is the first thing to keep.'),
        h('li', {}, h('b', { text: 'Read it aloud. ' }), 'Stress is relative; only the voice settles it. Show stresses marks the ear\'s guess.'))),
      h('div', { class: 'card' }, h('h3', { text: 'The lenses' }), ...DATA.lenses.map(x => h('div', { class: 'lensinfo' },
        h('b', { text: x.name }), h('span', { text: `${x.after}. ${x.how}` }), x.why ? h('span', { text: x.why }) : ''))),
      h('div', { class: 'card' }, h('h3', { text: 'Three Englishes' }),
        h('p', { text: 'The edition keeps an accurate translation (the meaning, line for line) and a sung version (the song\'s shape, held close). A poem made here is the third kind, what Dryden called an imitation: the freest, made through a way English poets made songs, and it says what it changed. Pound made Cathay from Fenollosa\'s word-by-word notes; the gloss on this page is that notebook.' })),
      h('div', { class: 'card' }, h('h3', { text: `${DATA.text.unitLabel} ${s.no}, read` }), h('pre', { class: 'reading', text: s.reading }))));
}

// ------------------------------------------------------------------ start

function renderWrite() { renderHow(); renderStage(); renderPoem(); }
function renderAll() { renderBar(); renderWrite(); renderShelf(); renderGuide(); rooms.rerender(); }

const rooms = makeRooms({ h, $, DATA, say, toast, heatBar, ERR, env: () => ({ sample: S.sample, db: S.db, me: S.me }) });
for (const [id] of VIEWS) $(id).hidden = id !== S.view;
renderAll();
connect();
if ('requestIdleCallback' in window) requestIdleCallback(() => loadEar(), { timeout: 2500 }); else setTimeout(loadEar, 600);
