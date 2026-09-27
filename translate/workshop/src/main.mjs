// The Workshop page. Plain DOM: every string from the data or the shelf goes
// in as text, never as markup. Capabilities (sample, db, user) light features
// up when they resolve; without them the page still reads, scans and drafts.
import * as en from '../../lib/english.mjs';
import { englishBoard, compareBoards, temperature, CHANNELS, CHANNEL_NAMES } from '../../lib/board.mjs';

const DATA = JSON.parse(document.getElementById('data').textContent);
const CMU = 'https://cdn.jsdelivr.net/npm/cmu-pronouncing-dictionary@3.0.0/index.js';
const KEY = 'charyapada-workshop-v1';

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
const r2 = x => Math.round(x * 100) / 100;
const upper = t => t.charAt(0).toUpperCase() + t.slice(1);

// ------------------------------------------------------------------ state

const stored = (() => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { return {}; } })();
const firstSong = (DATA.songs.find(s => s.id === 'cp.14') || DATA.songs[0]).id;
const S = {
  song: DATA.songs.some(s => s.id === stored.song) ? stored.song : firstSong,
  group: stored.group || {},
  lens: DATA.lenses.some(l => l.id === stored.lens) ? stored.lens : 'shanty',
  board: stored.board || null,
  latitude: stored.latitude === 'free' ? 'free' : 'close',
  folios: stored.folios || {},
  variants: stored.variants || {},
  busy: null,
  ear: 'spelling',
  shelf: [], me: null, names: {}, sample: undefined, db: undefined, user: undefined,
  notes: {},
};
function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify({ song: S.song, group: S.group, lens: S.lens, board: S.board, latitude: S.latitude, folios: S.folios, variants: S.variants }));
  } catch { /* private window: the draft lives only as long as the page */ }
}

const song = () => DATA.songs.find(s => s.id === S.song);
const lens = () => DATA.lenses.find(l => l.id === S.lens) || DATA.lenses[0];
const lensById = id => DATA.lenses.find(l => l.id === id);
const board = () => S.board || { ...lens().board };
const group = () => { const s = song(); return s.couplets.some(c => c.group === S.group[s.id]) ? S.group[s.id] : s.couplets[0].group; };
const coupletLines = g => song().lines.filter(l => l.group === g);
function folio() {
  const s = song();
  if (!S.folios[s.id]) S.folios[s.id] = { title: '', voice: '', lines: {}, notes: {}, added: [], note: '', dbId: '' };
  return S.folios[s.id];
}
const variantsFor = g => (S.variants[g] ||= []);

// The refrain cue: the opening words of the refrain as this version sings it.
function refrainCue(f, s) {
  const first = s.lines.find(l => l.refrain);
  const t = first && f.lines[first.id];
  if (!t) return '';
  const kept = String(f.refrainCue || '').trim().replace(/[…\s.]+$/, '');
  if (kept && t.startsWith(kept)) return kept;
  return t.trim().split(/\s+/).slice(0, 4).join(' ').replace(/[,;:.!?—–]+$/, '');
}

// ------------------------------------------------------------------ the ear

const PLANET_STEPS = [[0.9, 'absolute'], [0.7, 'perfect'], [0.5, 'vowel'], [0.3, 'off'], [0.15, 'para'], [0.05, 'alliteration'], [-1, 'none']];
const planetFor = x => PLANET_STEPS.find(([t]) => x >= t)[1];
const HINTS = {
  lineation: x => (x >= 0.75 ? 'short, even lines, each closed; the refrain back word for word' : x >= 0.45 ? 'mostly closed lines of like length' : 'lines of different lengths that run on'),
  syntax: x => (x >= 0.75 ? 'phrases side by side: and… and…, commas, commands' : x >= 0.45 ? 'mostly side by side, a clause hung here and there' : 'phrases hung under others: when, because, which'),
  rhythm: x => (x >= 0.75 ? 'one steady groove, the same beats every line, strong line ends' : x >= 0.45 ? 'a groove that bends' : 'speech rhythm, lines of different beats'),
  rhyme: x => en.PLANETS[planetFor(x)].says,
};

