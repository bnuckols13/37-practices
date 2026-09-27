// End to end on the fixture: import -> segment -> pack -> ingest -> review -> accept -> render -> check.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { scratch, importAndMark, ingestAnswer, answer, decideAll, read } from './helpers.mjs';

const dir = scratch();
const T = p => path.join(dir, 'texts', 'fixture', p);
const { segment, status } = await import('../lib/project.mjs');
const { buildPack, writePacks } = await import('../lib/pack.mjs');
const { writeSheet, writeGlossarySheet } = await import('../lib/review/write.mjs');
const { acceptSheet, acceptGlossarySheet } = await import('../lib/accept.mjs');
const { parseSheet } = await import('../lib/review/parse.mjs');
const { render } = await import('../lib/render/index.mjs');
const { check } = await import('../lib/check.mjs');
const { importSource } = await import('../lib/project.mjs');
const glossary = await import('../lib/glossary.mjs');

test('source: copyrighted witnesses are refused; integrity catches silent edits', async () => {
  assert.throws(() => importSource('fixture', { witness: 'modern', content: 'x' }), /reviewer-only/);
  const marked = await importAndMark(dir);
  const good = read(marked);
  fs.writeFileSync(marked, good.replace('পঞ্চ বি ডাল', 'পঞ্চ ডাল'));
  assert.throws(() => segment('fixture'), /differs from its raw import/);
  fs.writeFileSync(marked, good);
  const r = segment('fixture');
  assert.deepEqual(r.units.map(u => u.id), ['fx.01', 'fx.02']);
});

test('segment refuses to let ids vanish without --retire', () => {
  const marked = T('source/ed.txt');
  const good = read(marked);
  fs.writeFileSync(marked, good.replace('@song 2', '@-- dropped\n@skip'));
  assert.throws(() => segment('fixture'), /would disappear/);
  fs.writeFileSync(marked, good);
  segment('fixture');
});

