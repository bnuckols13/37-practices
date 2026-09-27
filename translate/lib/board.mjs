/**
 * The mixing board of an English version, and two boards compared: the
 * half of lib/reading.mjs that needs only an English ear, so the Workshop
 * page can bundle it and hear a line as it is typed. Heat runs 0 (cool:
 * variation) to 1 (hot: repetition, pattern). See lib/reading.mjs.
 */

import * as en from './english.mjs';

export const CHANNELS = ['lineation', 'syntax', 'rhythm', 'rhyme'];
export const CHANNEL_NAMES = { lineation: 'Lineation', syntax: 'Syntax', rhythm: 'Rhythm', rhyme: 'Rhyme' };

export function temperature(h) {
  if (h >= 0.75) return 'hot';
  if (h >= 0.55) return 'warm';
  if (h >= 0.3) return 'mild';
  return 'cool';
}

export const round = x => Math.round(x * 100) / 100;
export const clamp = x => Math.max(0, Math.min(1, x));
export const mean = xs => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
export const spread = xs => { const m = mean(xs); return m ? Math.sqrt(mean(xs.map(x => (x - m) ** 2))) / m : 0; };
export function mode(xs) {
  const c = new Map();
  for (const x of xs) c.set(x, (c.get(x) || 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? 0;
}
export const median = xs => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };

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
  // A song's groove bends: a line a beat off it is syncopation, half on the groove.
  const onGroove = beats.reduce((n, b) => n + (b === groove ? 1 : Math.abs(b - groove) === 1 ? 0.5 : 0), 0) / Math.max(1, beats.length);
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
        `groove ${groove} beats a line; ${beats.filter(b => b === groove).length} of ${beats.length} lines on it, ${beats.filter(b => Math.abs(b - groove) === 1).length} a beat off`,
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

