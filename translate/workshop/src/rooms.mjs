// The Workshop's other rooms: Your poems (the maker's own poems, one channel
// per draft, read on Morton's board), Practice (an exercise a day from the
// five traditions, and a journal) and Study (the touchstone poems, read on
// the board). What a maker writes here is private: it is kept in their own
// corner of the page's database (data/users/<id>/…), which no one else can
// read, or on this device when the page cannot reach it. Claude sees a poem
// only when the maker asks for a response. Plain DOM, text only, as in main.mjs.
import * as po from '../../lib/poetics.mjs';
import { temperature } from '../../lib/board.mjs';

const ROOMS_KEY = 'charyapada-workshop-rooms-v1';
const STEPS = [
  ['structure', 'Structure', 'the page and the line: space, stanzas, line breaks, how phrases touch'],
  ['texture', 'Texture', 'the poem in the mouth: rhythm and rhyme'],
  ['perception', 'Perception', 'what it makes you see, in order; what it says no to'],
  ['narrator', 'Narrator', 'who speaks, to whom, and who the reader must become'],
  ['narrative', 'Narrative', 'where it turns, and how it spends time'],
  ['any', 'Anything', 'no single channel'],
];
const TRADITION_NAMES = { morton: 'Morton', sufi: 'Sufi', zen: 'Zen', shakespeare: 'Shakespeare', bardic: 'Bardic', maker: 'Yours', english: 'English' };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const dayNo = () => Math.floor(Date.now() / 86400000);
const fmtDate = s => { try { return new Date(s).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return String(s || '').slice(0, 10); } };
const clip = (s, n) => (String(s).length > n ? String(s).slice(0, n - 1).trimEnd() + '…' : String(s));
const firstLine = s => String(s || '').split('\n').map(x => x.trim()).find(Boolean) || '';

