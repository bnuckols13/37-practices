// A scratch engine home with the fixture text, for tests. Call before using the libs.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const FIX = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');

export function scratch() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'translate-test-'));
  fs.mkdirSync(path.join(dir, 'texts', 'fixture'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'glossary'), { recursive: true });
  fs.copyFileSync(path.join(FIX, 'fixture', 'text.json'), path.join(dir, 'texts', 'fixture', 'text.json'));
  fs.writeFileSync(path.join(dir, 'glossary', 'glossary.json'), '{"entries":[]}\n');
  process.env.TRANSLATE_HOME = dir;
  process.env.SITE_ROOT = path.join(dir, 'site');
  return dir;
}

export const read = p => fs.readFileSync(p, 'utf8');
export const fixture = name => read(path.join(FIX, name));
export const answer = name => JSON.parse(fixture(path.join('answers', name)));

/** Import the raw fixture and replace the working copy with the marked version. */
export async function importAndMark(dir) {
  const { importSource } = await import('../lib/project.mjs');
  importSource('fixture', { witness: 'ed', content: fixture('raw.txt'), label: 'fixture' });
  const marked = path.join(dir, 'texts', 'fixture', 'source', 'ed.txt');
  const first = read(marked).split('\n')[0];
  fs.writeFileSync(marked, first + '\n' + fixture('marked-directives.txt'));
  // The Tibetan parallel of song 1.
  importSource('fixture', { witness: 'tib', content: fixture('raw-tib.txt'), label: 'fixture' });
  const tib = path.join(dir, 'texts', 'fixture', 'source', 'tib.txt');
  fs.writeFileSync(tib, read(tib).split('\n')[0] + '\n' + fixture('marked-tib.txt'));
  return marked;
}

/** Put an answer where a session drafter would, then ingest it. */
export async function ingestAnswer(dir, task, unit, body) {
  const { ingest } = await import('../lib/ingest.mjs');
  const p = path.join(dir, 'texts', 'fixture', 'inbox', task, unit + '.json');
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(body));
  return ingest('fixture', [unit], { task });
}

/** Mark every Decision in a sheet (unit or glossary) as given. */
export function decideAll(sheetPath, unitWord = 'ok', glossWord = 'approve') {
  const s = read(sheetPath);
  const [head, gloss = ''] = s.split('## Glossary');
  const fill = (t, w) => t.replace(/\*\*Decision:\*\*[^\n]*/g, `**Decision:** ${w}`);
  fs.writeFileSync(sheetPath, fill(head, unitWord) + (gloss ? '## Glossary' + fill(gloss, glossWord) : ''));
}
