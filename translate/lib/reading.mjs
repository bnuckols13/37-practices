/**
 * How a song works: a close reading scaffold after Timothy Morton's course
 * "How to Read a Poem" (UC Davis): Structure, Texture, Perception, Narrator,
 * Narrative, in that order, reading out of the poem rather than into it.
 *
 * The mixing board. Morton hears every channel of a poem on one spectrum:
 * hot is repetition, consistency, pattern (the drum machine, "four to the
 * floor"); cool is variation, inconsistency, surprise. A poem's effect is the
 * conversation between channels (hot lineation, cool syntax: a Baked Alaska).
 * Four channels are measured here from the text itself: lineation and syntax
 * (structure), rhythm and rhyme (texture). Heat runs 0 (cool) to 1 (hot).
 *
 * For translation the board is a tool, not a verdict: read the source's
 * temperature channel by channel, then set the English's. Match it, or trade
 * one channel for another knowingly and say so. Every figure is an estimate
 * for the ear to check aloud; nothing here refuses a line.
 */

import { cleanLine, syllables, soundProfile } from './sound.mjs';
import * as en from './english.mjs';

export const CHANNELS = ['lineation', 'syntax', 'rhythm', 'rhyme'];
export const CHANNEL_NAMES = { lineation: 'Lineation', syntax: 'Syntax', rhythm: 'Rhythm', rhyme: 'Rhyme' };

export function temperature(h) {
  if (h >= 0.75) return 'hot';
  if (h >= 0.55) return 'warm';
  if (h >= 0.3) return 'mild';
  return 'cool';
}

