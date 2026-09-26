import { promptPath, readText, exists, fail } from './io.mjs';

/** A prompt file: optional front matter (version: N) + markdown body. */
export function loadPrompt(name) {
  const p = promptPath(name);
  if (!exists(p)) fail(`missing prompt ${name}`);
  const raw = readText(p);
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(raw);
  const version = m ? Number((/version:\s*(\d+)/.exec(m[1]) || [])[1] || 0) : 0;
  return { name, version, body: (m ? raw.slice(m[0].length) : raw).trim() };
}

export function textPrompt(slug) {
  return exists(promptPath(`texts/${slug}.md`)) ? loadPrompt(`texts/${slug}.md`) : loadPrompt('texts/_default.md');
}
