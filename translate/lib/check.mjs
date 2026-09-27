/**
 * check: every validator, in one pass. Errors (E) exit 1; warnings (W)
 * become errors with --strict. Nothing here writes files.
 */

import fs from 'node:fs';
import path from 'node:path';
import { paths, readJSON, readText, exists, home, siteRoot, listFiles, nfc, fileSha, short } from './io.mjs';
import { loadText, unitsIndex, loadUnit, witnessOf } from './text.mjs';
import { load, byId, scoped, matchSource } from './glossary.mjs';
import { integrity } from './source.mjs';
import { buildPack, TASKS } from './pack.mjs';
import { ID_RE } from './ids.mjs';
import * as markup from './markup.mjs';
import { Draft } from '../schemas/draft.mjs';
import { Weave } from '../schemas/weave.mjs';
import { Approved, RunProvenance } from '../schemas/approved.mjs';
import { SungFiled, ApprovedSung } from '../schemas/sung.mjs';
import { forbiddenHere } from './review/sung.mjs';
import { songAdvice } from './sound.mjs';
import './ear.mjs';
import { temperatureAdvice } from './reading.mjs';

const words = s => markup.strip(s).toLowerCase().replace(/[^\p{L}\p{M}\s']/gu, ' ').split(/\s+/).filter(Boolean);
const fold = s => String(s).toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/\bdhru\b|[0-9]/g, '').replace(/[|।॥.,;:'"\s-]/g, '')
  .replace(/v/g, 'b').replace(/j/g, 'y').replace(/r/g, 'd');

function shingles(ws, n = 8) {
  const out = new Set();
  for (let i = 0; i + n <= ws.length; i++) out.add(ws.slice(i, i + n).join(' '));
  return out;
}

function privateShingles() {
  const set = new Set();
  const walk = dir => {
    if (!exists(dir)) return;
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, f.name);
      if (f.isDirectory()) walk(p);
      else if (/\.(txt|md|json|xml|tmx|html?)$/i.test(f.name)) for (const s of shingles(words(fs.readFileSync(p, 'utf8')))) set.add(s);
    }
  };
  walk(path.join(home(), '.private'));
  walk(path.join(home(), '.cache'));
  return set;
}

function quotesOver(s, max = 25) {
  return [...String(s).matchAll(/[“"]([^”"]+)[”"]/g)].map(m => m[1]).filter(q => q.split(/\s+/).length > max);
}

export function check(slug, { strict = false } = {}) {
  const E = [], W = [];
  const text = loadText(slug);
  const P = paths(slug);
  const g = load();
  const entries = byId(g);
  const inScope = scoped(g, slug);
  const author = text.commentary?.author || '';

  // 1. source integrity
  for (const p of integrity(slug, text)) E.push(`source: ${p}`);

  // 2. licensing
  for (const w of text.witnesses) {
    if (!w.license || /^TODO/i.test(w.license)) W.push(`witness ${w.id}: licence not recorded`);
    if (w.usage === 'reviewer-only' && exists(path.join(P.source, w.id + '.txt'))) E.push(`witness ${w.id} is reviewer-only but has text in source/`);
  }
  if (/^TODO/i.test(text.publish.license)) W.push('publish.license is still TODO: choose a licence for our translation before publishing');

  // 3. ids
  const idx = unitsIndex(slug);
  const seen = new Set();
  for (const id of idx.ids) {
    if (!ID_RE.test(id)) E.push(`id ${id} does not match the id grammar`);
    if (seen.has(id)) E.push(`duplicate id ${id}`);
    seen.add(id);
  }
  for (const id of idx.tombstones) if (seen.has(id)) E.push(`tombstoned id ${id} is live again`);

  const privateSet = privateShingles();
  const overlap = (where, s) => {
    if (!privateSet.size) return;
    for (const sh of shingles(words(s))) if (privateSet.has(sh)) { E.push(`${where}: 8-word overlap with a private reference ("${sh}")`); return; }
  };

  for (const u of idx.units) {
    const unit = loadUnit(slug, u.id);
    for (const w of unit.witnesses) if (!witnessOf(text, w)) E.push(`${u.id}: unknown witness ${w}`);
    const draft = readJSON(P.draft(u.id), null);
    const weave = readJSON(P.weave(u.id), null);
    const approved = readJSON(P.approvedFile(u.id), null);
    const segIds = new Set(unit.commentary.map(s => s.id));
    const srcLine = new Map(unit.lines.map(l => [l.id, l]));
    const verseIds = new Set(unit.lines.filter(l => l.role === 'line').map(l => l.id));

    // 4-8 on the draft and commentary
    if (draft) {
      const r = Draft.extend({ provenance: RunProvenance }).safeParse(draft);
      if (!r.success) E.push(`${u.id} draft: ${r.error.issues[0].path.join('.')} ${r.error.issues[0].message}`);
      else {
        const want = unit.lines.filter(l => l.role !== 'lacuna').map(l => l.id).join();
        if (draft.lines.map(l => l.id).join() !== want) E.push(`${u.id} draft: line ids no longer match the unit`);
        if (draft.provenance.sourceSha !== unit.sourceSha) W.push(`${u.id} draft is stale: the source changed after drafting`);
        const omitted = new Set(draft.termsOmitted.map(t => t.line + ' ' + t.id));
        for (const l of draft.lines) {
          const src = srcLine.get(l.id);
          const marked = new Set(markup.terms(l.en).map(t => t.id));
          for (const h of src ? matchSource(inScope, src.src, src.lang) : []) {
            if (!marked.has(h.id) && !omitted.has(l.id + ' ' + h.id)) W.push(`${l.id}: glossary term ${h.id} (${h.form}) is neither marked nor listed in termsOmitted`);
          }
          if (src?.translit && l.translit && fold(src.translit) !== fold(l.translit)) {
            W.push(`${l.id}: drafter's transliteration differs from the machine one beyond b/v, y/j, ṛ/ḍ ("${l.translit}" vs "${src.translit}")`);
          }
        }
        for (const n of draft.notes) {
          if (author && n.text.includes(author) && !n.cites.length) E.push(`${u.id} note on ${n.anchor}: mentions ${author} but cites no segment`);
          for (const c of n.cites) if (!segIds.has(c)) E.push(`${u.id} note on ${n.anchor}: cites unknown segment ${c}`);
        }
      }
    }
    if (weave) {
      const r = Weave.extend({ provenance: RunProvenance }).safeParse(weave);
      if (!r.success) E.push(`${u.id} commentary: ${r.error.issues[0].path.join('.')} ${r.error.issues[0].message}`);
      else {
        if (weave.segments.map(s => s.id).join() !== unit.commentary.map(s => s.id).join()) E.push(`${u.id} commentary: segment ids no longer match the unit`);
        if (weave.provenance.sourceSha !== unit.sourceSha) W.push(`${u.id} commentary is stale: the source changed after weaving`);
      }
    }

    // the text that will be (or is) published
    const isApproved = !!approved;
    const texts = [];
    if (approved) {
      const r = Approved.safeParse(approved);
      if (!r.success) E.push(`${u.id} approved: ${r.error.issues[0].path.join('.')} ${r.error.issues[0].message}`);
      if (approved.sourceSha !== unit.sourceSha) E.push(`${u.id} approved text is stale: the source changed after approval; redraft and review`);
      if (!approved.provenance?.review?.by || !approved.provenance?.draft?.model) E.push(`${u.id} approved: provenance incomplete`);
      approved.lines.forEach(l => texts.push({ where: l.id, s: l.en, line: l.id }));
      approved.notes.forEach(n => texts.push({ where: `${u.id} note on ${n.anchor}`, s: n.text }));
      approved.commentary.forEach(c => { texts.push({ where: `${c.id} translation`, s: c.translation, full: true }); texts.push({ where: `${c.id} note`, s: c.note }); });
      for (const n of approved.notes) {
        if (author && n.text.includes(author) && !n.cites.length) E.push(`${u.id} approved note on ${n.anchor}: mentions ${author} but cites no segment`);
        for (const c of n.cites) if (!segIds.has(c)) E.push(`${u.id} approved note on ${n.anchor}: cites unknown segment ${c}`);
      }
    } else if (draft) {
      draft.lines.forEach(l => texts.push({ where: l.id, s: l.en, line: l.id }));
      draft.notes.forEach(n => texts.push({ where: `${u.id} note on ${n.anchor}`, s: n.text }));
      (weave?.segments || []).forEach(c => { texts.push({ where: `${c.id} translation`, s: c.translation, full: true }); texts.push({ where: `${c.id} note`, s: c.note }); });
    }
    for (const t of texts) {
      for (const p of markup.problems(t.s)) E.push(`${t.where}: ${p}`);
      for (const term of markup.terms(t.s)) {
        const e = entries.get(term.id);
        if (!e) { E.push(`${t.where}: unknown term {${term.id}}`); continue; }
        if (e.status === 'rejected') E.push(`${t.where}: uses rejected term {${term.id}}`);
        if (isApproved && e.status !== 'approved') E.push(`${t.where}: approved text uses unapproved term {${term.id}}`);
        const ok = [e.en, ...e.variants].map(x => x.toLowerCase());
        if (t.line && !ok.includes(term.surface.toLowerCase())) {
          (isApproved ? E : W).push(`${t.where}: "${term.surface}" for {${term.id}}; the glossary rendering is "${e.en}"${e.variants.length ? ' (or ' + e.variants.join(', ') + ')' : ''}`);
        }
      }
      if (t.line && verseIds.has(t.line)) {
        const plain = markup.strip(t.s).toLowerCase();
        // A term's forbidden words bind only where that image is in the line: in its
        // source or marked in the English. "Body" is fine in "the body is a tree".
        const srcLine = unit.lines.find(l => l.id === t.line);
        const present = new Set([...markup.terms(t.s).map(x => x.id), ...(srcLine ? matchSource(inScope, srcLine.src, srcLine.lang).map(h => h.id) : [])]);
        for (const e of inScope) {
          if (!present.has(e.id)) continue;
          for (const f of e.forbiddenInLine) {
            if (new RegExp(`(^|[^\\p{L}])${f.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\p{L}]|$)`, 'u').test(plain)) {
              E.push(`${t.where}: "${f}" inside a verse line (${e.id} says: translate the image, put the reading in a note)`);
            }
          }
        }
      }
      // Notes quote briefly; a full translation of the commentary carries the verses it quotes.
      if (!t.line && !t.full) for (const q of quotesOver(t.s)) E.push(`${t.where}: quotation over 25 words ("${q.slice(0, 40)}…")`);
      overlap(t.where, t.s);
    }

    // 13. the sung version: its own file, its own approval, the same rules for every line it sings
    const sung = readJSON(P.sung(u.id), null);
    const approvedSung = readJSON(P.approvedSung(u.id), null);
    const sungIds = unit.lines.filter(l => l.role === 'line').map(l => l.id).join();
    if (sung) {
      const r = SungFiled.safeParse(sung);
      if (!r.success) E.push(`${u.id} sung: ${r.error.issues[0].path.join('.')} ${r.error.issues[0].message}`);
      else {
        if (sung.lines.map(l => l.id).join() !== sungIds) E.push(`${u.id} sung: line ids no longer match the unit`);
        if (sung.provenance.sourceSha !== unit.sourceSha) W.push(`${u.id} sung version is stale: the source changed after it was sung`);
        else if (draft && sung.provenance.draftSha !== short(fileSha(P.draft(u.id)))) W.push(`${u.id} sung version was made from an earlier draft; check it still says what the translation says, or sing it again`);
      }
    }
    if (approvedSung) {
      const r = ApprovedSung.safeParse(approvedSung);
      if (!r.success) E.push(`${u.id} approved sung: ${r.error.issues[0].path.join('.')} ${r.error.issues[0].message}`);
      if (approvedSung.sourceSha !== unit.sourceSha) E.push(`${u.id} approved sung version is stale: the source changed after approval`);
    }
    const sungText = approvedSung || sung;
    for (const l of sungText?.lines || []) {
      const where = `${l.id} (sung)`;
      for (const p of markup.problems(l.en)) E.push(`${where}: ${p}`);
      for (const term of markup.terms(l.en)) {
        const e = entries.get(term.id);
        if (!e) E.push(`${where}: unknown term {${term.id}}`);
        else if (e.status === 'rejected') E.push(`${where}: uses rejected term {${term.id}}`);
        else if (approvedSung && e.status !== 'approved') E.push(`${where}: approved sung text uses unapproved term {${term.id}}`);
      }
      for (const f of forbiddenHere(inScope, unit, l)) E.push(`${where}: "${f.word}" inside a sung line (${f.id} says: translate the image, put the reading in a note)`);
      overlap(where, l.en);
    }
    for (const c of sungText?.couplets || []) { overlap(`${c.group} kept (sung)`, c.kept); overlap(`${c.group} let go (sung)`, c.letGo); }
    // Advice only while the sung version is a draft: once approved, the reviewer has weighed it.
    if (sung && !approvedSung && (approved || draft)) {
      for (const a of songAdvice(sung.lines, (approved || draft).lines, markup.strip)) W.push(`${u.id} sung: ${a}`);
      if (draft) for (const a of temperatureAdvice(unit, draft, sung.lines, 'the sung version')) W.push(`${u.id} sung: ${a}`);
    }

    // 12. determinism: the same inputs must give the same pack
    for (const task of Object.keys(TASKS)) {
      if (!exists(P.pack(task, u.id) + '.json')) continue;
      try {
        if (buildPack(slug, u.id, task).sha !== buildPack(slug, u.id, task).sha) W.push(`${u.id}: the ${task} pack is not deterministic`);
      } catch { /* a pack that can no longer be built is reported by the draft checks */ }
    }
  }

  // glossary definitions must be our own
  for (const e of inScope) overlap(`glossary ${e.id} definition`, e.definition);

  // 11. rendered output
  const out = path.join(siteRoot(), text.publish.dir);
  for (const f of listFiles(out, /\.html$/)) {
    const html = readText(path.join(out, f));
    const content = html.replace(/<(style|script)[^>]*>[\s\S]*?<\/\1>/g, '');
    if (/\]\{[a-z0-9-]+\}/.test(content)) E.push(`${text.publish.dir}/${f}: unrendered glossary markup`);
    if (html !== nfc(html)) E.push(`${text.publish.dir}/${f}: text is not NFC-normalized`);
    const data = /<script type="application\/json" id="gloss-data">([\s\S]*?)<\/script>/.exec(html);
    const inline = data ? JSON.parse(data[1]) : {};
    for (const m of html.matchAll(/data-g="([^"]+)"/g)) if (!inline[m[1]]) E.push(`${text.publish.dir}/${f}: link to {${m[1]}} has no inlined entry`);
    for (const m of html.matchAll(/<[^>]+class="src"[^>]*>/g)) if (!/\slang="/.test(m[0])) E.push(`${text.publish.dir}/${f}: source-script element without a lang attribute`);
    for (const m of html.matchAll(/<[^>]+class="tl"[^>]*>/g)) if (!/\slang="[a-z-]+-Latn"/.test(m[0])) E.push(`${text.publish.dir}/${f}: transliteration without a -Latn lang attribute`);
    if (!/<link rel="stylesheet" href="[^"]*reader\.css\?v=/.test(html)) E.push(`${text.publish.dir}/${f}: does not link the shared reader.css`);
  }
  const search = readJSON(path.join(out, 'search.json'), null);
  if (search) {
    const bad = search.docs.filter(d => d.some(x => /\]\{[a-z0-9-]+\}|<\/?[a-z][^>]*>/.test(String(x))));
    if (bad.length) E.push(`${text.publish.dir}/search.json: ${bad.length} entr${bad.length === 1 ? 'y has' : 'ies have'} markup (first: ${bad[0][2]})`);
  }

  return strict ? { errors: [...E, ...W], warnings: [] } : { errors: E, warnings: W };
}