const round = x => Math.round(x * 100) / 100;
const clamp = x => Math.max(0, Math.min(1, x));
const mean = xs => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const spread = xs => { const m = mean(xs); return m ? Math.sqrt(mean(xs.map(x => (x - m) ** 2))) / m : 0; };
function mode(xs) {
  const c = new Map();
  for (const x of xs) c.set(x, (c.get(x) || 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? 0;
}
const median = xs => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };

// ---------------------------------------------------------------- the source

const LONG_V = ['ai', 'au', 'ā', 'ī', 'ū', 'e', 'o'];
const ALL_V = ['ai', 'au', 'ā', 'ī', 'ū', 'e', 'o', 'a', 'i', 'u', 'ṛ'];
const ASPIRATE = /^(kh|gh|ch|jh|ṭh|ḍh|th|dh|ph|bh|ṛh)/;
const consonantCount = onset => { let n = 0, s = onset; while (s) { const m = ASPIRATE.exec(s); s = s.slice(m ? m[0].length : 1); n++; } return n; };

/**
 * Mātrās (morae) of a transliterated half-line, counted strictly: a long vowel
 * two, a short one, a short vowel closed by a nasal or standing before a
 * conjunct two. Sung Old Bengali shortens e and o and stretches line ends as
 * the tune wants, so this is the written weight, not the sung one.
 */
export function morae(translit) {
  let total = 0;
  for (const w of cleanLine(translit).replace(/[[\]]/g, '').split(' ').filter(Boolean)) {
    const syl = syllables(w);
    syl.forEach((sy, i) => {
      const v = ALL_V.find(x => sy.includes(x));
      if (!v) return;
      const after = sy.slice(sy.indexOf(v) + v.length);
      let m = LONG_V.includes(v) ? 2 : 1;
      if (m === 1) {
        if (/m̐|ṃ|̐/.test(after)) m = 2;
        const next = syl[i + 1];
        if (next) { if (consonantCount(next.split(/[aāiīuūeoṛ]/)[0]) >= 2) m = 2; }
        else if (after.replace(/m̐|ṃ|̐/g, '')) m = 2;
      }
      total += m;
    });
  }
  return total;
}

// Spellings the ear does not keep apart (as lib/sound.mjs folds them).
const fold = s => String(s).normalize('NFC').replace(/m̐|ṃ|̐|́/g, '')
  .replace(/v/g, 'b').replace(/y/g, 'j').replace(/ḍ/g, 'ṛ').replace(/ṇ/g, 'n').replace(/[śṣ]/g, 's')
  .replace(/ṭ/g, 't').replace(/ā/g, 'a').replace(/ī/g, 'i').replace(/ū/g, 'u')
  .replace(/([bcdghjklmnprstṅñṛ])\1/g, '$1');

const vowelsOf = w => (fold(w).match(/ai|au|[aeiouṛ]/g) || []);
const skeleton = w => fold(w).replace(/ai|au|[aeiou]/g, '.');

/**
 * Where two Old Bengali end words sit in Morton's solar system of rhyme,
 * judged on the last two syllables: absolute (the same word), perfect (vowels
 * and consonants alike from the vowel before the last syllable on), vowel
 * (vowels alike, consonants not), off (consonants alike, a vowel shifts),
 * alliteration, or none.
 */
export function sourceRhyme(a, b) {
  const x = fold(a), y = fold(b);
  if (!x || !y) return 'none';
  if (x === y) return 'absolute';
  const tail = w => { const s = syllables(w); return s.slice(-2).join(''); };
  const tx = tail(x), ty = tail(y);
  const rime = t => t.replace(/^[^aeiouṛ]+/, '');
  if (rime(tx) === rime(ty)) return 'perfect';
  const vx = vowelsOf(x).slice(-2).join(), vy = vowelsOf(y).slice(-2).join();
  const kx = skeleton(tx).replace(/^[^.]*/, ''), ky = skeleton(ty).replace(/^[^.]*/, '');
  if (vx === vy) return 'vowel';
  if (kx === ky && vowelsOf(x).slice(-1)[0] === vowelsOf(y).slice(-1)[0]) return 'off';
  if (kx === ky) return 'para';
  if (x[0] === y[0] && !/[aeiou]/.test(x[0])) return 'alliteration';
  return 'none';
}

// Words a song strikes again and again: a name, a call, a doubled word.
function repeats(lines) {
  const raw = lines.flatMap(l => cleanLine(l.translit).split(' ')).filter(w => fold(w).length > 2);
  const words = raw.map(fold);
  const shown = new Map();
  raw.forEach((w, i) => { if (!shown.has(words[i])) shown.set(words[i], w); });
  const count = new Map();
  for (const w of words) count.set(w, (count.get(w) || 0) + 1);
  const struck = [...count.entries()].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]).map(([w, n]) => [shown.get(w), n]);
  const inLine = lines.filter(l => { const ws = cleanLine(l.translit).split(' ').map(fold).filter(w => w.length > 2); return new Set(ws).size < ws.length; });
  return { struck, share: words.length ? struck.reduce((n, [, k]) => n + k, 0) / words.length : 0, inLine: inLine.map(l => l.id) };
}

// Subordination the gloss makes visible: absolutives ("having …"), relatives, conditions.
const GLOSS_HYPO = /\bhaving\b|\bwho\b|\bwhich\b|\bwhose\b|\bwhen\b|\bif\b|\bwhile\b|\bbecause\b|\babsol/gi;
const CALLS = new Set(['alo', 'halo', 'lo', 're', 'he', 'ahe', 'o']);