export function makeRooms(ctx) {
  const { h, $, DATA, say, toast, heatBar, ERR, env } = ctx;
  const STUDY = DATA.study || { traditions: [], poems: [], across: [] };
  const PRACTICE = (DATA.practice && DATA.practice.exercises) || [];
  const load = () => { try { return JSON.parse(localStorage.getItem(ROOMS_KEY) || 'null') || {}; } catch { return {}; } };
  const saved = load();
  const R = {
    poemId: saved.poemId || '',
    text: typeof saved.text === 'string' ? saved.text : null,
    title: saved.title || '',
    channel: saved.channel || 'structure',
    note: saved.note || '',
    compare: '',
    question: '', opinions: false, lightOf: '',
    poems: [], journal: [],
    local: { poems: Array.isArray(saved.poems) ? saved.poems : [], journal: Array.isArray(saved.journal) ? saved.journal : [] },
    store: 'waiting',
    busy: null, notes: {},
    ex: saved.ex || '', exText: saved.exText || '', exFilter: saved.exFilter || 'all', exWith: saved.exWith || '',
    tradition: saved.tradition || 'morton', studyPoem: saved.studyPoem || '', show: saved.show || { tl: true, gloss: false },
    answering: '',
  };
  let timer = 0;
  function persist() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        localStorage.setItem(ROOMS_KEY, JSON.stringify({ poemId: R.poemId, text: R.text, title: R.title, channel: R.channel, note: R.note,
          ex: R.ex, exText: R.exText, exFilter: R.exFilter, exWith: R.exWith, tradition: R.tradition, studyPoem: R.studyPoem, show: R.show,
          poems: R.store === 'device' ? R.local.poems : [], journal: R.store === 'device' ? R.local.journal : [] }));
      } catch { /* a private window keeps the work only while the page is open */ }
    }, 250);
  }

  // ---------------------------------------------------------------- storage

  const col = name => { const { db, me } = env(); return db && me ? db.collection(`data/users/${me}/${name}/items`) : null; };
  function connect() {
    const poems = col('poems'), journal = col('journal');
    if (!poems || !journal) { R.store = 'device'; R.poems = R.local.poems; R.journal = R.local.journal; rerender(); return; }
    R.store = 'private';
    poems.onSnapshot(snap => { R.poems = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort(byUpdated); rerender(['poems']); },
      () => { R.store = 'device'; R.poems = R.local.poems; rerender(['poems']); });
    journal.onSnapshot(snap => { R.journal = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort(byUpdated); rerender(['practice', 'study']); },
      () => { R.journal = R.local.journal; rerender(['practice']); });
  }
  const byUpdated = (a, b) => String(b.updatedAt || b.at || '').localeCompare(String(a.updatedAt || a.at || ''));
  async function putPoem(p) {
    p.updatedAt = new Date().toISOString();
    const c = col('poems');
    if (c && R.store === 'private') { await c.doc(p.id).set(strip(p)); return; }
    R.local.poems = [p, ...R.local.poems.filter(x => x.id !== p.id)]; R.poems = R.local.poems; persist();
  }
  async function putEntry(e) {
    e.at = e.at || new Date().toISOString();
    const c = col('journal');
    if (c && R.store === 'private') { await c.doc(e.id).set(strip(e)); return; }
    R.local.journal = [e, ...R.local.journal.filter(x => x.id !== e.id)]; R.journal = R.local.journal; persist();
  }
  async function dropPoem(id) {
    const c = col('poems');
    if (c && R.store === 'private') await c.doc(id).delete();
    else { R.local.poems = R.local.poems.filter(x => x.id !== id); R.poems = R.local.poems; persist(); }
  }
  const strip = o => { const { id, ...rest } = o; return JSON.parse(JSON.stringify(rest)); };
  const storeNote = () => (R.store === 'private' ? 'Kept privately in your corner of this page: no one else who opens it can read it.'
    : R.store === 'device' ? 'Kept on this device only. Open the page in Claude, signed in, to keep your work privately across devices.' : 'Opening your private corner of the page…');

  // ---------------------------------------------------------------- the board, shown

  function boardRows(b) {
    return h('div', { class: 'pboard' }, ...po.POEM_CHANNELS.map(ch => {
      const c = b.channels[ch] || { heat: 0, facts: [] };
      const facts = c.facts || [];
      return h('div', { class: 'pboard__row' },
        h('span', { class: 'label', text: (po.POEM_CHANNEL_NAMES || {})[ch] || ch }),
        heatBar(c.heat),
        h('span', { class: 'pboard__t', text: temperature(c.heat) }),
        facts.length ? h('p', { class: 'pboard__fact', text: facts[0] }) : '',
        facts.length > 1 ? h('details', { class: 'pboard__more' }, h('summary', { text: `${facts.length - 1} more` }), ...facts.slice(1).map(f => h('p', { text: f }))) : '');
    }));
  }
  function finds(b) {
    const rows = [];
    const add = (label, text) => { if (text) rows.push(h('div', { class: 'find' }, h('dt', { class: 'label', text: label }), h('dd', { text }))); };
    const sch = b.scheme || {};
    if (sch.letters) add('Rhyme scheme', `${sch.letters}${sch.form && sch.form !== 'free' ? `: ${sch.form}` : ''}`);
    const t = b.turn || {};
    if (t.kind && t.kind !== 'none' && Number.isInteger(t.at)) add('The turn', `at line ${t.at + 1}${t.word ? `, on “${t.word}”` : ''} (${t.kind === 'Italian' ? 'after the eighth line, where an Italian sonnet turns' : t.kind === 'English' ? 'at the closing couplet, where an English sonnet trips' : t.kind})`);
    if (b.radif) add('Radīf', `every couplet ends on “${b.radif.phrase}”: the ghazal's refrain, absolute rhyme after a changing rhyme`);
    if (b.dunadh) add('Dúnadh', `the poem closes on ${b.dunadh.grade === 'word' ? 'the word' : 'the sound'} it opened with (“${b.dunadh.first}” … “${b.dunadh.last}”), as an Irish poem closes its circle`);
    const n = b.negation || {};
    if (n.count) add('Saying no', `${n.count} negation${n.count > 1 ? 's' : ''}: ${[...new Set((n.words || []).map(w => w.word))].slice(0, 8).join(', ')}. Negative imagery: what is denied is still pictured`);
    const struck = (b.struck || []).slice(0, 5);
    if (struck.length) add('Struck again', struck.map(s => Array.isArray(s) ? `${s[0]} ×${s[1]}` : `${s.word} ×${s.count}`).join(', '));
    const pm = b.pentameter || {};
    if (pm.share >= 0.5) add('Pentameter', `${Math.round(pm.share * 100)}% of the lines run five beats`);
    if ((b.hesitations || []).length) add('Hesitating breaks', `lines ${b.hesitations.map(i => i + 1).join(', ')} end on a light word, so the voice hangs over the gap`);
    const pr = b.pronouns || {};
    const who = xs => (xs && xs.length ? xs.join(' and ') : 'no one');
    if (pr.shifts && pr.shifts.length) add('Who is here', pr.shifts.slice(0, 4).map(x => `line ${x.at + 1}, ${who(x.from)} → ${who(x.to)}`).join('; '));
    const sound = ['internal', 'aicill', 'alliteration', 'parallel'].map(k => b[k] && b[k].facts && b[k].facts[0]).filter(Boolean);
    if (sound.length) add('Sound and echo', sound.join('. ').replace(/\.\./g, '.'));
    if (b.whelm) add('Whelm', `${b.whelm}: ${b.whelm.includes('over') ? 'every channel runs hot at once' : 'every channel runs cool at once'}`);
    return rows.length ? h('dl', { class: 'finds' }, ...rows) : h('p', { class: 'note', text: 'Nothing more for the ear to report yet.' });
  }
  const boardText = b => po.POEM_CHANNELS.map(ch => `${ch}: ${temperature(b.channels[ch].heat)} (${b.channels[ch].heat}); ${(b.channels[ch].facts || []).slice(0, 2).join('; ')}`).join('\n')
    + (b.scheme?.letters ? `\nrhyme scheme ${b.scheme.letters} (${b.scheme.form || 'free'})` : '')
    + (b.turn?.kind && b.turn.kind !== 'none' ? `\nturn at line ${b.turn.at + 1}${b.turn.word ? ` on "${b.turn.word}"` : ''}` : '')
    + (b.radif ? `\nradif: "${b.radif.phrase}"` : '') + (b.dunadh ? '\ncloses on its first word (dúnadh)' : '')
    + (b.negation?.count ? `\n${b.negation.count} negations` : '');
  function safeBoard(text) { try { return po.poemBoard(text); } catch { return null; } }

  // ---------------------------------------------------------------- asking Claude

  async function ask(key, prompt, shape) {
    const sample = env().sample;
    if (!sample || R.busy) return null;
    const ctl = new AbortController();
    R.busy = { key, ctl };
    R.notes[key] = null;
    rerender();
    try {
      const out = await sample.json(prompt, { signal: ctl.signal, cache: false, modelTier: 'default' });
      if (!shape(out)) throw { code: 'invalid_json' };
      return out;
    } catch (e) {
      if (e?.code !== 'cancelled') { R.notes[key] = { kind: 'warn', text: ERR[e?.code] || 'Something went wrong on the way; try again.' }; say(R.notes[key].text); }
      return null;
    } finally { R.busy = null; rerender(); }
  }
  const busyView = key => (R.busy && R.busy.key === key
    ? h('div', { class: 'status' }, h('span', { class: 'pulse' }), 'Claude is reading…', h('button', { class: 'btn btn--link btn--small', onclick: () => R.busy?.ctl.abort(), text: 'Stop' }))
    : R.notes[key] ? h('p', { class: `note ${R.notes[key].kind}`, text: R.notes[key].text }) : '');
  const lightOf = id => { const t = STUDY.traditions.find(x => x.id === id); return t ? `\n\nAlso read it in the light of ${t.name}: ${t.summary} Name one or two specific devices from that tradition that this poem already uses or could, with the line.` : ''; };
  function respondPrompt(text, b, { question, opinions, tradition }) {
    return `You are responding to a poet's draft in a workshop, in the order of Liz Lerman's Critical Response Process, which keeps the poet in control.
1. Statements of meaning: what was meaningful, striking or alive in the poem, each tied to specific words (quote a few).
2. The poet's question: answer it plainly${question ? '' : ' (there is none this time; return an empty string)'}.
3. Neutral questions: three questions without opinions hidden in them, about choices in the poem ("What made you break line 6 after 'the'?"), never "Why didn't you…".
4. Opinions: ${opinions ? 'the poet asked for them. Give at most three, each specific, each grounded in a line and in the board, phrased as your view.' : 'the poet did not ask; return an empty list.'}
Rules: never rewrite the poem or offer replacement lines. No praise without evidence. Plain, warm, exact English; no jargon without a short gloss. The reading method is Timothy Morton's (structure, texture, perception, narrator, narrative; hot = repetition and pattern, cool = variation); use the board's findings as evidence, not as verdicts.${lightOf(tradition)}

The board the page measured (estimates for the ear to check):
${boardText(b)}

${question ? `The poet's question: ${question}\n\n` : ''}The poem:
${text}

Return JSON only: {"meaning": ["…", "…"], "answer": "…", "questions": ["…", "…", "…"], "opinions": []}`;
  }
  function movesPrompt(text, b, step) {
    const s = STEPS.find(x => x[0] === step) || STEPS[0];
    return `You are a poetry teacher. The poet is revising one channel at a time, and this draft works only on ${s[1].toUpperCase()} (${s[2]}). Offer three concrete moves on that channel only, each tied to a numbered line. Do not rewrite the poem; a move may show a phrase of at most six words as an illustration. Draw on the traditions the Workshop studies where they fit (the ghazal's radīf, the Irish dúnadh that closes on the first word, Jia Dao revising one word from the scene, the sonnet's turn, the keen's returning cry, Morton's hot and cool), and name the source when you do.

The board the page measured:
${boardText(b)}

The poem, lines numbered:
${text.split('\n').map((l, i) => `${i + 1} ${l}`).join('\n')}

Return JSON only: {"moves": [{"line": 3, "move": "…", "why": "…"}]}`;
  }

  // ---------------------------------------------------------------- Your poems

  const EXAMPLE = (() => {
    const p = STUDY.poems.find(x => /29/.test(x.id)) || STUDY.poems.find(x => x.lang === 'en');
    return p ? { title: `An example: ${p.poet ? `${p.poet}, ` : ''}${String(p.title).split(' (')[0]}`, text: (p.english && p.english.length ? p.english : p.original).join('\n') } : { title: 'An example', text: '' };
  })();
  const current = () => R.poems.find(p => p.id === R.poemId) || null;
  const drafts = p => (p && Array.isArray(p.drafts) ? p.drafts : []);
  function editorText() {
    const p = current();
    if (R.text != null) return R.text;
    return p ? (drafts(p).at(-1)?.text || '') : EXAMPLE.text;
  }
  function openPoem(id) { R.poemId = id; R.text = null; R.compare = ''; R.note = ''; const p = current(); R.title = p ? p.title || '' : ''; persist(); renderPoems(); }
  function newPoem() { R.poemId = ''; R.text = ''; R.title = ''; R.compare = ''; R.note = ''; persist(); renderPoems(); setTimeout(() => $('p-text')?.focus(), 0); }

  async function keepDraft() {
    const text = editorText().replace(/\s+$/, '');
    if (!text.trim()) return;
    let p = current();
    const isExample = !p && R.text == null;
    if (isExample) return;
    if (!p) p = { id: 'poem-' + uid(), title: R.title.trim() || clip(firstLine(text), 60), drafts: [], createdAt: new Date().toISOString() };
    const last = drafts(p).at(-1);
    if (last && last.text === text && (last.note || '') === R.note.trim()) { toast('This draft is already kept.'); return; }
    const b = safeBoard(text);
    const heats = b ? Object.fromEntries(po.POEM_CHANNELS.map(ch => [ch, b.channels[ch].heat])) : null;
    p = { ...p, title: R.title.trim() || p.title, drafts: [...drafts(p), { text, channel: R.channel, note: R.note.trim(), at: new Date().toISOString(), heats }] };
    try { await putPoem(p); } catch { toast('The draft could not be kept. Copy it somewhere safe and try again.'); return; }
    R.poemId = p.id; R.text = null; R.note = ''; persist();
    toast(`Draft ${p.drafts.length} kept${R.channel !== 'any' ? `: ${R.channel}` : ''}.`);
    renderPoems();
  }
  async function respond() {
    const text = editorText().trim();
    if (!text) return;
    const b = safeBoard(text);
    if (!b) return;
    const out = await ask('respond', respondPrompt(text, b, { question: R.question.trim(), opinions: R.opinions, tradition: R.lightOf }),
      o => o && Array.isArray(o.meaning) && Array.isArray(o.questions));
    if (!out) return;
    R.response = { text, meaning: out.meaning.map(String), answer: String(out.answer || ''), questions: out.questions.map(String), opinions: Array.isArray(out.opinions) ? out.opinions.map(String) : [], question: R.question.trim(), at: new Date().toISOString() };
    say('Claude responded, in Lerman\'s order.');
    renderPoems();
  }
  async function moves() {
    const text = editorText().trim();
    if (!text) return;
    const b = safeBoard(text);
    if (!b) return;
    const out = await ask('moves', movesPrompt(text, b, R.channel), o => o && Array.isArray(o.moves) && o.moves.length);
    if (!out) return;
    R.moves = { channel: R.channel, list: out.moves.slice(0, 5).map(m => ({ line: Number(m.line) || 0, move: String(m.move || ''), why: String(m.why || '') })) };
    renderPoems();
  }

  function compareView(p, text, b) {
    const i = Number(R.compare);
    const d = drafts(p)[i];
    if (!d) return '';
    const then = d.heats || (safeBoard(d.text) && Object.fromEntries(po.POEM_CHANNELS.map(ch => [ch, safeBoard(d.text).channels[ch].heat]))) || {};
    const moved = po.POEM_CHANNELS.filter(ch => typeof then[ch] === 'number' && Math.abs(b.channels[ch].heat - then[ch]) >= 0.08)
      .map(ch => `${(po.POEM_CHANNEL_NAMES || {})[ch] || ch} ${then[ch] < b.channels[ch].heat ? 'warmer' : 'cooler'} (${temperature(then[ch])} → ${temperature(b.channels[ch].heat)})`);
    return h('section', { class: 'twin', 'aria-label': 'Two drafts side by side' },
      h('div', {}, h('p', { class: 'label', text: `Draft ${i + 1}${d.channel && d.channel !== 'any' ? ` · ${d.channel}` : ''} · ${fmtDate(d.at)}` }), h('pre', { class: 'poemtext', text: d.text }), d.note ? h('p', { class: 'note', text: d.note }) : ''),
      h('div', {}, h('p', { class: 'label', text: 'Now' }), h('pre', { class: 'poemtext', text }),
        h('p', { class: 'note', text: moved.length ? `Since then: ${moved.join('; ')}.` : 'The board has barely moved since then.' })));
  }

  function renderPoems() {
    const el = $('poems');
    if (!el || el.hidden) return;
    const p = current();
    const text = editorText();
    const isExample = !p && R.text == null;
    const b = safeBoard(text);
    const ta = h('textarea', { id: 'p-text', class: 'poembox', rows: '14', spellcheck: 'true', 'aria-label': 'Your poem',
      oninput: e => { R.text = e.target.value; persist(); refresh(); } });
    ta.value = text;
    const head = h('div', { class: 'room__head' },
      h('h2', { class: 'sec-h', id: 'poems-h', text: 'Your poems' }),
      h('p', { class: 'sec-lede', text: 'Paste a poem and read it on Morton\'s board: five channels, cool to hot, and what the ear finds. Revise one channel per draft and keep every draft; ask Claude to respond in Lerman\'s order when you want a reader.' }),
      h('p', { class: 'note', text: storeNote() }));
    const list = h('div', { class: 'shelfrow', role: 'group', 'aria-label': 'Your poems' },
      ...R.poems.map(x => h('button', { class: 'pill', 'aria-current': x.id === R.poemId ? 'true' : 'false', onclick: () => openPoem(x.id) },
        h('span', { text: clip(x.title || firstLine(drafts(x).at(-1)?.text) || 'Untitled', 36) }), h('b', { text: String(drafts(x).length) }))),
      h('button', { class: 'btn btn--small', onclick: newPoem, text: 'New poem' }));
    const steps = h('span', { class: 'seg', role: 'group', 'aria-label': 'This draft works on' }, ...STEPS.map(([id, label, what]) => h('button', {
      'aria-pressed': R.channel === id ? 'true' : 'false', title: what, onclick: () => { R.channel = id; persist(); renderPoems(); }, text: label })));
    const title = h('input', { id: 'p-title', class: 'plate__title', placeholder: isExample ? EXAMPLE.title : 'Title', 'aria-label': 'Title',
      oninput: e => { R.title = e.target.value; persist(); } });
    title.value = isExample ? '' : R.title || (p ? p.title : '');
    const note = h('input', { id: 'p-note', class: 'noteinput', placeholder: 'What this draft sets out to change (optional)', 'aria-label': 'What this draft sets out to change',
      oninput: e => { R.note = e.target.value; persist(); } });
    note.value = R.note;
    const history = p ? h('ol', { class: 'drafts' }, ...drafts(p).map((d, i) => h('li', {},
      h('button', { class: 'btn btn--link btn--small', 'aria-pressed': String(R.compare) === String(i) ? 'true' : 'false',
        onclick: () => { R.compare = String(R.compare) === String(i) ? '' : String(i); renderPoems(); } },
      `Draft ${i + 1}${d.channel && d.channel !== 'any' ? ` · ${d.channel}` : ''} · ${fmtDate(d.at)}`)))) : '';
    const sample = env().sample;
    const respondBox = h('section', { class: 'ask', 'aria-label': 'Ask Claude to respond' },
      h('p', { class: 'label', text: 'A reader' }),
      h('p', { class: 'note', text: 'Claude answers in Liz Lerman\'s order: what is meaningful, your question, neutral questions, and opinions only if you ask. It does not rewrite your poem. Your poem is sent only when you press a button.' }),
      (() => { const q = h('input', { id: 'p-question', class: 'noteinput', placeholder: 'Your question about the poem (optional)', 'aria-label': 'Your question', oninput: e => { R.question = e.target.value; } }); q.value = R.question; return q; })(),
      h('div', { class: 'acts' },
        h('label', { class: 'check' }, (() => { const c = h('input', { type: 'checkbox', id: 'p-opinions', onchange: e => { R.opinions = e.target.checked; } }); c.checked = R.opinions; return c; })(), 'Include opinions'),
        h('label', { class: 'check' }, 'In the light of ', (() => {
          const s = h('select', { id: 'p-light', onchange: e => { R.lightOf = e.target.value; } }, h('option', { value: '', text: 'Morton alone' }),
            ...STUDY.traditions.filter(t => t.id !== 'morton').map(t => h('option', { value: t.id, text: t.name })));
          s.value = R.lightOf; return s; })())),
      h('div', { class: 'acts' },
        h('button', { class: 'btn btn--go', disabled: !sample || !!R.busy || !text.trim() || isExample, onclick: respond, text: 'Respond' }),
        h('button', { class: 'btn', disabled: !sample || !!R.busy || !text.trim() || isExample || R.channel === 'any', onclick: moves,
          text: R.channel === 'any' ? 'Pick a channel for ideas' : `Three ${R.channel} moves` }),
        sample === false ? h('span', { class: 'note', text: 'Claude is not available on this view; the board still works.' }) : ''),
      busyView('respond'), busyView('moves'),
      R.response && R.response.text === text.trim() ? h('div', { class: 'reply' },
        h('p', { class: 'label', text: 'What is meaningful' }), h('ul', {}, ...R.response.meaning.map(x => h('li', { text: x }))),
        R.response.answer ? [h('p', { class: 'label', text: 'Your question' }), h('p', { text: R.response.answer })] : '',
        h('p', { class: 'label', text: 'Neutral questions' }), h('ul', {}, ...R.response.questions.map(x => h('li', { text: x }))),
        R.response.opinions.length ? [h('p', { class: 'label', text: 'Opinions, as asked' }), h('ul', {}, ...R.response.opinions.map(x => h('li', { text: x })))] : '') : '',
      R.moves && R.moves.channel === R.channel ? h('div', { class: 'reply' }, h('p', { class: 'label', text: `${R.channel} moves` }),
        h('ol', {}, ...R.moves.list.map(m => h('li', {}, m.line ? h('b', { text: `Line ${m.line}. ` }) : '', m.move, m.why ? h('span', { class: 'quiet', text: ` ${m.why}` }) : '')))) : '');
    el.replaceChildren(head, list,
      h('div', { class: 'desk' },
        h('div', { class: 'stage' },
          h('div', { class: 'plate plate--own' }, title,
            isExample ? h('p', { class: 'note', text: 'An example, so the board has something to read. Type or paste over it and it becomes your poem.' }) : '',
            ta),
          h('div', { class: 'how__row' }, h('span', { class: 'label', text: 'This draft works on' }), steps),
          note,
          h('div', { class: 'acts' },
            h('button', { class: 'btn btn--go', disabled: isExample || !text.trim(), onclick: keepDraft, text: p ? 'Keep as a new draft' : 'Keep this poem' }),
            p ? h('button', { class: 'btn btn--link btn--small', onclick: () => deletePoem(p), text: 'Delete this poem' }) : ''),
          history, p && R.compare !== '' && b ? compareView(p, text, b) : '',
          respondBox),
        h('aside', { class: 'poem', 'aria-label': 'The board' }, h('div', { id: 'p-board' }, b ? [h('p', { class: 'label', text: 'How it runs' }), boardRows(b), h('p', { class: 'label', text: 'What the ear finds' }), finds(b)] : h('p', { class: 'note', text: 'Write a line and the board will read it.' })))));
  }
  let refreshTimer = 0;
  function refresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      const box = $('p-board');
      if (!box) return;
      const b = safeBoard(editorText());
      box.replaceChildren(...(b ? [h('p', { class: 'label', text: 'How it runs' }), boardRows(b), h('p', { class: 'label', text: 'What the ear finds' }), finds(b)] : [h('p', { class: 'note', text: 'Write a line and the board will read it.' })]));
    }, 220);
  }
  let pendingDelete = '';
  async function deletePoem(p) {
    if (pendingDelete !== p.id) { pendingDelete = p.id; toast(`Press Delete again to delete “${p.title || 'this poem'}” and all its drafts.`); setTimeout(() => { pendingDelete = ''; }, 5000); return; }
    pendingDelete = '';
    try { await dropPoem(p.id); } catch { toast('It could not be deleted; try again.'); return; }
    R.poemId = ''; R.text = null; persist(); renderPoems(); toast('Deleted.');
  }

  // ---------------------------------------------------------------- Practice

  const todays = () => (PRACTICE.length ? PRACTICE[dayNo() % PRACTICE.length] : null);
  const exercise = () => PRACTICE.find(x => x.id === R.ex) || todays();
  function sources() {
    const out = [];
    for (const s of DATA.songs) out.push({ id: `song:${s.id}`, label: `${DATA.text.unitLabel} ${s.no}, ${s.title} (the accurate English)`, text: s.lines.map(l => l.en).filter(Boolean).join('\n'), src: s.lines.map(l => `${l.bn} ${l.bnEnd}`.trim()).join('\n') });
    for (const p of STUDY.poems) out.push({ id: `study:${p.id}`, label: `${p.poet}, ${p.title}`, text: (p.english && p.english.length ? p.english : p.original).join('\n') });
    for (const p of R.poems) out.push({ id: `mine:${p.id}`, label: `Yours: ${p.title || 'Untitled'}`, text: drafts(p).at(-1)?.text || '' });
    return out;
  }
  async function keepExercise(x) {
    const text = R.exText.trim();
    if (!text) return;
    try { await putEntry({ id: 'j-' + uid(), kind: 'exercise', ref: x.id, title: x.title, text, with: R.exWith || '', at: new Date().toISOString() }); }
    catch { toast('It could not be kept. Copy it somewhere safe and try again.'); return; }
    R.exText = ''; persist(); toast('Kept in your journal.'); renderPractice();
  }
  function renderPractice() {
    const el = $('practice');
    if (!el || el.hidden) return;
    const x = exercise();
    if (!x) { el.replaceChildren(h('p', { class: 'note', text: 'No exercises in this build.' })); return; }
    const today = todays();
    const src = sources().find(s => s.id === R.exWith);
    const ta = h('textarea', { id: 'x-text', class: 'poembox', rows: '8', 'aria-label': 'Your work on this exercise', oninput: e => { R.exText = e.target.value; persist(); refreshX(); } });
    ta.value = R.exText;
    const b = R.exText.trim() ? safeBoard(R.exText) : null;
    const filters = ['all', ...new Set(PRACTICE.map(e => e.tradition))];
    el.replaceChildren(
      h('div', { class: 'room__head' },
        h('h2', { class: 'sec-h', id: 'practice-h', text: 'Practice' }),
        h('p', { class: 'sec-lede', text: 'One exercise a day, from Morton\'s classroom, the Sufi and Zen poets, Shakespeare\'s grammar school and the Irish bardic schools. Do it on a song, a touchstone, or one of your own poems; keep what you make in your journal.' }),
        h('p', { class: 'note', text: storeNote() })),
      h('div', { class: 'desk' },
        h('div', { class: 'stage' },
          h('article', { class: 'exercise' },
            h('p', { class: 'label', text: x.id === today?.id ? 'Today\'s exercise' : 'Exercise' }),
            h('h3', { class: 'exercise__t', text: x.title }),
            h('p', { class: 'idea__meta' }, h('b', { text: TRADITION_NAMES[x.tradition] || x.tradition }), ` · ${x.channel} · about ${x.minutes} minutes`),
            h('ol', { class: 'exercise__steps' }, ...x.steps.map(s => h('li', { text: s }))),
            x.why ? h('p', { class: 'note', text: x.why }) : '',
            x.id !== today?.id && today ? h('button', { class: 'btn btn--link btn--small', onclick: () => { R.ex = ''; persist(); renderPractice(); }, text: `Back to today's: ${today.title}` }) : ''),
          h('div', { class: 'how__row' }, h('span', { class: 'label', text: 'Work with' }), (() => {
            const s = h('select', { id: 'x-with', onchange: e => { R.exWith = e.target.value; persist(); renderPractice(); } }, h('option', { value: '', text: 'Nothing: start from a blank page' }),
              ...sources().map(o => h('option', { value: o.id, text: clip(o.label, 70) })));
            s.value = R.exWith; return s; })()),
          src ? h('details', { class: 'gloss', open: true }, h('summary', { text: 'The text you are working with' }),
            src.src ? h('pre', { class: 'poemtext bn', lang: 'bn', text: src.src }) : '', h('pre', { class: 'poemtext', text: src.text })) : '',
          ta,
          h('div', { class: 'acts' }, h('button', { class: 'btn btn--go', disabled: !R.exText.trim(), onclick: () => keepExercise(x), text: 'Keep in my journal' })),
          h('section', { class: 'journal', 'aria-labelledby': 'journal-h' },
            h('h3', { class: 'exercise__t', id: 'journal-h', text: 'Your journal' }),
            R.journal.length ? h('ol', { class: 'jlist' }, ...R.journal.slice(0, 40).map(e => h('li', {},
              h('details', {}, h('summary', {}, h('b', { text: e.title || e.ref }), h('span', { class: 'quiet', text: ` · ${fmtDate(e.at)}` })),
                e.question ? h('p', { class: 'note', text: e.question }) : '', h('pre', { class: 'poemtext', text: e.text }))))) : h('p', { class: 'note', text: 'Nothing kept yet.' }))),
        h('aside', { class: 'poem', 'aria-label': 'All exercises' },
          h('div', { id: 'x-board' }, b ? [h('p', { class: 'label', text: 'How your page runs' }), boardRows(b)] : ''),
          h('p', { class: 'label', text: 'All exercises' }),
          h('span', { class: 'seg seg--wrap', role: 'group', 'aria-label': 'Tradition' }, ...filters.map(f => h('button', {
            'aria-pressed': R.exFilter === f ? 'true' : 'false', onclick: () => { R.exFilter = f; persist(); renderPractice(); }, text: f === 'all' ? 'All' : TRADITION_NAMES[f] || f }))),
          h('ul', { class: 'exlist' }, ...PRACTICE.filter(e => R.exFilter === 'all' || e.tradition === R.exFilter).map(e => h('li', {},
            h('button', { class: 'exlist__b', 'aria-current': e.id === x.id ? 'true' : 'false', onclick: () => { R.ex = e.id; persist(); renderPractice(); window.scrollTo({ top: 0 }); } },
              h('span', { class: 'exlist__t', text: e.title }), h('span', { class: 'exlist__m', text: `${TRADITION_NAMES[e.tradition] || e.tradition} · ${e.channel} · ${e.minutes} min` }))))))));
  }
  let xTimer = 0;
  function refreshX() {
    clearTimeout(xTimer);
    xTimer = setTimeout(() => {
      const box = $('x-board');
      if (!box) return;
      const b = R.exText.trim() ? safeBoard(R.exText) : null;
      box.replaceChildren(...(b ? [h('p', { class: 'label', text: 'How your page runs' }), boardRows(b)] : []));
      const btn = $('practice')?.querySelector('.btn--go'); if (btn) btn.disabled = !R.exText.trim();
    }, 250);
  }

  // ---------------------------------------------------------------- Study

  const DIR = { fa: 'rtl', ar: 'rtl' };
  function studyPoems() { return STUDY.poems.filter(p => p.tradition === R.tradition); }
  async function keepAnswer(p, q, text) {
    if (!text.trim()) return;
    try { await putEntry({ id: 'j-' + uid(), kind: 'study', ref: p.id, title: `${p.title}: a question`, question: q, text: text.trim(), at: new Date().toISOString() }); }
    catch { toast('It could not be kept; try again.'); return; }
    R.answering = ''; toast('Kept in your journal (Practice).'); renderStudy();
  }
  function lines(arr, attrs = {}) { return h('div', { class: 'lines-of', ...attrs }, ...(arr || []).map(l => (l ? h('p', { text: l }) : h('p', { class: 'gap', 'aria-hidden': 'true', text: ' ' })))); }
  function renderStudy() {
    const el = $('study');
    if (!el || el.hidden) return;
    const trads = [...STUDY.traditions, ...(STUDY.across && STUDY.across.length ? [{ id: 'across', name: 'Across' }] : [])];
    const tabs = h('span', { class: 'seg seg--wrap', role: 'group', 'aria-label': 'Tradition' }, ...trads.map(t => h('button', {
      'aria-pressed': R.tradition === t.id ? 'true' : 'false', onclick: () => { R.tradition = t.id; R.studyPoem = ''; persist(); renderStudy(); }, text: t.name })));
    const head = h('div', { class: 'room__head' },
      h('h2', { class: 'sec-h', id: 'study-h', text: 'Study' }),
      h('p', { class: 'sec-lede', text: 'The touchstones of five ways of making poems, read on Morton\'s board: how each poem makes its heat, what survives into English, and questions to answer in your journal. Texts are originals and translations old enough to be free.' }),
      tabs);
    if (R.tradition === 'across') {
      const cols = ['carya', 'sufi', 'zen', 'shakespeare', 'bardic'];
      el.replaceChildren(head, h('div', { class: 'tablewrap' }, h('table', { class: 'planets across' },
        h('thead', {}, h('tr', {}, h('th', { text: 'The problem' }), ...['The caryā', 'Sufi', 'Zen', 'Shakespeare', 'Bardic'].map(t => h('th', { text: t })))),
        h('tbody', {}, ...STUDY.across.map(r => h('tr', {}, h('th', { scope: 'row', text: r.problem }), ...cols.map(c => h('td', { text: r[c] || '' }))))))));
      return;
    }
    const T = STUDY.traditions.find(t => t.id === R.tradition);
    const ps = studyPoems();
    const p = ps.find(x => x.id === R.studyPoem) || ps[0];
    if (!p) { el.replaceChildren(head, h('p', { class: 'note', text: 'No poems for this tradition in this build.' })); return; }
    const english = p.english && p.english.length ? p.english : p.lang === 'en' ? p.original : null;
    const b = english ? safeBoard(english.join('\n')) : null;
    const toggles = h('span', { class: 'seg', role: 'group', 'aria-label': 'Show' }, ...[['tl', 'Transliteration', !!(p.translit && p.translit.length)], ['gloss', 'Gloss', !!(p.gloss && p.gloss.length)]]
      .filter(x => x[2]).map(([k, label]) => h('button', { 'aria-pressed': R.show[k] ? 'true' : 'false', onclick: () => { R.show = { ...R.show, [k]: !R.show[k] }; persist(); renderStudy(); }, text: label })));
    el.replaceChildren(head,
      T ? h('p', { class: 'note study__sum', text: `${T.summary}${T.research ? ` (Research: ${T.research}.)` : ''}` }) : '',
      h('div', { class: 'shelfrow', role: 'group', 'aria-label': 'Poems' }, ...ps.map(x => h('button', { class: 'pill', 'aria-current': x.id === p.id ? 'true' : 'false',
        onclick: () => { R.studyPoem = x.id; persist(); renderStudy(); } }, h('span', { text: clip(x.title, 34) })))),
      h('div', { class: 'desk' },
        h('div', { class: 'stage' },
          h('article', { class: 'plate plate--study' },
            h('div', { class: 'plate__holes', 'aria-hidden': 'true' }, h('i'), h('i')),
            h('h3', { class: 'study__t', text: p.title }),
            h('p', { class: 'plate__by', text: [p.poet, p.date].filter(Boolean).join(', ') }),
            p.lang !== 'en' ? lines(p.original, { lang: p.lang, dir: DIR[p.lang] || 'ltr', class: `lines-of orig orig--${p.lang}` }) : '',
            R.show.tl && p.translit && p.translit.length ? lines(p.translit, { class: 'lines-of tl' }) : '',
            R.show.gloss && p.gloss && p.gloss.length ? lines(p.gloss, { class: 'lines-of gl' }) : '',
            english ? lines(english, { class: 'lines-of en' }) : '',
            p.englishBy ? h('p', { class: 'plate__by', text: `English: ${p.englishBy}` }) : '',
            toggles.childNodes.length ? h('div', { class: 'acts minor' }, toggles) : '',
            p.verified ? h('p', { class: 'note', text: `Text: ${p.verified}` }) : ''),
          h('section', {}, h('p', { class: 'label', text: 'What the study found' }), h('ul', { class: 'obs' }, ...(p.notes || []).map(n => h('li', { text: n })))),
          h('section', {}, h('p', { class: 'label', text: 'Questions' }), h('ol', { class: 'obs' }, ...(p.questions || []).map((q, i) => {
            const key = `${p.id}:${i}`;
            const box = R.answering === key ? h('div', { class: 'answer' }, h('textarea', { id: `a-${i}`, class: 'poembox', rows: '4', 'aria-label': 'Your answer' }),
              h('div', { class: 'acts' }, h('button', { class: 'btn btn--go btn--small', onclick: () => keepAnswer(p, q, $(`a-${i}`).value), text: 'Keep in my journal' }),
                h('button', { class: 'btn btn--link btn--small', onclick: () => { R.answering = ''; renderStudy(); }, text: 'Cancel' }))) : '';
            return h('li', {}, q, ' ', R.answering === key ? '' : h('button', { class: 'btn btn--link btn--small', onclick: () => { R.answering = key; renderStudy(); setTimeout(() => $(`a-${i}`)?.focus(), 0); }, text: 'Answer' }), box);
          })))),
        h('aside', { class: 'poem', 'aria-label': 'The board' }, b
          ? [h('p', { class: 'label', text: p.lang === 'en' ? 'How it runs' : `How the English runs (${p.englishBy || 'translation'})` }), boardRows(b), h('p', { class: 'label', text: 'What the ear finds' }), finds(b),
            p.lang !== 'en' ? h('p', { class: 'note', text: 'The board reads English only. Where the original keeps its heat, and what the English lost, is in the notes.' }) : '']
          : h('p', { class: 'note', text: 'No free English translation of this one: read it through the gloss, and the notes say where its heat lives.' }))));
  }

  function rerender(which = ['poems', 'practice', 'study']) {
    if (which.includes('poems')) renderPoems();
    if (which.includes('practice')) renderPractice();
    if (which.includes('study')) renderStudy();
  }
  return { connect, renderPoems, renderPractice, renderStudy, rerender, has: v => ['poems', 'practice', 'study'].includes(v) };
}
