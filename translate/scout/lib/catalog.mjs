/**
 * The canon, as 84000 catalogues it. 84000 keeps a TEI "placeholder" for
 * every Kangyur and Tengyur text it has not published, carrying the titles,
 * attributed author, Tibetan translators, Degé location, page count, the
 * texts it comments on, and an editorial status code. They live in
 * github.com/84000/data-tei; the scout keeps a sparse, blob-filtered clone
 * of just the placeholders and section files (about 20 MB) under .cache/.
 *
 * Status codes (from 84000's reading-room app, tei-content.xql):
 *   0 not started · 1, 1.a published · 2, 2.a–2.h translated, in editing
 *   3 current translation project · 4 application pending
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export const DATA_TEI = 'https://github.com/84000/data-tei.git';

export const STATUS_GROUP = code => {
  const c = String(code || '0');
  if (c === '0') return 'not-started';
  if (c.startsWith('1')) return 'published';
  if (c.startsWith('2')) return 'translated';
  if (c === '3') return 'in-translation';
  if (c === '4') return 'in-application';
  return 'unknown';
};

const git = (dir, args, opts = {}) =>
  execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'], ...opts });

export function ensureDataTei(cacheDir, { offline = false, log = () => {} } = {}) {
  const dir = path.join(cacheDir, 'data-tei');
  if (!fs.existsSync(path.join(dir, '.git'))) {
    if (offline) throw new Error('no cached copy of 84000/data-tei; run without --offline once');
    log('  cloning 84000/data-tei (placeholders and sections only)…');
    fs.mkdirSync(cacheDir, { recursive: true });
    execFileSync('git', ['clone', '-q', '--filter=blob:none', '--no-checkout', '--depth', '1', DATA_TEI, dir], { stdio: 'inherit' });
    git(dir, ['config', 'core.longpaths', 'true']);
    git(dir, ['sparse-checkout', 'init', '--no-cone']);
    fs.writeFileSync(path.join(dir, '.git', 'info', 'sparse-checkout'), '/translations/*/placeholders/\n/sections/\n');
    git(dir, ['checkout', '-q']);
  } else if (!offline) {
    try {
      git(dir, ['fetch', '-q', '--depth', '1', 'origin']);
      git(dir, ['reset', '-q', '--hard', 'origin/HEAD']);
    } catch (e) { log(`  could not update data-tei (${e.message.split('\n')[0]}); using the cached copy`); }
  }
  return dir;
}

// ---------- identifiers ----------

/** "Toh 44", "toh44", "TOH 1-1" → "toh44" / "toh1-1". */
export const normToh = s => String(s || '').toLowerCase().replace(/\s+/g, '').replace(/^(toh)?/, 'toh');

/** Filenames look like 052-034_toh2293-caryagitikosavritti.xml or 034-005_toh17,489-the_….xml */
export function tohFromFilename(name) {
  const m = /_toh([0-9]+[a-z]?(?:-[0-9]+[a-z]?)?(?:,[0-9]+[a-z]?(?:-[0-9]+[a-z]?)?)*)-/.exec(name);
  return m ? m[1].split(',').map(t => 'toh' + t) : [];
}

// ---------- TEI parsing (placeholders are small and regular; no XML dependency) ----------

