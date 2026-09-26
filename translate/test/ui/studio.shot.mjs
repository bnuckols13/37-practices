// Opt-in browser pass on the built Studio (needs Playwright's Chromium):
//   node test/ui/studio.shot.mjs <outdir>
// Seeds a fake database from the fixture's real export, drives the review with
// the keyboard, then feeds the page's database back through `studio import`.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(process.argv[2] || '.');
fs.mkdirSync(OUT, { recursive: true });
const { chromium } = await import(path.join(execSync('npm root -g').toString().trim(), 'playwright', 'index.mjs'));

const { scratch, importAndMark, ingestAnswer, answer } = await import('../helpers.mjs');
const dir = scratch();
await importAndMark(dir);
const { segment } = await import('../../lib/project.mjs');
const { writePacks } = await import('../../lib/pack.mjs');
segment('fixture');
writePacks('fixture', ['fx.01'], 'draft');
await ingestAnswer(dir, 'draft', 'fx.01', answer('draft-fx.01.json'));
writePacks('fixture', ['fx.01'], 'weave');
await ingestAnswer(dir, 'weave', 'fx.01', answer('weave-fx.01.json'));
const { textDocs } = await import('../../lib/studio/docs.mjs');
const { buildStudio } = await import('../../lib/studio/build.mjs');
const seed = Object.fromEntries(textDocs('fixture').map(d => [`${d.collection}/${d.id}`, d.data]));
const { html } = buildStudio({ target: 'staging' });

// The Artifact tool's skeleton around the body content.
const page = `<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0}[hidden]{display:none!important}</style></head><body>${html}</body></html>`;
const pagePath = path.join(OUT, 'studio-harness.html');
fs.writeFileSync(pagePath, page);
const fakeDbSrc = fs.readFileSync(path.join(HERE, '../../studio/src/fake-db.mjs'), 'utf8').replace(/^export /gm, '');
const init = `${fakeDbSrc}
window.__fake = createFakeDb(${JSON.stringify(seed)}, { latency: 30 });
window.claude = { use: async name => name === 'db' ? window.__fake.db
  : name === 'user' ? { can: async () => true, canEdit: async () => true, isOwner: async () => true }
  : name === 'sample' ? Object.assign(async (p, o) => { const t = 'The draft keeps the image of the tree literal.'; o?.onText?.({ text: t, delta: t }); return { text: t, truncated: false }; }, {})
  : null };`;

const browser = await chromium.launch();
const results = {};
for (const [name, viewport, scheme] of [['desktop-light', { width: 1360, height: 900 }, 'light'], ['desktop-dark', { width: 1360, height: 900 }, 'dark'], ['phone-light', { width: 390, height: 844 }, 'light']]) {
  const ctx = await browser.newContext({ viewport, colorScheme: scheme });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await p.addInitScript(init);
  await p.goto('file://' + pagePath);
  await p.waitForSelector('.sec', { timeout: 5000 });
  await p.waitForTimeout(400);
  results[name] = { errors, overflow: await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth) };
  await p.screenshot({ path: path.join(OUT, `studio-${name}.png`) });
  if (name === 'desktop-light') {
    // Open the term panel entry and the why box, screenshot, then review with the keyboard.
    await p.click('.term');
    await p.waitForTimeout(150);
    await p.click('.why__open');
    await p.click('.why .btn');
    await p.waitForTimeout(200);
    await p.screenshot({ path: path.join(OUT, 'studio-panel-why.png') });
    // Edit line 1b through the editor.
    await p.click('#s-1 .line[data-line="1b"] .fv__edit');
    await p.fill('.ed__ta', 'time has entered the restless mind.');
    await p.keyboard.press('Escape');
    // Approve every passage in order with Ctrl+Enter.
    await p.click('#s-head .fv.song__title');
    for (let i = 0; i < 6; i++) { await p.keyboard.press('Control+Enter'); await p.waitForTimeout(80); }
    // Approve the proposed terms in the panel.
    for (let i = 0; i < 20; i++) {
      const b = await p.$('.tb .btn--ok[aria-pressed="false"]');
      if (!b) break;
      await b.click(); await p.waitForTimeout(60);
    }
    await p.click('text=Send to Claude');
    await p.waitForTimeout(900);
    await p.screenshot({ path: path.join(OUT, 'studio-sent.png') });
    const dump = await p.evaluate(() => Object.fromEntries([...window.__fake.docs.entries()]));
    results.maxInflight = await p.evaluate(() => window.__fake.maxInflight);
    results.writes = await p.evaluate(() => window.__fake.log.map(w => `${w.op} ${w.path}`));
    const inbox = path.join(dir, '.studio', 'staging', 'inbox');
    for (const [k, v] of Object.entries(dump)) {
      const [coll, id] = k.split('/');
      if (coll !== 'decisions' && coll !== 'glossaryDecisions') continue;
      fs.mkdirSync(path.join(inbox, coll), { recursive: true });
      fs.writeFileSync(path.join(inbox, coll, id + '.json'), JSON.stringify(v));
    }
    const { importStudio } = await import('../../lib/studio/import.mjs');
    const r = importStudio('fixture', { target: 'staging', dry: true });
    results.import = r.units.map(u => ({ unit: u.unit, result: u.result, pending: u.pending, problems: u.problems, unapproved: u.unapproved }));
    results.glossary = { approved: r.glossary.approved, skipped: r.glossary.skipped };
  }
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(results, null, 2));
