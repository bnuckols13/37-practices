/**
 * studio build: one publishable page from translate/studio/. A deliberately
 * small bundler: modules use only `import { a, b as c } from './x.mjs'`,
 * `import * as X from './x.mjs'`, `export function|const|let|class name` and
 * `export { a, b }`. Each module becomes an IIFE returning its exports, in
 * dependency order. The engine's lib/markup.mjs is bundled too, so the
 * editor checks markup with the same code as `accept`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { ENGINE, sha256, writeText, fail } from '../io.mjs';
import { themeCss, FONT_URL } from '../design/tokens.mjs';
import { studioConfig, studioDir } from './outbox.mjs';

const STUDIO = path.join(ENGINE, 'studio');
export const SIZE_BUDGET = 150 * 1024;
const IMPORT_RE = /^import\s+(?:\{([^}]*)\}|\*\s+as\s+(\w+))\s+from\s+'([^']+)';?[ \t]*$/gm;
const EXPORT_DECL_RE = /^export\s+((?:async\s+)?function\s*\*?\s*|const\s+|let\s+|class\s+)([\w$]+)/gm;
const EXPORT_LIST_RE = /^export\s*\{([^}]*)\}\s*(?:from\s+'([^']+)')?;?[ \t]*$/gm;

function parseModule(file) {
  const src = fs.readFileSync(file, 'utf8');
  const deps = [];
  const exports = [];
  let body = src.replace(IMPORT_RE, (_, names, ns, spec) => {
    deps.push({ spec, names, ns });
    return `/*import ${spec}*/`;
  });
  body = body.replace(EXPORT_LIST_RE, (_, names, from) => {
    const list = names.split(',').map(s => s.trim()).filter(Boolean);
    if (from) {
      deps.push({ spec: from, names });
      for (const n of list) exports.push(n.split(/\s+as\s+/).pop());
    } else for (const n of list) exports.push(n.split(/\s+as\s+/).pop() + (n.includes(' as ') ? `: ${n.split(/\s+as\s+/)[0]}` : ''));
    return '';
  });
  body = body.replace(EXPORT_DECL_RE, (_, kw, name) => { exports.push(name); return kw + name; });
  const stray = body.match(/^\s*(import|export)\b.*$/m);
  if (stray) fail(`${path.relative(ENGINE, file)}: unsupported module syntax for the Studio bundler: ${stray[0].trim()}`);
  return { file, body, deps, exports };
}

export function bundle(entry = path.join(STUDIO, 'src', 'main.mjs')) {
  const mods = new Map();
  const order = [];
  const visit = (file, stack = []) => {
    if (mods.has(file)) return;
    if (stack.includes(file)) fail(`import cycle: ${[...stack, file].map(f => path.basename(f)).join(' -> ')}`);
    const m = parseModule(file);
    m.id = '__m' + mods.size;
    mods.set(file, m);
    for (const d of m.deps) {
      d.file = path.resolve(path.dirname(file), d.spec);
      if (!fs.existsSync(d.file)) fail(`${path.relative(ENGINE, file)}: cannot find ${d.spec}`);
      visit(d.file, [...stack, file]);
    }
    order.push(m);
  };
  visit(entry);
  const out = ["(() => {\n'use strict';"];
  for (const m of order) {
    const binds = m.deps.filter(d => !(d.names && m.exports.some(e => d.names.includes(e)) && false)).map(d => {
      const target = mods.get(d.file).id;
      if (d.ns) return `const ${d.ns} = ${target};`;
      const parts = d.names.split(',').map(s => s.trim()).filter(Boolean).map(n => {
        const [a, b] = n.split(/\s+as\s+/);
        return b ? `${a}: ${b}` : a;
      });
      return `const { ${parts.join(', ')} } = ${target};`;
    });
    out.push(`// ${path.relative(ENGINE, m.file)}\nconst ${m.id} = (() => {\n${binds.join('\n')}\n${m.body}\nreturn { ${[...new Set(m.exports)].join(', ')} };\n})();`);
  }
  out.push('})();');
  return out.join('\n');
}

export function buildStudio({ target = 'staging' } = {}) {
  const cfg = studioConfig();
  const t = cfg.targets[target];
  if (!t) fail(`no Studio target "${target}" in translate/studio.json`);
  const css = themeCss() + '\n' + fs.readFileSync(path.join(STUDIO, 'styles.css'), 'utf8');
  const js = bundle().replace(/<\/(script)/gi, '<\\/$1');
  const tpl = fs.readFileSync(path.join(STUDIO, 'body.html'), 'utf8');
  const html = tpl
    .replace('{{TITLE}}', () => t.title || 'Studio')
    .replace('{{FONT_URL}}', () => FONT_URL.replace(/&/g, '&amp;'))
    .replace('{{CSS}}', () => css)
    .replace('{{JS}}', () => js);
  const problems = checkBuild(html, js);
  if (problems.length) fail('studio build: ' + problems.join('; '));
  const p = path.join(studioDir(target), 'studio.html');
  writeText(p, html);
  return { path: p, bytes: Buffer.byteLength(html), sha: sha256(html), html, js };
}

/** What the Artifact page contract refuses, checked before publishing. */
export function checkBuild(html, js) {
  const out = [];
  if (!/<title>[^<]+<\/title>/.test(html.slice(0, 8192))) out.push('no <title> in the first 8KB');
  if (/<(html|head|body|!doctype)\b/i.test(html)) out.push('contains document skeleton tags; the Artifact tool adds its own');
  if (/\b(alert|confirm|prompt)\s*\(/.test(js.replace(/whyPrompt|promptBox|prompt__|\.prompt\b/g, ''))) out.push('uses alert/confirm/prompt, which the viewer blocks');
  if (/window\.print\s*\(|\bprint\s*\(\s*\)/.test(js)) out.push('calls print(), which the viewer blocks');
  const hosts = [...html.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)].map(m => m[1].toLowerCase());
  const allowed = ['fonts.googleapis.com', 'fonts.gstatic.com'];
  const bad = [...new Set(hosts.filter(hh => !allowed.includes(hh)))];
  if (bad.length) out.push(`references hosts the page may not load from: ${bad.join(', ')}`);
  if (Buffer.byteLength(html) > SIZE_BUDGET) out.push(`page is ${Math.round(Buffer.byteLength(html) / 1024)} KB, over the ${SIZE_BUDGET / 1024} KB budget`);
  return out;
}
