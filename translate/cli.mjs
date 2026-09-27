#!/usr/bin/env node
/**
 * Illuminated translation engine.
 *
 *   node translate/cli.mjs <command> <text> [units] [flags]
 *
 * units: all (default) | cp.01..cp.03 | cp.01,cp.10 | 1,10,14
 * See translate/README.md for the full loop.
 */

import fs from 'node:fs';
import { parseArgs } from 'node:util';
import { UserError, rel } from './lib/io.mjs';

const HELP = `Illuminated translation engine

  new <text> --lang oben --rule caryagiti|lines [--title "…"] [--prefix cp]
  import <text> --witness <id> <file|->           keep a paste/file byte-for-byte, append to the working copy
  import <text> --witness <id> --fetch <n|all>    fetch unit n from the witness's "fetch" page (Wikisource), or a whole Tengyur text
  segment <text> [--retire]                       working copy -> units/*.json with stable ids
  status <text>                                   where every unit stands

  terms <text> [units]                            glossary proposals pack (then ingest --task terms)
  terms-bo <text> [units]                         Tibetan equivalents pack (then ingest --task terms-bo)
  pack <text> [units] --task draft|redraft|weave|terms|terms-bo|sing
  draft <text> [units]                            write draft packs; say what to do next
  weave <text> [units]                            write commentary packs
  sing <text> [units]                             write packs for the sung version (the song sounded in English)
  sound <text> [units]                            how the source sounds: rhymes, refrain, self-naming, rāga
  ingest <text> [units] --task draft|redraft|weave|terms|terms-bo|sing [--model "…"]
  check <text> [--strict]                         every validator; exit 1 on errors

  review <text> [units] [--force]                 write review/<unit>.md sheets
  review <text> --glossary [--force]              write glossary/review/<text>.md for proposed terms
  review <text> [units] --sung [--force]          write review/<unit>.sung.md for the sung version
  accept <text> [units] [--dry]                   read sheets -> approved/, glossary, feedback
  accept <text> [units] --sung [--dry]            read sung sheets -> approved/<unit>.sung.json
  accept <text> --glossary [--dry]
  render <text> [--preview]                       translations/<text>/… and sitemap-translations.xml
  glossary <text> [show|lint]                     inspect the glossary in scope

  studio build [--target staging|prod]            build the Studio page into translate/.studio/studio.html
  studio export <text> [units] [--all]            write Studio docs + ArtifactData batches (only what changed)
  studio seeded <text>                            record that every batch was written
  studio import <text> [units] [--dry] [--force]  apply decisions pulled into translate/.studio/<target>/inbox
`;

const { values: o, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    lang: { type: 'string' }, rule: { type: 'string' }, title: { type: 'string' }, prefix: { type: 'string' },
    label: { type: 'string' }, witness: { type: 'string' }, fetch: { type: 'string' }, task: { type: 'string' },
    model: { type: 'string' }, api: { type: 'boolean' }, batch: { type: 'boolean' }, force: { type: 'boolean' },
    dry: { type: 'boolean' }, preview: { type: 'boolean' }, strict: { type: 'boolean' }, glossary: { type: 'boolean' },
    retire: { type: 'boolean' }, all: { type: 'boolean' }, target: { type: 'string' }, sung: { type: 'boolean' }, help: { type: 'boolean', short: 'h' },
  },
});

const [cmd, slug, ...rest] = positionals;
const sel = rest[0];
const log = s => console.log(s);

async function unitsFor(slug, sel) {
  const { selectUnits } = await import('./lib/ids.mjs');
  const { unitIds } = await import('./lib/text.mjs');
  const ids = selectUnits(unitIds(slug), sel);
  if (!ids.length) throw new UserError('no units selected (run segment first?)');
  return ids;
}

function noApiYet() {
  if (o.api || o.batch) {
    throw new UserError('API and batch drafting arrive in milestone 2. For now drafting runs in the Claude Code session: '
      + 'follow the pack instructions this command prints.');
  }
}