const attrs = s => Object.fromEntries([...s.matchAll(/([\w:-]+)="([^"]*)"/g)].map(m => [m[1], m[2]]));
const unesc = s => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
const clean = s => unesc(s).replace(/­/g, '').replace(/\s+/g, ' ').trim();

const TITLE_LANG = { 'bo': 'bo', 'Bo-Ltn': 'wylie', 'Sa-Ltn': 'sa', 'en': 'en' };

export function parsePlaceholder(xml, file = '') {
  const status = (/<availability\b([^>]*)\/?>/.exec(xml) || [])[1];
  const code = status ? (attrs(status).status || '0') : '0';

  const titles = {};
  for (const m of xml.matchAll(/<title\b([^>]*)>([^<]*)<\/title>/g)) {
    const a = attrs(m[1]);
    const k = TITLE_LANG[a['xml:lang']];
    if (k && (a.type === 'mainTitle' || !a.type) && !titles[k] && clean(m[2])) titles[k] = clean(m[2]);
  }

  const bibls = [...xml.matchAll(/<bibl\b([^>]*)>([\s\S]*?)<\/bibl>/g)]
    .map(m => ({ a: attrs(m[1]), body: m[2] })).filter(b => b.a.key);
  const toh = bibls.map(b => normToh(b.a.key));
  const first = bibls[0]?.body || '';

  const people = [...xml.matchAll(/<author\b([^>]*)>([^<]*)<\/author>/g)].map(m => ({ ...attrs(m[1]), name: clean(m[2]) }));
  const authors = people.filter(p => !p.role || p.role === 'authorContested').map(p => p.name).filter(n => n && n !== 'Anon');
  const loc = (/<location\b([^>]*)>/.exec(first) || [])[1];
  const vols = [...first.matchAll(/<volume\b([^>]*)\/?>/g)].map(m => Number(attrs(m[1]).number)).filter(Boolean);
  const idnos = [...first.matchAll(/<idno\b([^>]*)\/?>/g)].map(m => attrs(m[1]));

  return {
    toh,
    label: clean((/<ref>([^<]*)<\/ref>/.exec(first) || [])[1] || toh.join(', ')),
    file,
    status: code,
    group: STATUS_GROUP(code),
    titles,
    authors,
    authorContested: people.some(p => p.role === 'authorContested'),
    anonymous: people.some(p => !p.role && p.name === 'Anon'),
    translatorsTib: people.filter(p => p.role === 'translatorTib').map(p => p.name),
    translatorsEng: people.filter(p => /^translator(Main|Eng)$/.test(p.role || '')).map(p => p.name),
    pages: loc ? Number(attrs(loc)['count-pages']) || null : null,
    volumes: vols,
    folios: clean((/<biblScope>([^<]*)<\/biblScope>/.exec(first) || [])[1] || ''),
    sectionId: idnos.find(i => i['parent-id'])?.['parent-id'] || '',
    bdrc: idnos.find(i => i['source-id'])?.work || '',
    commentaryOf: [...xml.matchAll(/<link type="isCommentaryOf" target="([^"]+)"/g)].map(m => normToh(m[1])),
    commonSource: [...xml.matchAll(/<link type="hasCommonSourceText" target="([^"]+)"/g)].map(m => normToh(m[1])),
  };
}

export function parseSection(xml) {
  const id = (/<idno xml:id="([^"]+)"/.exec(xml) || [])[1];
  const t = [...xml.matchAll(/<title\b([^>]*)>([^<]*)<\/title>/g)]
    .map(m => ({ a: attrs(m[1]), v: clean(m[2]) }))
    .find(x => x.a['xml:lang'] === 'en' && x.a.type === 'mainTitle' && x.v);
  const parent = (/<idno parent-id="([^"]*)"/.exec(xml) || [])[1] || '';
  return id ? { id, label: t ? t.v.replace(/^./, c => c.toUpperCase()) : id, parent } : null;
}

// ---------- the whole catalogue ----------

export function readCatalog(dir) {
  const head = git(dir, ['log', '-1', '--format=%H %cI']).trim().split(' ');
  const sections = new Map();
  const sdir = path.join(dir, 'sections');
  for (const f of fs.readdirSync(sdir).filter(f => f.endsWith('.xml'))) {
    const s = parseSection(fs.readFileSync(path.join(sdir, f), 'utf8'));
    if (s) sections.set(s.id, s);
  }
  const sectionPath = id => {
    const out = [];
    for (let s = sections.get(id), guard = 0; s && guard < 12; s = sections.get(s.parent), guard++) out.unshift(s.label);
    return out.filter(l => !/^(The Lobby|Translated texts|The Collection)$/i.test(l));
  };

  const records = [];
  for (const canon of ['kangyur', 'tengyur']) {
    const pdir = path.join(dir, 'translations', canon, 'placeholders');
    for (const f of fs.readdirSync(pdir).filter(f => f.endsWith('.xml'))) {
      const r = parsePlaceholder(fs.readFileSync(path.join(pdir, f), 'utf8'), f);
      if (!r.toh.length) continue;
      r.canon = canon;
      r.section = sectionPath(r.sectionId);
      records.push(r);
    }
  }

  // Texts whose TEI already holds a translation (published, or far along in
  // 84000's editing) sit outside placeholders/. Their filenames are enough.
  const inWork = new Set();
  const listing = git(dir, ['ls-tree', '-r', '--name-only', 'HEAD', '--', 'translations']).split('\n');
  for (const p of listing) {
    if (!/\/(translations|publications)\/[^/]+\.xml$/.test(p)) continue;
    for (const t of tohFromFilename(path.basename(p))) inWork.add(t);
  }

  return { records, sections, inWork, snapshot: { commit: head[0], date: head[1] } };
}