test('packs are deterministic and refuse non-prompt witnesses', () => {
  assert.equal(buildPack('fixture', 'fx.01', 'draft').sha, buildPack('fixture', 'fx.01', 'draft').sha);
  const tj = T('text.json');
  const orig = read(tj);
  fs.writeFileSync(tj, orig.replace('"usage": "prompt+publish"', '"usage": "publish-only"'));
  assert.throws(() => buildPack('fixture', 'fx.01', 'draft'), /may not go into a drafting pack/);
  fs.writeFileSync(tj, orig);
  const [p] = writePacks('fixture', ['fx.01'], 'draft');
  assert.match(read(p.md), /# OUTPUT SCHEMA/);
  assert.ok(!read(p.md).includes('A copyrighted modern translation'), 'reviewer-only witness never appears in a pack');
});

test('ingest rejects answers with the wrong lines or unknown terms', async () => {
  const bad = answer('draft-fx.01.json');
  bad.lines = bad.lines.slice(1);
  await assert.rejects(ingestAnswer(dir, 'draft', 'fx.01', bad), /line ids must be exactly/);
  const bad2 = answer('draft-fx.01.json');
  bad2.lines[1].en = 'The body is a [tree]{no-such-term}';
  await assert.rejects(ingestAnswer(dir, 'draft', 'fx.01', bad2), /unknown term id \{no-such-term\}/);
});

test('draft and weave ingest with provenance; proposals join the glossary', async () => {
  const [r] = await ingestAnswer(dir, 'draft', 'fx.01', answer('draft-fx.01.json'));
  assert.ok(r.ok);
  const d = JSON.parse(read(T('drafts/fx.01.json')));
  assert.equal(d.provenance.mode, 'session');
  assert.equal(d.provenance.sourceSha, JSON.parse(read(T('units/fx.01.json'))).sourceSha);
  assert.deepEqual(glossary.load().entries.map(e => [e.id, e.status]), [['mahasukha', 'proposed'], ['p-luyi', 'proposed'], ['taruvara', 'proposed']]);
  writePacks('fixture', ['fx.01'], 'weave');
  await ingestAnswer(dir, 'weave', 'fx.01', answer('weave-fx.01.json'));
  assert.equal(status('fixture')[0].stage, 'ready for review');
});

test('the Tibetan: aligned by id, in the packs, matched to glossary terms, counted in the concordance', async () => {
  const u = JSON.parse(read(T('units/fx.01.json')));
  assert.deepEqual(Object.keys(u.parallels.tib.lines), ['fx.01.h1', 'fx.01.1a', 'fx.01.1b', 'fx.01.2a', 'fx.01.2b']);
  assert.deepEqual(Object.keys(u.parallels.tib.commentary), ['fx.01.m1']);
  assert.match(u.parallels.tib.lines['fx.01.1a'].translit, /^\/lus ljon shing mchog/);
  assert.match(read(writePacks('fixture', ['fx.01'], 'draft')[0].md), /"parallel": \{\s*"tib": \{\s*"lang": "bod"/);
  const [p] = writePacks('fixture', ['fx.01'], 'terms-bo');
  assert.match(read(p.md), /- fx\.01\.1a: taruvara \(তরুবর\)\n {4}tib: །ལུས་ལྗོན་ཤིང་/);
  const eq = { id: 'taruvara', line: 'fx.01.1a', script: 'ལྗོན་ཤིང', wylie: 'ljon shing', lemma: '', confidence: 'clear', note: '' };
  await assert.rejects(ingestAnswer(dir, 'terms-bo', 'fx.01', { unit: 'fx.01', equivalents: [{ ...eq, script: 'ནགས་ཚལ' }], questions: [] }), /is not in the Tibetan of fx\.01\.1a/);
  const likely = { id: 'mahasukha', line: 'fx.01.2a', script: 'བདེ་ཆེན', wylie: 'bde chen', lemma: 'bde ba chen po', confidence: 'likely', note: '' };
  const [r] = await ingestAnswer(dir, 'terms-bo', 'fx.01', { unit: 'fx.01', equivalents: [eq, likely], questions: [] });
  assert.deepEqual(r.tibetan, ['taruvara: ljon shing', 'mahasukha: bde chen']);
  const m = glossary.load().entries.find(x => x.id === 'mahasukha');
  assert.equal(m.match.bod, undefined, 'a likely equivalent is recorded but not matched everywhere');
  const e = glossary.load().entries.find(x => x.id === 'taruvara');
  assert.deepEqual(e.forms.at(-1), { lang: 'bod', script: 'ལྗོན་ཤིང', translit: 'ljon shing', lemma: '', att: 'AO', where: 'fx.01.1a' });
  assert.deepEqual(e.match.bod, ['ལྗོན་ཤིང']);
  const { concordance } = await import('../lib/concord.mjs');
  const c = concordance('fixture').get('taruvara');
  assert.deepEqual(c.tibetan, { aligned: 1, forms: [{ script: 'ལྗོན་ཤིང', wylie: 'ljon shing', n: 1 }] });
  assert.equal(c.hits[0].bo.at.hit, 'ལྗོན་ཤིང');
  assert.deepEqual(concordance('fixture').get('mahasukha').tibetan.forms.map(f => f.wylie), ['bde ba chen po'], 'counted where it was read');
  const { unitDoc } = await import('../lib/studio/docs.mjs');
  const doc = unitDoc('fixture', 'fx.01');
  assert.deepEqual(doc.parallels, [{ id: 'tib', lang: 'bod', name: 'Tibetan', label: 'Tibetan translation, test' }]);
  const line = doc.sections.find(x => x.part === '1').lines[0];
  assert.equal(line.par[0].html, 'bo');
  assert.equal(doc.sections.find(x => x.part === 'm1').par[0].witness, 'tib');
});

test('review sheet round-trips: all-ok acceptance reproduces the draft', () => {
  writeSheet('fixture', 'fx.01');
  const sheet = T('review/fx.01.md');
  decideAll(sheet, 'ok', 'approve');
  const r = acceptSheet('fixture', 'fx.01', { dry: true });
  assert.ok(r.approved, JSON.stringify(r.problems));
  assert.deepEqual(r.edited, []);
  assert.equal(glossary.load().entries.find(e => e.id === 'taruvara').status, 'proposed', 'dry run changes nothing');
  const parsed = parseSheet(read(sheet));
  const d = JSON.parse(read(T('drafts/fx.01.json')));
  assert.equal(parsed.sections.find(s => s.key === 'fx.01.1').labels['EN 1a'], d.lines[1].en);
});

test('review guards hand edits; accept rejects a stale sheet', () => {
  assert.ok(writeSheet('fixture', 'fx.01').skipped, 'a hand-edited sheet is not overwritten');
  const dpath = T('drafts/fx.01.json');
  const orig = read(dpath);
  fs.writeFileSync(dpath, orig.replace('"The Tree of the Body"', '"The Body Tree"'));
  assert.throws(() => acceptSheet('fixture', 'fx.01'), /stale/);
  fs.writeFileSync(dpath, orig);
});

test('pending and redraft decisions block approval and feed the redraft', () => {
  const sheet = T('review/fx.01.md');
  const approvedSheet = read(sheet);
  fs.writeFileSync(sheet, approvedSheet.replace(/(## 1\.2 · fx\.01\.2[\s\S]*?)\*\*Decision:\*\* ok\n\*\*Note to next draft:\*\*/,
    '$1**Decision:** redraft\n**Note to next draft:** keep the imperative mood'));
  const r = acceptSheet('fixture', 'fx.01');
  assert.ok(!r.approved);
  assert.deepEqual(r.redraft, ['fx.01.2']);
  const fb = JSON.parse(read(T('feedback.json')));
  assert.equal(fb['fx.01'].notes['fx.01.2'], 'keep the imperative mood');
  assert.equal(writePacks('fixture', ['fx.01'], 'draft')[0].task, 'redraft', 'draft becomes redraft when the reviewer asked for one');
  fs.writeFileSync(sheet, approvedSheet);
});

test('an edited, fully approved sheet writes the approved record', () => {
  const sheet = T('review/fx.01.md');
  fs.writeFileSync(sheet, read(sheet).replace('into the restless mind, time has entered.', 'time has entered the restless mind.'));
  const r = acceptSheet('fixture', 'fx.01');
  assert.ok(r.approved, JSON.stringify(r.problems));
  const a = JSON.parse(read(T('approved/fx.01.json')));
  assert.equal(a.provenance.review.decisions['fx.01.1'], 'edited');
  assert.equal(a.provenance.review.decisions['fx.01.2'], 'ok');
  assert.equal(a.lines.find(l => l.id === 'fx.01.1b').en, 'time has entered the restless mind.');
  assert.ok(glossary.load().entries.every(e => e.status === 'approved'));
  assert.ok(!JSON.parse(read(T('feedback.json')))['fx.01'], 'feedback cleared on approval');
});

test('render publishes only approved units, with popover data and a sitemap', () => {
  fs.mkdirSync(process.env.SITE_ROOT, { recursive: true });
  fs.writeFileSync(path.join(process.env.SITE_ROOT, 'robots.txt'), 'User-agent: *\nAllow: /\n');
  const r = render('fixture');
  const out = path.join(process.env.SITE_ROOT, 'translations', 'fixture');
  assert.deepEqual(fs.readdirSync(out).sort(), ['01.html', 'about.html', 'glossary.html', 'index.html', 'search.json']);
  const html = read(path.join(out, '01.html'));
  assert.match(html, /data-g="taruvara"/);
  assert.match(html, /<script type="application\/json" id="gloss-data">/);
  assert.match(html, /reviewed line by line by /);
  assert.ok(!/\]\{taruvara\}/.test(html), 'markup is rendered');
  // Reading Room structure: rubricated passage numbers, Munidatta beside his couplet, shared assets.
  assert.match(html, /<section class="passage" id="c1" data-unit="fx\.01\.1"><div class="passage__no"><a class="pno" href="#c1"/);
  assert.match(html, /<aside class="sidenote" aria-label="Munidatta on 1\.1">/);
  assert.match(html, /<link rel="stylesheet" href="\.\.\/assets\/reader\.css\?v=[0-9a-f]{12}">/);
  assert.match(html, /<meta name="citation" content="[^"]*\{p\}/);
  for (const a of ['reader.css', 'reader.js', 'fonts/IlluminatedText-Regular.woff2', 'fonts/TiroBangla-Bengali.woff2', 'fonts/OFL.txt']) {
    assert.ok(fs.existsSync(path.join(process.env.SITE_ROOT, 'translations', 'assets', a)), a);
  }
  assert.doesNotMatch(html, /fonts\.googleapis|fonts\.gstatic/, 'type is self-hosted');
  assert.match(html, /<div class="par"><p class="par__label">Tibetan<\/p><p class="par__src" lang="bo">།ལུས་ལྗོན་ཤིང་/, 'the study view carries the aligned Tibetan');
  assert.ok(fs.existsSync(path.join(process.env.SITE_ROOT, 'translations', 'assets', 'fonts', 'NotoSerifTibetan-Tibetan.woff2')));
  const title = read(path.join(out, 'index.html'));
  assert.match(title, /How to read this edition/);
  assert.match(title, /<ol class="contents">/);
  const search = JSON.parse(read(path.join(out, 'search.json')));
  assert.ok(search.docs.some(d => d[0] === 'p' && d[1] === '1.1'), 'passages are searchable');
  assert.ok(search.docs.some(d => d[0] === 'g' && d[1] === 'taruvara'), 'glossary terms are searchable');
  assert.ok(!/\]\{|<[a-z]/.test(JSON.stringify(search.docs)), 'no markup in the search index');
  assert.doesNotMatch(read(path.join(process.env.SITE_ROOT, 'sitemap-translations.xml')), /search\.json|reader\./);
  assert.match(read(path.join(process.env.SITE_ROOT, 'sitemap-translations.xml')), /translations\/fixture\/01\.html/);
  assert.match(read(path.join(process.env.SITE_ROOT, 'robots.txt')), /sitemap-translations\.xml/);
  assert.ok(r.files.length >= 5);
  const pv = render('fixture', { preview: true });
  assert.ok(pv.files.some(f => f.includes('.preview')));
});

test('check is clean on the approved fixture', () => {
  const { errors, warnings } = check('fixture', { strict: true });
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
});

test('glossary sheet: review and accept decisions for proposed terms', async () => {
  const p = answer('draft-fx.01.json').proposals[0];
  const g = glossary.load();
  glossary.mergeProposal(g, { ...p, id: 'kala', en: 'time', match: [{ lang: 'oben', form: 'কাল' }], symbolicReadings: [], forbiddenInLine: [] }, { slug: 'fixture', by: 'test' });
  glossary.save(g);
  const sheet = writeGlossarySheet('fixture');
  decideAll(sheet, 'reject', 'reject');
  const r = acceptGlossarySheet('fixture');
  assert.deepEqual(r.glossary.rejected, ['kala']);
  assert.equal(glossary.load().entries.find(e => e.id === 'kala').status, 'rejected');
});

test('the reader stylesheet keeps the house rules', async () => {
  const { READER_CSS } = await import('../lib/render/css.mjs');
  const rules = READER_CSS.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(rules, /text-transform/, 'no uppercase labels');
  assert.doesNotMatch(rules, /box-shadow|drop-shadow/, 'no shadows');
  assert.doesNotMatch(rules, /gradient\(/, 'no gradients');
  assert.doesNotMatch(rules, /border-radius:(?!\s*0[;\s}])/, 'no rounded boxes');
  assert.doesNotMatch(rules, /--font-ui|sans-serif|system-ui/, 'one book face, no sans');
  assert.doesNotMatch(rules, /backdrop-filter/, 'no frosted glass');
});
