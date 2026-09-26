// Build a persistent engine home holding the drafted and woven practice song,
// for seeding the staging Studio:
//   node test/ui/fixture-home.mjs translate/.studio/staging-home
// Then run studio commands with TRANSLATE_HOME pointing at that directory.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FIX = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');
const dir = path.resolve(process.argv[2] || 'translate/.studio/staging-home');
if (fs.existsSync(path.join(dir, 'texts', 'fixture', 'drafts'))) {
  console.log(`already built: ${dir}`);
  process.exit(0);
}
fs.mkdirSync(path.join(dir, 'texts', 'fixture'), { recursive: true });
fs.mkdirSync(path.join(dir, 'glossary'), { recursive: true });
fs.copyFileSync(path.join(FIX, 'fixture', 'text.json'), path.join(dir, 'texts', 'fixture', 'text.json'));
fs.writeFileSync(path.join(dir, 'texts', 'fixture', 'style.md'),
  '# Style notes: Test Fixture Songs\n\n- Translate the image, not its esoteric referent.\n- Keep each half-line as its own English line.\n');
fs.writeFileSync(path.join(dir, 'glossary', 'glossary.json'), '{"entries":[]}\n');
process.env.TRANSLATE_HOME = dir;

const { importSource, segment } = await import('../../lib/project.mjs');
importSource('fixture', { witness: 'ed', content: fs.readFileSync(path.join(FIX, 'raw.txt'), 'utf8'), label: 'practice fixture' });
const marked = path.join(dir, 'texts', 'fixture', 'source', 'ed.txt');
fs.writeFileSync(marked, fs.readFileSync(marked, 'utf8').split('\n')[0] + '\n' + fs.readFileSync(path.join(FIX, 'marked-directives.txt'), 'utf8'));
segment('fixture');

const { writePacks } = await import('../../lib/pack.mjs');
const { ingest } = await import('../../lib/ingest.mjs');
for (const [task, file] of [['draft', 'draft-fx.01.json'], ['weave', 'weave-fx.01.json']]) {
  writePacks('fixture', ['fx.01'], task);
  ingest('fixture', ['fx.01'], { task, answers: { 'fx.01': JSON.parse(fs.readFileSync(path.join(FIX, 'answers', file), 'utf8')) } });
}
console.log(`built ${dir}`);