/** The board of the source, from the unit and the accurate draft's glosses. */
export function sourceBoard(unit, draft = null) {
  const verse = unit.lines.filter(l => l.role === 'line');
  const profile = soundProfile(unit);
  const gloss = new Map((draft?.lines || []).map(l => [l.id, l.gloss || '']));
  const m = verse.map(l => ({ id: l.id, morae: morae(l.translit), syllables: syllables(cleanLine(l.translit).replace(/ /g, '')).length }));

  // Rhythm: the groove (the usual weight of a half-line), then what departs from it.
  const weights = m.map(x => x.morae);
  const groove = median(weights);
  const off = m.filter(x => Math.abs(x.morae - groove) > Math.max(3, groove * 0.2));
  const rhythmHeat = clamp(1 - spread(weights) * 2.2) * 0.8 + (profile.refrain ? 0.15 : 0);

  // Rhyme: each couplet's place in the solar system, and the words struck again.
  const couplets = profile.couplets.map(c => {
    const kind = c.halves.length === 2 ? sourceRhyme(c.halves[0].end.word, c.halves[1].end.word) : 'none';
    return { group: c.group, refrain: c.refrain, bhanita: c.bhanita, kind, heat: en.PLANETS[kind].heat, ends: c.halves.map(h => h.end.word) };
  });
  const rep = repeats(verse);
  const rhymeHeat = clamp(mean(couplets.map(c => c.heat)) * 0.8 + Math.min(0.3, rep.share * 1.5) + (profile.refrain ? 0.05 : 0));

  // Lineation: couplets closed by daṇḍas, a refrain that comes round, half-lines of like length.
  const closers = profile.couplets.map(c => verse.filter(l => l.group === c.group).pop()).filter(Boolean);
  const closed = closers.filter(l => /\|/.test(l.translit) || /॥|।/.test(l.src)).length / Math.max(1, closers.length);
  const lineationHeat = clamp(0.45 * closed + (profile.refrain ? 0.3 : 0) + 0.25 * clamp(1 - spread(m.map(x => x.syllables)) * 2));

  // Syntax: clauses side by side, unless the gloss shows one hung under another.
  const hypo = verse.reduce((n, l) => n + ((gloss.get(l.id) || '').match(GLOSS_HYPO) || []).length, 0);
  const syntaxHeat = clamp(verse.length / (verse.length + hypo * 1.5));

  // Narrator: calls, commands, the singer's I and you, the poet naming himself.
  const words = verse.flatMap(l => cleanLine(l.translit).split(' ').map(fold));
  const calls = words.filter(w => CALLS.has(w)).length;
  const commands = verse.filter(l => /imper/i.test(gloss.get(l.id) || '')).length;

  return {
    unit: unit.id,
    channels: {
      lineation: { heat: round(lineationHeat), facts: [
        `${profile.couplets.length} couplets of two half-lines, ${Math.round(closed * 100)}% of them closed by a double daṇḍa (॥)`,
        profile.refrain ? `the refrain (${profile.refrain}) comes round after every couplet (ধ্রু, dhru)` : 'no refrain marked',
      ] },
      syntax: { heat: round(syntaxHeat), facts: [
        hypo ? `mostly side by side; the gloss shows ${hypo} clause${hypo > 1 ? 's' : ''} hung under another ("having …", who, when)` : 'clauses side by side: no subordination shows in the gloss',
      ] },
      rhythm: { heat: round(rhythmHeat), groove, facts: [
        `groove about ${groove} mātrās a half-line (strict written count; the classic caryā metre, pādākulaka, is 16)`,
        off.length ? `departs from it: ${off.map(x => `${x.id} (${x.morae})`).join(', ')}` : 'every half-line near the groove',
      ] },
      rhyme: { heat: round(rhymeHeat), facts: [
        `${couplets.filter(c => c.kind !== 'none').length} of ${couplets.length} couplets chime: ${couplets.map(c => `${c.group.split('.').pop()} ${c.kind}`).join(', ')}`,
        rep.struck.length ? `struck again and again (absolute rhyme): ${rep.struck.slice(0, 4).map(([w, n]) => `${w} ×${n}`).join(', ')}` : 'no word repeated across the song',
      ] },
    },
    couplets,
    halfLines: m,
    narrator: { calls, commands, bhanita: profile.bhanita, refrain: profile.refrain },
    repeats: rep,
  };
}

// ---------------------------------------------------------------- an English

/**
 * The board of an English version: lines [{id, en}] in the unit's order. The
 * unit supplies the couplets and the refrain, so the two boards line up.
 */
