// Opt-in browser pass on the rendered Reading Room (needs Playwright's Chromium):
//   node test/ui/reader.shot.mjs <outdir>
// Approves the practice song through the sheet path, renders it, serves the
// site over http and checks the reader's behaviour at desktop and phone widths,
// light and dark, saving a screenshot of each page.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { execSync } from 'node:child_process';

const OUT = path.resolve(process.argv[2] || '.');
fs.mkdirSync(OUT, { recursive: true });
const { chromium } = await import(path.join(execSync('npm root -g').toString().trim(), 'playwright', 'index.mjs'));

const { scratch, importAndMark, ingestAnswer, answer, decideAll } = await import('../helpers.mjs');
const dir = scratch();
await importAndMark(dir);
const { segment } = await import('../../lib/project.mjs');
const { writePacks } = await import('../../lib/pack.mjs');
const { writeSheet } = await import('../../lib/review/write.mjs');
const { acceptSheet } = await import('../../lib/accept.mjs');
const { render } = await import('../../lib/render/index.mjs');
const { check } = await import('../../lib/check.mjs');
segment('fixture');
writePacks('fixture', ['fx.01'], 'draft');
await ingestAnswer(dir, 'draft', 'fx.01', answer('draft-fx.01.json'));
writePacks('fixture', ['fx.01'], 'weave');
await ingestAnswer(dir, 'weave', 'fx.01', answer('weave-fx.01.json'));
writeSheet('fixture', 'fx.01');
const sheet = path.join(dir, 'texts', 'fixture', 'review', 'fx.01.md');
decideAll(sheet, 'ok', 'approve');
fs.writeFileSync(sheet, fs.readFileSync(sheet, 'utf8').replace('into the restless mind, time has entered.', 'time has entered the restless mind.'));
const acc = acceptSheet('fixture', 'fx.01');
if (!acc.approved) throw new Error('fixture did not approve: ' + JSON.stringify(acc.problems));
render('fixture');
const { errors } = check('fixture', { strict: true });
if (errors.length) throw new Error('check: ' + errors.join('\n'));

const site = process.env.SITE_ROOT;
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const p = path.join(site, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(site) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
  res.end(fs.readFileSync(p));
}).listen(0);
const base = `http://127.0.0.1:${server.address().port}/translations/fixture/`;

const results = [];
const ok = (name, cond, detail = '') => { results.push([cond ? 'ok' : 'FAIL', name, detail]); };
const browser = await chromium.launch();

async function open(file, { width = 1440, height = 1000, scheme = 'light', mobile = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, colorScheme: scheme, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 });
  // Fonts come from Google, which the sandbox may block; don't let that stall a load.
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/fonts|analytics|favicon|apple-touch|Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await page.goto(base + file, { waitUntil: 'load' });
  return { ctx, page, errs };
}
const noHScroll = page => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