const commands = {
  help() { log(HELP); },

  async new() {
    const { newText } = await import('./lib/project.mjs');
    for (const f of newText(slug, o)) log(`  wrote ${f}`);
  },

  async import() {
    const { importSource } = await import('./lib/project.mjs');
    let content, label = o.label || '';
    if (o.fetch) {
      const { loadText } = await import('./lib/text.mjs');
      const w = loadText(slug).witnesses.find(x => x.id === o.witness);
      if (!w) throw new UserError(`unknown witness ${o.witness}`);
      if (/#D\d+$/.test(w.fetch)) {
        // A whole Tengyur text in one import (--fetch all).
        const { fetchTengyur } = await import('./lib/import/tengyur.mjs');
        ({ text: content, label } = await fetchTengyur(w.fetch));
      } else {
        const { fetchWikisource } = await import('./lib/import/wikisource.mjs');
        ({ text: content, label } = await fetchWikisource(w.fetch, Number(o.fetch)));
      }
    } else {
      const file = rest[0];
      if (!file) throw new UserError('give a file to import, or - to read the paste from stdin');
      content = file === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(file, 'utf8');
      label ||= file === '-' ? 'pasted' : file;
    }
    const r = importSource(slug, { witness: o.witness, content, label });
    log(`  kept source/raw/${r.file}\n  appended to ${rel(r.marked)}: add @song/@comm directives there, then run segment`);
  },

  async segment() {
    const { segment } = await import('./lib/project.mjs');
    const r = segment(slug, { retire: o.retire });
    log(`  ${r.units.length} unit(s): ${r.units.map(u => `${u.id} (${u.lines.filter(l => l.role !== 'lacuna').length} lines, ${u.commentary.length} comm)`).join(', ')}`);
    if (r.changed.length) log(`  changed: ${r.changed.join(', ')}`);
    if (r.parallelChanged.length) log(`  parallel text changed (drafts stay current): ${r.parallelChanged.join(', ')}`);
    for (const w of r.warnings) log(`  note: ${w}`);
    if (r.vanished.length) log(`  retired: ${r.vanished.join(', ')}`);
  },

  async status() {
    const { status } = await import('./lib/project.mjs');
    const rows = status(slug);
    if (!rows.length) return log('  no units yet');
    log('  unit    lines comm  draft weave sheet approved  stage');
    for (const r of rows) {
      const y = b => (b ? '  ✓  ' : '  ·  ');
      log(`  ${r.id.padEnd(7)} ${String(r.lines).padStart(4)} ${String(r.segments).padStart(4)} ${y(r.draft)} ${y(r.weave)} ${y(r.sheet)} ${y(r.approved)}    ${r.stage}${r.stale.length ? '  (stale: ' + r.stale.join(', ') + ')' : ''}`);
    }
  },

  async pack() {
    const { writePacks } = await import('./lib/pack.mjs');
    const task = o.task || 'draft';
    for (const p of writePacks(slug, await unitsFor(slug, sel), task)) log(`  ${rel(p.md)}  (sha ${p.sha.slice(0, 12)})`);
  },

  async terms() { return commands.stage('terms'); },
  async 'terms-bo'() { return commands.stage('terms-bo'); },
  async draft() { return commands.stage('draft'); },
  async weave() { return commands.stage('weave'); },
  async sing() { return commands.stage('sing'); },

  async sound() {
    const { soundProfile, profileText } = await import('./lib/sound.mjs');
    const { loadUnit } = await import('./lib/text.mjs');
    for (const id of await unitsFor(slug, sel)) log(`  ${id}\n` + profileText(soundProfile(loadUnit(slug, id))).split('\n').map(l => '    ' + l).join('\n'));
  },

  async stage(task) {
    noApiYet();
    const { writePacks, sessionInstructions } = await import('./lib/pack.mjs');
    const packs = writePacks(slug, await unitsFor(slug, sel), task);
    log(sessionInstructions(slug, packs));
  },

  async ingest() {
    const { ingest } = await import('./lib/ingest.mjs');
    const res = ingest(slug, await unitsFor(slug, sel), { task: o.task || 'draft', model: o.model });
    for (const r of res) {
      log(`  ${r.unit}: ${r.ok ? 'ok -> ' + rel(r.wrote) : 'skipped (' + r.reason + ')'}`);
      for (const a of r.advice || []) log(`    ~ ${a}`);
    }
    const added = res.flatMap(r => r.proposals || []);
    if (added.length) log(`  glossary: proposed ${[...new Set(added)].join(', ')}`);
    const bo = res.flatMap(r => r.tibetan || []);
    if (bo.length) log(`  glossary: Tibetan forms ${bo.join('; ')}`);
  },

  async check() {
    const { check } = await import('./lib/check.mjs');
    const { errors, warnings } = check(slug, { strict: o.strict });
    for (const w of warnings) log(`  ! ${w}`);
    for (const e of errors) log(`  ✗ ${e}`);
    log(`  ${errors.length} error(s), ${warnings.length} warning(s)`);
    if (errors.length) process.exitCode = 1;
  },

  async review() {
    const review = await import('./lib/review/write.mjs');
    if (o.glossary) return log(`  wrote ${rel(review.writeGlossarySheet(slug, { force: o.force }))}`);
    if (o.sung) {
      const { writeSungSheet } = await import('./lib/review/sung.mjs');
      const { exists, paths } = await import('./lib/io.mjs');
      for (const id of await unitsFor(slug, sel)) {
        if (!exists(paths(slug).sung(id))) { if (sel) log(`  ${id}: no sung version yet`); continue; }
        const r = writeSungSheet(slug, id, { force: o.force });
        log(`  ${id}: ${r.skipped ? 'skipped (' + r.skipped + ')' : 'wrote ' + rel(r.path)}`);
      }
      return;
    }
    for (const id of await unitsFor(slug, sel)) {
      const r = review.writeSheet(slug, id, { force: o.force });
      log(`  ${id}: ${r.skipped ? 'skipped (' + r.skipped + ')' : 'wrote ' + rel(r.path)}`);
    }
  },

  async accept() {
    const accept = await import('./lib/accept.mjs');
    if (o.glossary) return log(accept.report(accept.acceptGlossarySheet(slug, { dry: o.dry })));
    const ids = await unitsFor(slug, sel);
    const { existsSync } = fs;
    const { paths } = await import('./lib/io.mjs');
    if (o.sung) {
      const { acceptSungSheet } = await import('./lib/review/sung.mjs');
      for (const id of ids) {
        if (!existsSync(paths(slug).sungSheet(id))) { if (sel) log(`  ${id}: no sung review sheet`); continue; }
        log(accept.report(acceptSungSheet(slug, id, { dry: o.dry })));
      }
      return;
    }
    for (const id of ids) {
      if (!existsSync(paths(slug).sheet(id))) { if (sel) log(`  ${id}: no review sheet`); continue; }
      log(accept.report(accept.acceptSheet(slug, id, { dry: o.dry })));
    }
  },

  async render() {
    const { render } = await import('./lib/render/index.mjs');
    const r = render(slug, { preview: o.preview });
    for (const f of r.files) log(`  wrote ${rel(f)}`);
    if (r.note) log(`  ${r.note}`);
  },

  async studio() {
    const sub = slug;
    const text = rest[0], unitSel = rest[1];
    const outbox = await import('./lib/studio/outbox.mjs');
    if (sub === 'build') {
      const { buildStudio } = await import('./lib/studio/build.mjs');
      const r = buildStudio({ target: o.target || 'staging' });
      return log(`  wrote ${rel(r.path)} (${Math.round(r.bytes / 1024)} KB, sha ${r.sha.slice(0, 12)})`);
    }
    if (!text) throw new UserError(`which text? e.g. studio ${sub || 'export'} charyapada`);
    const target = outbox.targetFor(text, o.target);
    if (sub === 'export') {
      const { textDocs } = await import('./lib/studio/docs.mjs');
      let docs = textDocs(text);
      if (unitSel) {
        const ids = new Set(await unitsFor(text, unitSel));
        docs = docs.filter(d => d.collection !== 'units' || ids.has(d.id));
      }
      const r = outbox.writeOutbox(target, docs, { all: o.all });
      log(`  ${target}: ${r.count} doc(s) to write, ${r.unchanged} unchanged`);
      for (const b of r.batches) log(`    ${b}`);
      if (r.count) log(`  write each batch with ArtifactData (action "batch", writes = the file's "writes"), then: node translate/cli.mjs studio seeded ${text}`);
      return;
    }
    if (sub === 'seeded') return log(`  ${target}: recorded ${outbox.markSeeded(target)} doc(s) as written`);
    if (sub === 'import') {
      const { importStudio, importReport } = await import('./lib/studio/import.mjs');
      const units = unitSel ? await unitsFor(text, unitSel) : null;
      const r = importStudio(text, { target, dry: o.dry, force: o.force, units });
      log(importReport(r));
      if (r.outbox?.count) for (const b of r.outbox.batches) log(`    ${b}`);
      return;
    }
    throw new UserError('studio build | export | seeded | import');
  },

  async glossary() {
    const g = await import('./lib/glossary.mjs');
    const { loadText } = await import('./lib/text.mjs');
    loadText(slug);
    const action = rest[0] || 'show';
    const entries = g.scoped(g.load(), slug, { includeRejected: true });
    if (action === 'lint') {
      const probs = g.lint(g.load());
      probs.forEach(p => log(`  ✗ ${p}`));
      log(`  ${probs.length} problem(s)`);
      if (probs.length) process.exitCode = 1;
      return;
    }
    for (const e of entries) log('  ' + g.compact(e));
    log(`  ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}`);
  },
};

if (!cmd || o.help || cmd === 'help') commands.help();
else if (!commands[cmd] || cmd === 'stage') { console.error(`unknown command "${cmd}"\n`); commands.help(); process.exitCode = 1; }
else {
  try { await commands[cmd](); }
  catch (e) {
    if (e instanceof UserError) { console.error('✗ ' + e.message); process.exitCode = 1; }
    else throw e;
  }
}