function hearCouplet(a, b) {
  const sa = en.scan(a || ''), sb = en.scan(b || '');
  const r = a && b ? en.rhymeLines(a, b) : { kind: 'none', a: '', b: '' };
  return { beats: [sa.beats, sb.beats], rhyme: r };
}
function earLine(a, b, c) {
  const x = hearCouplet(a, b);
  return h('p', { class: 'var__ear' }, h('b', {}, `${x.beats[0]} · ${x.beats[1]} beats`), ' · ',
    x.rhyme.kind === 'none' ? 'no rhyme' : `${x.rhyme.kind} rhyme (${x.rhyme.a} / ${x.rhyme.b})`,
    c ? ` · the Bengali: ${c.kind === 'none' ? 'no rhyme' : c.kind + ' rhyme'}` : '');
}
function forbiddenIn(lineId, text) {
  const l = song().lines.find(x => x.id === lineId);
  const plain = ` ${String(text || '').toLowerCase().replace(/[^\p{L}\s'-]/gu, ' ')} `;
  const hits = new Map();
  for (const f of l?.forbidden || []) if (plain.includes(` ${f.word.toLowerCase()} `)) hits.set(f.word, f.term);
  return [...hits].map(([word, term]) => `"${word}" (the glossary keeps it out of this line: ${term} stays an image)`);
}
function scanView(text) {
  const box = h('div', { class: 'scan', 'aria-hidden': 'true' });
  for (const w of en.scan(text || '').words) {
    box.append(h('span', { class: 'w' }, h('span', { class: 'w__t', text: w.raw }),
      h('span', { class: 'w__m' }, ...w.stress.map(s => (s ? h('b', { text: '/' }) : '×')))));
  }
  return box;
}
async function loadEar() {
  try {
    const m = await import(CMU);
    en.useDictionary(m.dictionary);
    S.ear = 'dictionary';
  } catch { S.ear = 'spelling'; }
  renderPlate(); renderDesk();
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
  renderDesk(); renderPlate(); renderShelf();
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

// ------------------------------------------------------------------ the songs

function renderSongs() {
  const nav = $('songs');
  nav.replaceChildren(...DATA.songs.map(s => h('button', {
    class: 'song-tab', role: 'tab', 'aria-selected': s.id === S.song ? 'true' : 'false',
    onclick: () => { S.song = s.id; persist(); renderAll(); },
  }, h('b', { text: s.no }), h('span', { text: s.title }))));
  nav.setAttribute('role', 'tablist');
}

// ------------------------------------------------------------------ the plate

function bnLine(l) {
  return h('p', { class: 'bn', lang: 'bn' }, l.bn ? l.bn + ' ' : '', h('span', { class: 'rh', text: l.bnEnd }), l.part === 'b' ? h('span', { class: 'dd', text: ' ॥' }) : '');
}
function tlLine(ls) {
  const p = h('p', { class: 'tl', lang: 'bn-Latn' });
  ls.forEach((l, i) => { if (i) p.append(h('span', { class: 'sep', text: '/' })); p.append(l.tl, h('span', { class: 'rh', text: l.tlEnd })); });
  return p;
}
function heatBar(x) { const b = h('div', { class: 'heat' }); b.style.setProperty('--h', String(Math.max(0, Math.min(1, x)))); return b; }

function renderPlate() {
  const s = song(), f = folio(), g = group();
  const plate = $('plate');
  const first = s.lines[0]?.bn || s.lines[0]?.bnEnd || '';
  const seg = typeof Intl !== 'undefined' && Intl.Segmenter ? [...new Intl.Segmenter('bn', { granularity: 'grapheme' }).segment(first)][0]?.segment : first.charAt(0);
  const refrainIdx = s.couplets.findIndex(c => c.refrain);
  const cue = refrainCue(f, s);

  const list = h('ol', { class: 'couplets' });
  s.couplets.forEach((c, i) => {
    if (i) list.append(h('li', { class: 'orn', 'aria-hidden': 'true', text: '॥' }));
    const ls = coupletLines(c.group);
    const mine = ls.map(l => f.lines[l.id]).filter(Boolean);
    const set = mine.length === ls.length;
    const li = h('li', {
      class: `cp${c.group === g ? ' is-current' : ''}${c.refrain ? ' is-refrain' : ''}`, 'data-group': c.group,
      onclick: e => { if (e.target.closest('button,a,input,textarea')) return; pick(c.group); },
    },
    h('div', { class: 'cp__side' },
      h('button', { class: 'cp__no', 'aria-label': `Work on couplet ${c.no}`, onclick: () => pick(c.group), text: c.no }),
      c.refrain ? h('span', { class: 'dhru', lang: 'bn', title: 'the refrain (dhru): sung again after every couplet', text: 'ধ্রু' }) : ''),
    h('div', { class: 'cp__body' },
      ...ls.map(bnLine), tlLine(ls),
      h('p', { class: 'chime', text: `${c.refrain ? 'refrain · ' : ''}${c.bhanita ? 'the poet signs · ' : ''}${c.kind === 'none' ? 'no rhyme in the Bengali' : `${c.kind} rhyme in the Bengali`}` }),
      h('div', { class: `yours${set ? '' : ' is-empty'}` }, ...(set ? mine : ls.map(l => l.en)).map(t => h('p', { text: t }))),
      cue && refrainIdx >= 0 && i > refrainIdx ? h('p', { class: 'cue', text: cue + '…' }) : ''));
    list.append(li);
  });

  const setCount = s.lines.filter(l => f.lines[l.id]).length;
  const mineBoard = setCount ? englishBoard({ lines: s.lines.map(l => ({ id: l.id, group: l.group, role: 'line' })) }, s.lines.filter(l => f.lines[l.id]).map(l => ({ id: l.id, en: f.lines[l.id] }))) : null;
  const srcBoard = h('div', { class: 'srcboard' }, ...CHANNELS.map(ch => h('div', {},
    h('span', { class: 'label', text: CHANNEL_NAMES[ch] }), heatBar(s.board[ch].heat),
    h('em', { text: `song ${temperature(s.board[ch].heat)}${mineBoard ? ` · yours ${temperature(mineBoard.channels[ch].heat)}` : ''}` }))),
  h('p', { class: 'srcboard__note', text: [s.repeats.length ? `Struck again and again: ${s.repeats.map(([w, n]) => `${w} ×${n}`).join(', ')}.` : '', upper(s.board.rhythm.facts[1] || '') + '.'].filter(Boolean).join(' ') }));

  const title = h('input', { id: 'f-title', value: f.title, placeholder: s.title, oninput: e => { f.title = e.target.value; persist(); } });
  const voice = h('textarea', { id: 'f-voice', placeholder: s.sungVoice || 'Whose voice, to whom, in what mood?', oninput: e => { f.voice = e.target.value; persist(); } });
  voice.value = f.voice;
  const actions = h('div', { class: 'row' },
    h('button', { class: 'btn btn--go', onclick: save, disabled: !S.db || setCount < s.lines.length ? true : null, text: 'Save to the shelf' }),
    h('button', { class: 'btn', onclick: copyForEngine, disabled: setCount < s.lines.length ? true : null, text: 'Copy for the engine' }),
    'speechSynthesis' in window ? h('button', { class: 'btn btn--quiet', onclick: hear, text: 'Read it aloud' }) : '',
    setCount ? h('button', { class: 'btn btn--quiet', onclick: () => clearFolio(), text: 'Start again' }) : '');
  const advice = mineBoard && setCount === s.lines.length ? compareBoards({ channels: s.board, couplets: s.couplets.map(c => ({ ...c, heat: en.PLANETS[c.kind].heat })) }, mineBoard, { label: 'yours' }) : [];

  plate.replaceChildren(
    h('div', { class: 'plate__holes', 'aria-hidden': 'true' }, h('i'), h('i')),
    h('div', { class: 'plate__head' },
      h('div', { class: 'init', lang: 'bn', 'aria-hidden': 'true', text: seg || '' }),
      h('h2', { class: 'plate__title', text: f.title || s.title }),
      h('p', { class: 'plate__sub' }, h('b', { text: `${DATA.text.unitLabel} ${s.no}` }), ` · ${s.poet}${s.raga ? ` · rāga ${s.raga}` : ''}`),
      h('p', { class: 'plate__sub', text: `${setCount} of ${s.lines.length} lines are yours. Choose a couplet to work on it at the desk.` }),
      srcBoard),
    list,
    h('div', { class: 'plate__foot' },
      h('label', { class: 'field' }, h('span', { class: 'label', text: 'Your title' }), title),
      h('label', { class: 'field' }, h('span', { class: 'label', text: 'The voice' }), voice),
      advice.length ? h('div', {}, h('span', { class: 'label', text: 'Heard against the song' }), ...advice.map(a => h('p', { class: 'note warn', text: a }))) : '',
      actions,
      S.notes.plate ? h('p', { class: `note ${S.notes.plate.kind || ''}`, text: S.notes.plate.text }) : '',
      S.notes.copy ? S.notes.copy : '',
      !S.db && S.db !== undefined ? h('p', { class: 'note', text: 'Saving to the shared shelf works when this page is open in Claude. Copy for the engine works anywhere.' }) : ''));
}

function pick(g) {
  S.group[S.song] = g; persist(); renderPlate(); renderDesk();
  if (window.matchMedia('(max-width: 1000px)').matches) $('desk').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function clearFolio() {
  const s = song(); delete S.folios[s.id]; S.notes = {}; persist(); renderPlate(); say('The folio is empty again.');
}
function hear() {
  try {
    const s = song(), f = folio();
    const text = s.lines.map(l => f.lines[l.id] || l.en).join('. ');
    speechSynthesis.cancel();
    speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  } catch { /* no voice here */ }
}

// ------------------------------------------------------------------ the desk

function renderDesk() {
  const s = song(), g = group(), c = s.couplets.find(x => x.group === g), ls = coupletLines(g);
  const L = lens(), b = board();
  const desk = $('desk');

  const now = h('div', { class: 'panel' },
    h('h2', {}, `Couplet ${c.no}`, h('small', { text: [c.refrain && 'the refrain', c.bhanita && 'the poet signs'].filter(Boolean).join(' · ') })),
    ...ls.map(l => h('p', { class: 'now__bn', lang: 'bn' }, l.bn + ' ', h('span', { class: 'rh', text: l.bnEnd }))),
    h('dl', { class: 'gloss' }, ...ls.flatMap(l => [
      h('div', {}, h('dt', { text: `${l.part} · word` }), h('dd', { class: 'word', text: l.gloss })),
      h('div', {}, h('dt', { text: `${l.part} · accurate` }), h('dd', { text: l.en })),
      l.sung ? h('div', {}, h('dt', { text: `${l.part} · sung` }), h('dd', { text: l.sung })) : '',
    ])),
    h('p', { class: 'note', text: c.kind === 'none' ? 'The Bengali does not rhyme here: a version need not either.' : `The Bengali chimes here: ${c.kind} rhyme (${c.ends.join(' / ')}). ${en.PLANETS[c.kind].says}.` }));

  const lensPanel = h('div', { class: 'panel' },
    h('h2', {}, 'The lens', h('small', { text: 'a way English poets made songs' })),
    h('div', { class: 'lenses' }, ...DATA.lenses.map(x => h('button', {
      class: 'lens', 'aria-pressed': x.id === S.lens ? 'true' : 'false',
      onclick: () => { S.lens = x.id; S.board = { ...x.board }; persist(); renderDesk(); },
    }, h('span', { class: 'lens__name', text: x.name }), h('span', { class: 'lens__after', text: x.after.replace(/^after /, '') }),
    h('span', { class: 'lens__bars', 'aria-hidden': 'true' }, ...CHANNELS.map(ch => heatBar(x.board[ch])))))),
    h('p', { class: 'lens__how', text: L.how }),
    h('p', { class: 'lens__why', text: L.why }),
    L.touchstone ? h('p', { class: 'lens__why' }, 'Hear it: ', h('span', { class: 'touch', text: L.touchstone })) : '');

  const faders = h('div', { class: 'faders' }, ...CHANNELS.map(ch => {
    const val = h('span', { class: 'fader__val', text: temperature(b[ch]) });
    const hint = h('p', { class: 'fader__hint', text: HINTS[ch](b[ch]) });
    const input = h('input', { type: 'range', min: '0', max: '100', value: String(Math.round(b[ch] * 100)), 'aria-label': `${CHANNEL_NAMES[ch]}: cool to hot`,
      oninput: e => { const x = Number(e.target.value) / 100; S.board = { ...board(), [ch]: r2(x) }; val.textContent = temperature(x); hint.textContent = HINTS[ch](x); persist(); } });
    const tick = h('span', { class: 'fader__src', text: 'the song' });
    tick.style.left = `${s.board[ch].heat * 100}%`;
    return h('div', { class: 'fader' }, h('span', { class: 'label', text: CHANNEL_NAMES[ch] }), h('div', { class: 'fader__track' }, tick, input), val, hint);
  }));
  const boardPanel = h('div', { class: 'panel' },
    h('h2', {}, 'The board', h('small', { text: 'cool is variation, hot is repetition' })),
    faders,
    h('div', { class: 'row' },
      h('button', { class: 'btn', onclick: () => { S.board = Object.fromEntries(CHANNELS.map(ch => [ch, s.board[ch].heat])); persist(); renderDesk(); }, text: 'Match the song' }),
      h('button', { class: 'btn', onclick: () => { S.board = { ...L.board }; persist(); renderDesk(); }, text: `${L.name}'s board` }),
      h('span', { class: 'seg', role: 'group', 'aria-label': 'Latitude' },
        ...['close', 'free'].map(x => h('button', { 'aria-pressed': S.latitude === x ? 'true' : 'false', onclick: () => { S.latitude = x; persist(); renderDesk(); }, text: x === 'close' ? 'Close' : 'Free' })))),
    h('p', { class: 'note', text: S.latitude === 'close' ? 'Close: every image, none added; reorder, compress, choose the plainer word.' : 'Free: an imitation. It may add what an image implies and says what it added; never a doctrine or an image of its own.' }));

  const status = h('div', { class: 'status', id: 'status' });
  const can = !!S.sample;
  const makePanel = h('div', { class: 'panel' },
    h('h2', {}, 'Make', h('small', { text: 'Claude drafts; you choose, cut and keep' })),
    h('div', { class: 'row' },
      h('button', { class: 'btn btn--go', disabled: !can || S.busy ? true : null, onclick: () => make('couplet'), text: `Three versions of ${c.no}` }),
      h('button', { class: 'btn', disabled: !can || S.busy ? true : null, onclick: () => make('song'), text: 'The whole song' })),
    S.sample === false ? h('p', { class: 'note', text: 'Drafting with Claude works when this page is open in Claude and you allow it. You can still write your own lines below and hear them.' }) : '',
    status,
    S.notes.make ? h('p', { class: `note ${S.notes.make.kind || ''}`, text: S.notes.make.text }) : '',
    h('div', { class: 'variants' }, ...variantCards(g)));

  const own = ownPanel(g, ls, c);
  desk.replaceChildren(now, lensPanel, boardPanel, makePanel, own);
  renderStatus();
}

function variantCards(g) {
  const s = song(), c = s.couplets.find(x => x.group === g), ls = coupletLines(g), f = folio();
  const cards = [];
  const songVars = (S.variants[s.id + ':song'] || []);
  for (const v of songVars) cards.push(songCard(v));
  const mine = variantsFor(g);
  const examples = s.examples.map(x => {
    const a = x.lines.find(l => l.id === ls[0].id)?.en, b = x.lines.find(l => l.id === ls[1]?.id)?.en;
    const n = x.couplets.find(k => k.group === g) || {};
    return a && b ? { a, b, kept: n.kept || '', letGo: n.letGo || '', added: [], lens: x.lens, from: 'example', by: x.by, title: x.title, latitude: x.latitude } : null;
  }).filter(Boolean);
  for (const v of [...mine, ...examples]) {
    const used = f.lines[ls[0].id] === v.a && f.lines[ls[1]?.id] === v.b;
    const warn = [...forbiddenIn(ls[0].id, v.a), ...forbiddenIn(ls[1]?.id, v.b)];
    const lx = lensById(v.lens);
    const pa = h('p', { text: v.a }), pb = h('p', { text: v.b });
    const card = h('article', { class: `var${used ? ' is-used' : ''}` },
      h('span', { class: 'var__from' }, h('b', { text: v.from === 'example' ? 'example' : v.from === 'own' ? 'yours' : 'Claude' }),
        ` · ${lx ? lx.name : 'own'} · ${v.latitude || 'close'}${v.title ? ` · from “${v.title}”` : ''}${v.shift ? ` · ${v.shift}` : ''}`),
      h('div', { class: 'var__lines' }, pa, pb),
      earLine(v.a, v.b, c),
      v.kept || v.letGo ? h('p', { class: 'var__how' }, v.kept ? [h('i', { text: 'Kept. ' }), v.kept, ' '] : '', v.letGo ? [h('i', { text: 'Let go. ' }), v.letGo] : '') : '',
      v.added?.length ? h('p', { class: 'var__how' }, h('i', { text: 'Added. ' }), v.added.join('; ')) : '',
      ...warn.map(w => h('p', { class: 'var__warn', text: `Uses ${w}.` })),
      h('div', { class: 'var__acts' },
        h('button', { class: 'btn', disabled: warn.length ? true : null, onclick: () => use(g, { ...v, a: pa.textContent.trim(), b: pb.textContent.trim() }), text: used ? 'In your version' : 'Use' }),
        h('button', { class: 'btn btn--quiet', onclick: e => { const on = pa.getAttribute('contenteditable') === 'true'; for (const p of [pa, pb]) p.setAttribute('contenteditable', on ? 'false' : 'true'); e.target.textContent = on ? 'Edit' : 'Done'; if (!on) pa.focus(); }, text: 'Edit' }),
        h('button', { class: 'btn btn--quiet', disabled: !S.sample || S.busy ? true : null, onclick: () => make('hotter', v), text: 'Hotter' }),
        h('button', { class: 'btn btn--quiet', disabled: !S.sample || S.busy ? true : null, onclick: () => make('cooler', v), text: 'Cooler' }),
        v.from !== 'example' ? h('button', { class: 'btn btn--quiet', onclick: () => { const i = mine.indexOf(v); if (i >= 0) mine.splice(i, 1); persist(); renderDesk(); }, text: 'Discard' }) : ''));
    cards.push(card);
  }
  return cards;
}

function songCard(v) {
  const s = song();
  const lx = lensById(v.lens);
  const warn = s.lines.flatMap(l => forbiddenIn(l.id, v.lines[l.id]).map(w => `${l.id.split('.').pop()}: ${w}`));
  return h('article', { class: 'var song-var' },
    h('span', { class: 'var__from' }, h('b', { text: 'Claude' }), ` · the whole song · ${lx ? lx.name : 'own'} · ${v.latitude}${v.title ? ` · “${v.title}”` : ''}`),
    h('div', { class: 'var__lines' }, ...s.couplets.map(c => h('div', { style: 'margin-bottom:8px' }, ...coupletLines(c.group).map(l => h('p', { text: v.lines[l.id] || '' }))))),
    v.voice ? h('p', { class: 'var__how' }, h('i', { text: 'Voice. ' }), v.voice) : '',
    ...warn.map(w => h('p', { class: 'var__warn', text: `Uses ${w}.` })),
    h('div', { class: 'var__acts' },
      h('button', { class: 'btn', disabled: warn.length ? true : null, onclick: () => useSong(v), text: 'Use the whole version' }),
      h('button', { class: 'btn btn--quiet', onclick: () => { const list = S.variants[s.id + ':song']; list.splice(list.indexOf(v), 1); persist(); renderDesk(); }, text: 'Discard' })));
}

function use(g, v) {
  const f = folio(), ls = coupletLines(g);
  f.lines[ls[0].id] = v.a; if (ls[1]) f.lines[ls[1].id] = v.b;
  f.notes[g] = { kept: v.kept || '', letGo: v.letGo || '' };
  if (v.added?.length) f.added = [...new Set([...(f.added || []), ...v.added])];
  f.lens = v.lens || S.lens;
  persist(); renderPlate(); renderDesk();
  say(`Couplet ${g.split('.').slice(1).join('.')} set in your version.`);
}
function useSong(v) {
  const s = song(), f = folio();
  for (const l of s.lines) if (v.lines[l.id]) f.lines[l.id] = v.lines[l.id];
  for (const c of v.couplets || []) f.notes[c.group] = { kept: c.kept || '', letGo: c.letGo || '' };
  if (v.title && !f.title) f.title = v.title;
  if (v.voice && !f.voice) f.voice = v.voice;
  f.refrainCue = v.refrainCue || '';
  f.added = v.added || []; f.lens = v.lens;
  persist(); renderPlate(); renderDesk(); say('The whole version is in your folio.');
}

function ownPanel(g, ls, c) {
  const f = folio();
  const ia = h('input', { 'aria-label': `Your line ${ls[0].id.split('.').pop()}`, placeholder: ls[0].en, value: f.lines[ls[0].id] || '' });
  const ib = ls[1] ? h('input', { 'aria-label': `Your line ${ls[1].id.split('.').pop()}`, placeholder: ls[1].en, value: f.lines[ls[1].id] || '' }) : null;
  const sa = scanView(ia.value), sb = ib ? scanView(ib.value) : '';
  const ear = h('div');
  const kept = h('input', { class: 'own__note', placeholder: 'Kept: what your English keeps of the sound, image or feeling', value: f.notes[g]?.kept || '' });
  const letGo = h('input', { class: 'own__note', placeholder: 'Let go: what it gives up', value: f.notes[g]?.letGo || '' });
  const warnBox = h('div');
  const update = () => {
    ia.nextSibling.replaceWith(scanView(ia.value));
    if (ib) ib.nextSibling.replaceWith(scanView(ib.value));
    ear.replaceChildren(earLine(ia.value, ib ? ib.value : '', c));
    const warn = [...forbiddenIn(ls[0].id, ia.value), ...(ib ? forbiddenIn(ls[1].id, ib.value) : [])];
    warnBox.replaceChildren(...warn.map(w => h('p', { class: 'var__warn', text: `Uses ${w}.` })));
    btn.disabled = !ia.value.trim() || (ib && !ib.value.trim()) || warn.length > 0;
  };
  const btn = h('button', { class: 'btn btn--go', onclick: () => {
    const v = { a: ia.value.trim(), b: ib ? ib.value.trim() : '', kept: kept.value.trim(), letGo: letGo.value.trim(), lens: 'own', from: 'own', latitude: S.latitude };
    use(g, v);
  }, text: 'Set these lines' });
  ia.addEventListener('input', update);
  if (ib) ib.addEventListener('input', update);
  const panel = h('div', { class: 'panel own' },
    h('h2', {}, 'Write it yourself', h('small', { text: 'the ear listens as you type' })),
    ia, sa, ib || '', sb, ear, kept, letGo, warnBox,
    h('div', { class: 'row' }, btn, h('span', { class: 'ear', text: S.ear === 'dictionary' ? 'Stresses from the CMU Pronouncing Dictionary; names read the Sanskrit way. Say it aloud to check.' : 'Stresses read from spelling (the dictionary did not load). Say it aloud to check.' })));
  ear.replaceChildren(earLine(ia.value, ib ? ib.value : '', c));
  btn.disabled = !ia.value.trim() || (ib && !ib.value.trim());
  return panel;
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
  const s = song(), L = lens(), b = board(), f = folio(), g = group(), ls = coupletLines(g);
  const forb = s.lines.filter(l => l.forbidden?.length).map(l => `- ${l.id}: ${[...new Set(l.forbidden.map(x => x.word))].join(', ')}`);
  const set = s.lines.filter(l => f.lines[l.id]).map(l => `- ${l.id}: ${f.lines[l.id]}`);
  const parts = [DATA.prompt,
    `## The lens: ${L.name}, ${L.after}\n${L.how}\nWhy this lens: ${L.why}` + (L.touchstone ? `\nTouchstone (to hear, never to borrow): ${L.touchstone}` : ''),
    `## The maker's board (0 cool .. 1 hot)\n${CHANNELS.map(ch => `- ${ch} ${b[ch]}: ${HINTS[ch](b[ch])}`).join('\n')}`,
    `## Latitude: ${S.latitude}`,
    `## Voice: ${f.voice || s.sungVoice || '(find it)'}`,
    songBlock(s),
    `## How the song works (the source's mixing board)\n${s.reading}`,
    forb.length ? `## Words that must never stand in these lines (the glossary keeps the reading out of the image)\n${forb.join('\n')}` : '',
    `## The teaching's words keep this English: ${DATA.teaching.map(t => t.en).join(', ')}`,
    set.length ? `## Lines the maker has already set (keep the version consistent with them)\n${set.join('\n')}` : '',
  ];
  const variantJson = `{"variants":[{"a":"the line for ${ls[0].id}","b":"the line for ${ls[1]?.id}","kept":"…","letGo":"…","added":[]}]}`;
  if (kind === 'couplet') {
    parts.push(`## What to make\nMake three versions of couplet ${g} only (lines ${ls.map(l => l.id).join(' and ')}); the rest of the song is context. Make them different enough to be worth choosing between: one on the board as set, one that risks more in the lens's manner, one plainer. Reply with only this JSON, no other text:\n${variantJson}`);
  } else if (kind === 'hotter' || kind === 'cooler') {
    parts.push(`## What to make\nHere is a version of couplet ${g}:\n${ls[0].id}: ${base.a}\n${ls[1]?.id}: ${base.b}\nMake two new versions of this couplet that run about a quarter ${kind} on every channel than this one (${kind === 'hotter' ? 'hotter: more repetition, a rhyme nearer the sun, a steadier beat, lines closed' : 'cooler: less repetition, a looser rhyme or none, speech rhythm, a line that runs on'}), keeping every rule and every image. Reply with only this JSON, no other text:\n${variantJson}`);
  } else {
    parts.push(`## What to make\nMake the whole song, every half-line, in order. Reply with only this JSON, no other text:\n{"title":"…","voice":"…","refrainCue":"the opening words of your refrain","lines":[${s.lines.map(l => `{"id":"${l.id}","en":"…"}`).join(',')}],"couplets":[${s.couplets.map(c => `{"group":"${c.group}","kept":"…","letGo":"…"}`).join(',')}],"added":[]}`);
  }
  return parts.filter(Boolean).join('\n\n');
}

const ERR = {
  not_granted: 'Drafting was not allowed for this page. You can still write your own lines.',
  sampling_disabled: 'Claude is not available for this account here.',
  rate_limited: 'Claude is busy or your usage limit is near; try again in a minute.',
  refused: 'Claude declined that one. Try another lens or board.',
  invalid_json: 'The answer came back in a shape the page could not read. Try again.',
  prompt_too_large: 'The request was too large.',
  session_expired: 'Sign in to Claude again, then try.',
};
async function make(kind, base) {
  const sample = S.sample;
  if (!sample) return;
  const ctl = new AbortController();
  const g = group(), s = song();
  S.busy = { kind, started: Date.now(), ctl, chars: 0 };
  S.notes.make = null;
  renderDesk();
  const tick = setInterval(renderStatus, 1000);
  try {
    const out = await sample.json(buildPrompt(kind, base), {
      signal: ctl.signal, cache: false, modelTier: kind === 'song' ? 'complex' : 'default',
      onText: ({ text }) => { if (S.busy) S.busy.chars = text.length; },
    });
    const board0 = { ...board() }, lat = S.latitude, lensId = S.lens;
    if (kind === 'song') {
      const lines = Object.fromEntries((Array.isArray(out?.lines) ? out.lines : []).filter(l => l && typeof l.id === 'string' && typeof l.en === 'string').map(l => [l.id, l.en.trim()]));
      if (!s.lines.every(l => lines[l.id])) throw { code: 'invalid_json' };
      (S.variants[s.id + ':song'] ||= []).unshift({ lines, couplets: Array.isArray(out.couplets) ? out.couplets.map(c => ({ group: String(c.group || ''), kept: String(c.kept || ''), letGo: String(c.letGo || '') })) : [],
        title: String(out.title || ''), voice: String(out.voice || ''), refrainCue: String(out.refrainCue || ''), added: Array.isArray(out.added) ? out.added.map(String) : [], lens: lensId, latitude: lat, board: board0 });
      S.notes.make = { kind: 'ok', text: 'A whole version is at the top of the list.' };
    } else {
      const vs = (Array.isArray(out?.variants) ? out.variants : []).filter(v => v && typeof v.a === 'string' && typeof v.b === 'string' && v.a.trim() && v.b.trim());
      if (!vs.length) throw { code: 'invalid_json' };
      variantsFor(g).unshift(...vs.map(v => ({ a: v.a.trim(), b: v.b.trim(), kept: String(v.kept || ''), letGo: String(v.letGo || ''), added: Array.isArray(v.added) ? v.added.map(String) : [],
        lens: lensId, latitude: lat, board: board0, from: 'claude', shift: kind === 'couplet' ? '' : kind })));
      S.notes.make = { kind: 'ok', text: `${vs.length} new version${vs.length > 1 ? 's' : ''} of ${g.split('.').slice(1).join('.')}.` };
    }
    persist();
  } catch (e) {
    if (e?.code === 'cancelled') S.notes.make = null;
    else {
      if (['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed'].includes(e?.code)) S.sample = false;
      S.notes.make = { kind: 'warn', text: ERR[e?.code] || 'Something went wrong on the way; try again.' };
    }
  } finally {
    clearInterval(tick);
    S.busy = null;
    renderDesk();
    say(S.notes.make?.text || '');
  }
}
function renderStatus() {
  const box = $('status');
  if (!box) return;
  if (!S.busy) { box.replaceChildren(); return; }
  const secs = Math.round((Date.now() - S.busy.started) / 1000);
  const what = { couplet: 'three versions', song: 'the whole song', hotter: 'a hotter pair', cooler: 'a cooler pair' }[S.busy.kind];
  box.replaceChildren(h('span', { class: 'dot', 'aria-hidden': 'true' }),
    `${S.busy.chars ? 'Writing' : 'Thinking about'} ${what}… ${secs}s`,
    h('button', { class: 'btn btn--quiet', onclick: () => S.busy?.ctl.abort(), text: 'Stop' }));
}

// ------------------------------------------------------------------ keeping

function versionDoc() {
  const s = song(), f = folio();
  return {
    unit: s.id, title: f.title.trim(), lens: f.lens || S.lens, latitude: S.latitude, board: { ...board() },
    voice: f.voice.trim(), refrainCue: refrainCue(f, s),
    lines: s.lines.map(l => ({ id: l.id, en: (f.lines[l.id] || '').trim() })),
    couplets: s.couplets.map(c => ({ group: c.group, kept: f.notes[c.group]?.kept || '', letGo: f.notes[c.group]?.letGo || '' })),
    added: f.added || [], note: f.note || '',
  };
}
function problems(doc) {
  const out = [];
  for (const l of doc.lines) {
    if (!l.en) out.push(`${l.id} is not set yet`);
    for (const w of forbiddenIn(l.id, l.en)) out.push(`${l.id} uses ${w}`);
  }
  return out;
}
async function save() {
  const doc = versionDoc(), f = folio();
  const p = problems(doc);
  if (p.length) { S.notes.plate = { kind: 'warn', text: p.join('; ') }; renderPlate(); return; }
  try {
    const col = S.db.collection('versions');
    const mine = f.dbId && S.shelf.find(v => v.dbId === f.dbId && v.makerId && v.makerId === S.me);
    const ref = mine ? col.doc(f.dbId) : col.doc();
    await ref.set({ ...doc, makerId: S.me || '', made: today(), updatedAt: new Date().toISOString() });
    f.dbId = ref.id; persist();
    S.notes.plate = { kind: 'ok', text: mine ? 'Saved over your earlier copy on the shelf.' : 'Saved to the shelf, where everyone with this page can read it.' };
  } catch (e) {
    S.notes.plate = { kind: 'warn', text: e?.code === 'invalid_argument' ? 'This page lets you read the shelf but not add to it; ask its owner to make you a Contributor.' : 'The shelf did not take it; try again in a moment.' };
  }
  renderPlate(); say(S.notes.plate.text);
}
async function copyForEngine() {
  const doc = versionDoc();
  const p = problems(doc);
  if (p.length) { S.notes.plate = { kind: 'warn', text: p.join('; ') }; renderPlate(); return; }
  let by = '';
  if (S.user && S.me) { try { const ps = await S.user.profiles([S.me]); by = ps?.[S.me]?.name || ''; } catch { /* unnamed */ } }
  const text = JSON.stringify({ versions: [{ ...doc, by, made: today(), via: 'workshop' }] }, null, 2);
  const cmd = `node translate/cli.mjs versions import ${DATA.text.slug} version.json${by ? '' : ' --by "Your Name"'}`;
  try {
    await navigator.clipboard.writeText(text);
    S.notes.plate = { kind: 'ok', text: `Copied. Save it as version.json, then: ${cmd}` };
    S.notes.copy = null;
  } catch {
    const box = h('textarea', { class: 'copybox', readonly: true, 'aria-label': 'The version as JSON for the engine' });
    box.value = text;
    S.notes.plate = { kind: '', text: `Copy this, save it as version.json, then: ${cmd}` };
    S.notes.copy = box;
    setTimeout(() => { box.focus(); box.select(); }, 0);
  }
  renderPlate();
}

// ------------------------------------------------------------------ the shelf

function poemView(v, s) {
  const box = h('div', { class: 'poem' });
  for (const c of s.couplets) {
    const ls = coupletLines(c.group);
    box.append(h('p', { class: c.refrain ? 'rf' : '' }, ...ls.flatMap((l, i) => [i ? h('br') : '', v.lines.find(x => x.id === l.id)?.en || ''])));
  }
  return box;
}
function renderShelf() {
  const s = song();
  const made = S.shelf.filter(v => v.unit === s.id).sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  const card = (v, from) => {
    const lx = lensById(v.lens);
    const heard = englishBoard({ lines: s.lines.map(l => ({ id: l.id, group: l.group, role: 'line' })) }, v.lines || []);
    return h('article', { class: 'card' },
      h('h3', { text: v.title || s.title }),
      h('p', { class: 'card__by', text: `${lx ? lx.after : 'without a lens'} · ${v.latitude === 'free' ? 'free' : 'close'} · ${from === 'edition' ? `made by ${v.by}` : `made by ${nameOf(v.makerId)}`}${v.made ? `, ${v.made}` : ''}` }),
      h('div', { class: 'chips' }, ...CHANNELS.map(ch => h('span', { class: 'chip', text: `${CHANNEL_NAMES[ch].toLowerCase()} ${temperature(heard.channels[ch].heat)}` }))),
      h('div', { class: 'card__first' }, ...(v.lines || []).slice(0, 2).map(l => h('p', { text: l.en }))),
      h('details', {}, h('summary', { text: 'Read it all' }), poemView(v, s), v.voice ? h('p', { class: 'card__by', text: v.voice }) : ''),
      h('div', { class: 'row' }, h('button', { class: 'btn btn--quiet', onclick: () => openInFolio(v, from), text: 'Open in your folio' })));
  };
  const head = [h('h2', { class: 'sec-h', id: 'shelf-h', text: 'The shelf' }),
    h('p', { class: 'sec-lede', text: `Versions of ${DATA.text.unitLabel.toLowerCase()} ${s.no} saved here by anyone who has this page, and the edition's own examples. Open one to work from it; saving makes it yours.` })];
  const grid = h('div', { class: 'shelf__grid' },
    ...made.map(v => card(v, 'shelf')),
    ...s.examples.map(v => card(v, 'edition')));
  const note = S.db === false ? h('p', { class: 'note', text: 'The shared shelf opens when this page is viewed in Claude; the edition\'s examples are here either way.' }) : '';
  $('shelf').replaceChildren(...head, note, grid);
}
function openInFolio(v, from) {
  const s = song();
  S.folios[s.id] = {
    title: v.title || '', voice: v.voice || '', refrainCue: v.refrainCue || '', lens: v.lens, added: v.added || [], note: '',
    lines: Object.fromEntries((v.lines || []).map(l => [l.id, l.en])),
    notes: Object.fromEntries((v.couplets || []).map(c => [c.group, { kept: c.kept || '', letGo: c.letGo || '' }])),
    dbId: from === 'shelf' && v.makerId === S.me ? v.dbId : '',
  };
  if (lensById(v.lens)) S.lens = v.lens;
  if (v.board) S.board = { ...v.board };
  if (v.latitude) S.latitude = v.latitude;
  persist(); renderPlate(); renderDesk();
  $('plate').scrollIntoView({ behavior: 'smooth', block: 'start' });
  say('Opened in your folio.');
}

// ------------------------------------------------------------------ the guide

function renderGuide() {
  const s = song();
  const planets = h('table', { class: 'planets' },
    h('thead', {}, h('tr', {}, h('th', { text: 'Planet' }), h('th', { text: 'What chimes' }), h('th', { text: 'Heat' }))),
    h('tbody', {}, ...Object.entries(en.PLANETS).filter(([k]) => k !== 'eye').map(([k, p]) => h('tr', {}, h('td', { text: k }), h('td', { text: p.says }), h('td', {}, heatBar(p.heat))))));
  $('guide').replaceChildren(
    h('h2', { class: 'sec-h', id: 'guide-h', text: 'Read the song before you sing it' }),
    h('p', { class: 'sec-lede', text: 'The method is Timothy Morton\'s, from his course How to Read a Poem: describe what the song does before deciding what it means, and read out of it, never into it.' }),
    h('div', { class: 'guide__cols' },
      h('div', { class: 'card' }, h('h3', { text: 'Five steps, in order' }), h('ol', {},
        h('li', {}, h('b', { text: 'Structure. ' }), 'Lineation and syntax: couplets closed by ॥, the refrain (ধ্রু) coming round, phrases laid side by side.'),
        h('li', {}, h('b', { text: 'Texture. ' }), 'Rhythm is line, rhyme is colour. Count stresses, not syllables; find the groove, then what breaks it.'),
        h('li', {}, h('b', { text: 'Perception. ' }), 'What it makes you see, in order. Keep strange things strange: a riddle solved in the line is lost.'),
        h('li', {}, h('b', { text: 'Narrator. ' }), 'Who sings to whom, how close. The poet signs his song by name; a call like "hey" keeps its bite.'),
        h('li', {}, h('b', { text: 'Narrative. ' }), 'Where it turns, from A to not-A. Turn at the same couplet, as hard.'))),
      h('div', { class: 'card' }, h('h3', { text: 'Hot and cool' }),
        h('p', { text: 'Every channel runs from cool (variation, surprise, speech) to hot (repetition, pattern, the mantra). A song is the conversation between its channels. Match the Bengali channel by channel, or trade knowingly: a lost rhyme repaid by a name struck twice. The refrain is absolute rhyme, the sun.' }),
        planets),
      h('div', { class: 'card' }, h('h3', { text: 'Ways to make' }), h('ul', {},
        h('li', {}, h('b', { text: 'Hotter, cooler. ' }), 'Make the couplet twice, one hotter, one cooler, and keep the one nearer the song. The buttons on every version do this.'),
        h('li', {}, h('b', { text: 'Twinkle, twinkle, little bat. ' }), 'Put nonsense on the Bengali\'s beat to hear the groove your English has to find.'),
        h('li', {}, h('b', { text: 'The blank sheet. ' }), 'Look at the leaf before the words: its lengths, its repeats, its ধ্রু. That shape is the first thing to keep.'),
        h('li', {}, h('b', { text: 'Read it aloud. ' }), 'Stress is relative; only the voice settles it. The marks under your lines are the ear\'s guess.'))),
      h('div', { class: 'card' }, h('h3', { text: 'Three Englishes' }),
        h('p', { text: 'The edition keeps the accurate translation (the meaning, line for line) and a sung version (the song\'s shape, held close). A version made here is the third kind, what Dryden called an imitation: the freest, through a way English poets made songs, and it says what it changed. Pound made Cathay from Fenollosa\'s word-by-word notes; the gloss on this page is that notebook.' })),
      h('div', { class: 'card' }, h('h3', { text: `${DATA.text.unitLabel} ${s.no}, read` }), h('pre', { class: 'reading', text: s.reading }))));
}

function renderAll() { renderSongs(); renderPlate(); renderDesk(); renderShelf(); renderGuide(); }

renderAll();
connect();
if ('requestIdleCallback' in window) requestIdleCallback(() => loadEar(), { timeout: 2500 }); else setTimeout(loadEar, 600);