export function englishBoard(unit, lines) {
  const byId = new Map(lines.map(l => [l.id, String(l.en || '')]));
  const verse = unit.lines.filter(l => l.role === 'line' && byId.has(l.id));
  const scans = verse.map(l => ({ id: l.id, group: l.group, ...en.scan(byId.get(l.id)) }));
  const groups = [...new Set(verse.map(l => l.group))];

  const beats = scans.map(s => s.beats);
  const groove = mode(beats);
  const onGroove = beats.filter(b => Math.abs(b - groove) <= 0).length / Math.max(1, beats.length);
  const alternation = mean(scans.map(s => {
    const p = s.pattern; let alt = 0;
    for (let i = 1; i < p.length; i++) if (p[i] !== p[i - 1]) alt++;
    return p.length > 1 ? alt / (p.length - 1) : 0;
  }));
  const rhythmHeat = clamp(0.6 * onGroove + 0.4 * alternation);

  const couplets = groups.map(g => {
    const ls = verse.filter(l => l.group === g).map(l => byId.get(l.id));
    const r = ls.length === 2 ? en.rhymeLines(ls[0], ls[1]) : { kind: 'none', a: '', b: '' };
    return { group: g, kind: r.kind, heat: en.PLANETS[r.kind].heat, ends: [r.a, r.b], feminine: !!r.feminine };
  });
  const words = verse.flatMap(l => en.wordsOf(byId.get(l.id)).map(x => x.w)).filter(w => w.length > 3);
  const count = new Map();
  for (const w of words) count.set(w, (count.get(w) || 0) + 1);
  const struck = [...count.entries()].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]);
  const share = words.length ? struck.reduce((n, [, k]) => n + k, 0) / words.length : 0;
  const rhymeHeat = clamp(mean(couplets.map(c => c.heat)) * 0.8 + Math.min(0.3, share * 1.5));

  const stopped = verse.filter(l => en.endStopped(byId.get(l.id))).length / Math.max(1, verse.length);
  const lineationHeat = clamp(0.45 * stopped + 0.3 * onGroove + 0.25 * clamp(1 - spread(scans.map(s => s.syllables)) * 2));

  const { para, hypo } = en.syntaxOf(verse.map(l => byId.get(l.id)));
  const syntaxHeat = clamp((para + verse.length * 0.5) / (para + verse.length * 0.5 + hypo * 1.5));

  const masculine = scans.filter(s => s.pattern.endsWith('/')).length;
  return {
    channels: {
      lineation: { heat: round(lineationHeat), facts: [`${Math.round(stopped * 100)}% of lines end-stopped`, `line lengths ${Math.min(...scans.map(s => s.syllables))}–${Math.max(...scans.map(s => s.syllables))} syllables`] },
      syntax: { heat: round(syntaxHeat), facts: [`${para} joins side by side (and, but, commas, colons) against ${hypo} hung under (when, which, because)`] },
      rhythm: { heat: round(rhythmHeat), groove, facts: [
        `groove ${groove} beats a line; ${Math.round(onGroove * 100)}% of lines on it`,
        `${masculine} of ${scans.length} lines end on a stress (a strong close, as in "burning bright")`,
      ] },
      rhyme: { heat: round(rhymeHeat), facts: [
        `${couplets.filter(c => c.kind !== 'none').length} of ${couplets.length} couplets chime: ${couplets.map(c => `${c.group.split('.').pop()} ${c.kind}`).join(', ')}`,
        struck.length ? `words struck again: ${struck.slice(0, 4).map(([w, n]) => `${w} ×${n}`).join(', ')}` : 'no word repeated',
      ] },
    },
    couplets,
    scans,
  };
}

// ---------------------------------------------------------------- the two together

/**
 * Where an English runs hotter or cooler than its source, channel by channel,
 * and couplet by couplet for rhyme. Advice for the drafter and reviewer.
 */