// --- desktop, light: the song page
{
  const { ctx, page, errs } = await open('01.html');
  ok('song: no horizontal scroll at 1440', await noHScroll(page));
  const geo = await page.evaluate(() => {
    const v = document.querySelector('#c1 .passage__verse').getBoundingClientRect();
    const s = document.querySelector('#c1 .sidenote').getBoundingClientRect();
    const n = document.querySelector('#c1 .pno').getBoundingClientRect();
    return { verseRight: v.right, noteLeft: s.left, noteTop: s.top, verseTop: v.top, noRight: n.right, verseLeft: v.left };
  });
  ok('sidenote sits in the margin beside its couplet', geo.noteLeft >= geo.verseRight && Math.abs(geo.noteTop - geo.verseTop) < 40, JSON.stringify(geo));
  ok('passage number sits in the left margin', geo.noRight <= geo.verseLeft);
  ok('one-time glossary hint shows', await page.locator('.hint-gl').count() === 1);
  await page.screenshot({ path: path.join(OUT, 'song-desktop.png'), fullPage: true });

  // hover preview after a delay, then click to pin in the panel
  const term = page.locator('.passages a.gl[data-g="taruvara"]').first();
  await term.hover();
  await page.waitForTimeout(150);
  ok('no preview before the hover delay', await page.locator('.preview').count() === 0);
  await page.waitForTimeout(450);
  ok('hover preview appears', await page.locator('.preview').count() === 1);
  await page.screenshot({ path: path.join(OUT, 'song-preview.png') });
  await term.click();
  ok('click pins the glossary panel', await page.locator('.glpanel:not([hidden])').count() === 1 && await term.getAttribute('aria-expanded') === 'true');
  ok('panel lists where the term appears', /In this text/.test(await page.locator('.glpanel').innerText()));
  ok('opening the panel retires the hint', await page.locator('.hint-gl').count() === 0);
  await page.screenshot({ path: path.join(OUT, 'song-panel.png') });
  await page.keyboard.press('Escape');
  ok('Esc closes the panel and returns focus to the term', await page.locator('.glpanel:not([hidden])').count() === 0
    && await page.evaluate(() => document.activeElement?.getAttribute('data-g')) === 'taruvara');

  // passage menu: copy link, cite
  await page.locator('#c1 .pno').click();
  const cite = await page.locator('.menu .cite').innerText();
  ok('passage menu offers link and citation', await page.locator('.menu button').count() === 2);
  ok('citation names the passage and the page', /song 1\.1\. .*01\.html#c1$/.test(cite) && !cite.includes('{p}'), cite);
  await page.screenshot({ path: path.join(OUT, 'song-menu.png') });
  await page.keyboard.press('Escape');

  // settings: labelled with their state
  const label = () => page.locator('#settings-btn .bar__label').innerText();
  ok('settings label states the display', await label() === 'Display: English · commentary in margin', await label());
  await page.locator('#settings-btn').click();
  await page.locator('label[for="set-display-study"]').click();
  await page.locator('label[for="set-comm-inline"]').click();
  ok('study display shows source, transliteration and gloss', await page.locator('#c1 .src').first().isVisible() && await page.locator('#c1 .lit').first().isVisible());
  ok('settings label follows the choice', await label() === 'Display: Study · commentary under each passage', await label());
  await page.locator('.dialog .btn').click();
  const inline = await page.evaluate(() => {
    const v = document.querySelector('#c1 .passage__verse').getBoundingClientRect(), s = document.querySelector('#c1 .sidenote').getBoundingClientRect();
    return s.top >= v.bottom - 1 && Math.abs(s.left - v.left) < 30;
  });
  ok('inline commentary folds under its couplet', inline);
  await page.screenshot({ path: path.join(OUT, 'song-study-inline.png'), fullPage: true });
  await page.reload();
  ok('settings persist across loads', await page.evaluate(() => document.documentElement.dataset.display) === 'study');

  // search
  await page.keyboard.press('/');
  await page.locator('#search-q').fill('tree');
  await page.waitForSelector('#search-res li a');
  const hits = await page.locator('#search-res li').allInnerTexts();
  ok('search finds the glossary term and the passage', hits.some(h => /glossary/i.test(h)) && hits.some(h => /passage 1\.1/i.test(h)), hits.join(' | '));
  await page.screenshot({ path: path.join(OUT, 'song-search.png') });
  ok('no script errors on the song page', !errs.length, errs.join('; '));
  await ctx.close();
}

// --- other pages, desktop light
for (const [file, shot] of [['index.html', 'title-desktop.png'], ['glossary.html', 'glossary-desktop.png'], ['about.html', 'about-desktop.png'], ['../index.html', 'texts-index.png']]) {
  const { ctx, page, errs } = await open(file);
  ok(`${file}: no horizontal scroll`, await noHScroll(page));
  ok(`${file}: no script errors`, !errs.length, errs.join('; '));
  if (file === 'glossary.html') {
    await page.locator('#gfilter').fill('bliss');
    const shown = await page.locator('.gentry:not([hidden])').count();
    ok('glossary filter narrows the list', shown === 1, String(shown));
    await page.locator('#gfilter').fill('');
    await page.locator('.gtools .seg[data-type="person"]').click();
    ok('type filter shows people only', await page.locator('.gentry:not([hidden])').count() === 1);
    await page.locator('.gtools .seg[data-type="all"]').click();
  }
  if (file === 'index.html') {
    await page.locator('.howto a.gl').first().click();
    ok('title page sample term opens the panel', await page.locator('.glpanel:not([hidden])').count() === 1);
    await page.keyboard.press('Escape');
  }
  await page.screenshot({ path: path.join(OUT, shot), fullPage: true });
  await ctx.close();
}

// --- phone, light and dark
for (const scheme of ['light', 'dark']) {
  const { ctx, page, errs } = await open('01.html', { width: 390, height: 844, scheme, mobile: true });
  ok(`phone ${scheme}: no horizontal scroll`, await noHScroll(page));
  ok(`phone ${scheme}: rail is hidden until asked`, !(await page.locator('#rail').isVisible()) || await page.evaluate(() => document.querySelector('#rail').getBoundingClientRect().right <= 0));
  await page.screenshot({ path: path.join(OUT, `song-phone-${scheme}.png`), fullPage: true });
  await page.locator('[data-rail-toggle]').click();
  await page.waitForTimeout(300);
  ok(`phone ${scheme}: Contents opens the rail, full height, focus inside`, await page.evaluate(() => { const r = document.querySelector('#rail').getBoundingClientRect(); return r.left >= 0 && r.bottom >= innerHeight - 1 && document.querySelector('#rail').contains(document.activeElement); }));
  await page.screenshot({ path: path.join(OUT, `song-phone-${scheme}-rail.png`) });
  await page.keyboard.press('Escape');
  ok(`phone ${scheme}: no script errors`, !errs.length, errs.join('; '));
  await ctx.close();
}
{
  const { ctx, page } = await open('01.html', { scheme: 'dark' });
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  ok('dark scheme darkens the page', bg === 'rgb(21, 25, 28)', bg);
  await page.screenshot({ path: path.join(OUT, 'song-desktop-dark.png'), fullPage: true });
  await ctx.close();
  const t = await open('index.html', { scheme: 'dark' });
  await t.page.screenshot({ path: path.join(OUT, 'title-desktop-dark.png'), fullPage: true });
  await t.ctx.close();
}
{
  const { ctx, page } = await open('01.html', { width: 1024 });
  ok('1024: no horizontal scroll', await noHScroll(page));
  await page.screenshot({ path: path.join(OUT, 'song-1024.png'), fullPage: true });
  await ctx.close();
}

await browser.close();
server.close();
for (const r of results) console.log(r.filter(Boolean).join('  '));
const failed = results.filter(r => r[0] === 'FAIL').length;
console.log(`\n${results.length - failed} ok, ${failed} failed · screenshots in ${OUT}`);
process.exit(failed ? 1 : 0);
