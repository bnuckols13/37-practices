import path from 'node:path';
import { paths, readJSON, exists, fail, listFiles, home } from './io.mjs';
import { Text } from '../schemas/text.mjs';
import { Unit, UnitsIndex } from '../schemas/unit.mjs';

export function loadText(slug) {
  if (!slug) fail('which text? e.g. `node cli.mjs status charyapada`');
  const P = paths(slug);
  if (!exists(P.text)) fail(`no text "${slug}" (expected ${P.text}); create it with \`new\``);
  const r = Text.safeParse(readJSON(P.text));
  if (!r.success) fail(`texts/${slug}/text.json: ${r.error.issues.map(i => i.path.join('.') + ' ' + i.message).join('; ')}`);
  if (r.data.slug !== slug) fail(`texts/${slug}/text.json has slug "${r.data.slug}"`);
  return r.data;
}

export function unitsIndex(slug) {
  const P = paths(slug);
  if (!exists(P.unitsIndex)) return { text: slug, units: [], ids: [], tombstones: [] };
  return UnitsIndex.parse(readJSON(P.unitsIndex));
}

export function unitIds(slug) {
  return unitsIndex(slug).units.map(u => u.id);
}

export function loadUnit(slug, id) {
  const p = paths(slug).unit(id);
  if (!exists(p)) fail(`no unit ${id}; run segment`);
  return Unit.parse(readJSON(p));
}

export const witnessOf = (text, id) => text.witnesses.find(w => w.id === id);

export function allTexts() {
  return listFiles(path.join(home(), 'texts')).filter(s => exists(paths(s).text));
}