export function compareBoards(src, eng, { label = 'the English' } = {}) {
  const out = [];
  for (const ch of CHANNELS) {
    const a = src.channels[ch].heat, b = eng.channels[ch].heat;
    // The source's syntax is read off the gloss, so only a wide gap is worth a word.
    if (Math.abs(a - b) < (ch === 'syntax' ? 0.35 : 0.25)) continue;
    out.push(`${CHANNEL_NAMES[ch]}: the source runs ${temperature(a)} (${a}), ${label} ${temperature(b)} (${b}); match it, or say what the trade buys`);
  }
  for (const c of src.couplets) {
    const e = eng.couplets.find(x => x.group === c.group);
    if (!e) continue;
    if (c.heat >= 0.6 && e.heat < 0.4) out.push(`${c.group}: the source chimes (${c.kind}: ${c.ends.join(' / ')}); ${label} does not (${e.kind}: ${e.ends.join(' / ')})`);
  }
  return out;
}

const bar = h => '▮'.repeat(Math.round(h * 5)).padEnd(5, '▯');

/** The five steps as plain text: the source's board, and beside it any English boards given. */
export function readingText(unit, src, englishes = [], { images = [], poet = '' } = {}) {
  const out = [];
  const head = (n, t) => out.push('', `${n} ${t}`);
  const row = (ch, label) => {
    const s = src.channels[ch];
    out.push(`  ${label.padEnd(10)} source ${temperature(s.heat).padEnd(5)} ${bar(s.heat)}  ${s.facts.join('; ')}`);
    for (const e of englishes) {
      const c = e.board.channels[ch];
      out.push(`  ${''.padEnd(10)} ${e.label.padEnd(6)} ${temperature(c.heat).padEnd(5)} ${bar(c.heat)}  ${c.facts.join('; ')}`);
    }
  };
  out.push(`${unit.id}${poet ? ' · ' + poet : ''}${unit.raga ? ' · rāga ' + unit.raga : ''}: how the song works (hot = repetition and pattern, cool = variation)`);
  head(1, 'STRUCTURE: the architecture before the meaning');
  row('lineation', 'Lineation'); row('syntax', 'Syntax');
  head(2, 'TEXTURE: the song in the mouth (rhythm is line, rhyme is colour)');
  row('rhythm', 'Rhythm'); row('rhyme', 'Rhyme');
  head(3, 'PERCEPTION: what it makes you see, in order (read it; not measured)');
  out.push(`  things, names and ideas the accurate English marks, in order: ${images.length ? images.join(' → ') : '(none marked)'}`);
  out.push('  Ask: what does the song force you to see first, and last? Which image is strange without its commentary? Keep it strange.');
  head(4, 'NARRATOR: who sings, to whom');
  const n = src.narrator;
  out.push(`  calls (ālo, hālo, lo, re): ${n.calls}; commands the gloss marks: ${n.commands}; the poet names himself in ${n.bhanita || '(not marked)'}`);
  out.push('  Ask: whose voice, to whom, how close? The self-naming (bhaṇitā) is the singer stepping outside his song to sign it.');
  head(5, 'NARRATIVE: how it moves, and where it turns');
  out.push(`  the refrain (${n.refrain || 'none'}) holds the song in place: absolute rhyme, the hottest there is`);
  out.push('  Ask: where does the song turn (from A to not-A)? Often at the self-naming couplet; sometimes a sudden threat or riddle.');
  for (const e of englishes) {
    const adv = compareBoards(src, e.board, { label: e.label });
    if (adv.length) { out.push('', `Against ${e.label}:`); for (const a of adv) out.push('  ~ ' + a); }
  }
  return out.join('\n');
}

/** The words the accurate English marks for the glossary, in order of first appearance: the song's things and names. */
export function markedWords(lines) {
  const seen = new Set(), out = [];
  for (const l of lines || []) {
    if (!/\d[a-z]$/.test(l.id)) continue;
    for (const m of String(l.en || '').matchAll(/\[([^\]]+)\]\{[^}]+\}/g)) if (!seen.has(m[1])) { seen.add(m[1]); out.push(m[1]); }
  }
  return out;
}

/** Temperature advice for one English version of a unit against its source. */
export function temperatureAdvice(unit, draft, lines, label = 'the English') {
  return compareBoards(sourceBoard(unit, draft), englishBoard(unit, lines), { label });
}
