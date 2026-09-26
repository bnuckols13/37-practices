/**
 * Page shell for /translations/. Mirrors pageShell() in build/build.mjs
 * (same head, analytics, favicon, OG and JSON-LD conventions) with its own
 * masthead and footer, so these pages don't read as 37 Practices material.
 */

import path from 'node:path';
import { ENGINE, readText, config, fail } from '../io.mjs';
import { PAGE_CSS, ILLUM_CSS, SCRIPT } from './assets.mjs';

// Same small helpers as build/build.mjs:45-55 and :364.
export const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const attr = s => esc(s).replace(/"/g, '&quot;');
export const jsonLd = o => JSON.stringify(o).replace(/</g, '\\u003c');

export const site = () => (config().site || 'https://37practices.space').replace(/\/$/, '');

const BASE_FONTS = 'family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Cinzel:wght@400;600&family=Lato:wght@300;400;700';
const SCRIPT_FONTS = { bn: 'family=Noto+Serif+Bengali:wght@400;500', bo: 'family=Noto+Serif+Tibetan:wght@400' };
export const fontsUrl = (langs = []) => 'https://fonts.googleapis.com/css2?' + [BASE_FONTS, ...langs.map(l => SCRIPT_FONTS[l]).filter(Boolean)].join('&') + '&display=swap';

let cssCache = null;
/** The site's stylesheet, taken from build/template.html as build.mjs does (build.mjs:544-546). */
export function siteCss() {
  if (cssCache) return cssCache;
  const tpl = readText(path.join(ENGINE, '..', 'build', 'template.html'));
  const css = (tpl.match(/<style>([\s\S]*?)<\/style>/) || [])[1];
  if (!css) fail('build/template.html has no <style> block to share');
  return (cssCache = css + PAGE_CSS + ILLUM_CSS);
}

export const crumbs = items => items.map(([label, href]) => (href ? `<a href="${attr(href)}">${esc(label)}</a>` : `<span>${esc(label)}</span>`))
  .join('<span class="sep">›</span>');

export function breadcrumbLd(url, items) {
  return {
    '@type': 'BreadcrumbList', '@id': url + '#breadcrumb',
    itemListElement: items.map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item })),
  };
}

export function page({ root, url, title, description, pageType, unitAttr = '', ld, eyebrow = 'Illuminated Translations',
  masthead, crumbsHtml, body, footer, fonts = [], glossData = null, bodyClass = '', noindex = false }) {
  return `<!DOCTYPE html>
<html lang="en" data-page-type="${pageType}"${unitAttr ? ` data-unit="${attr(unitAttr)}"` : ''}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script src="${root}assets/analytics.js"></script>
<title>${esc(title)}</title>
<meta name="description" content="${attr(description)}">
${noindex ? '<meta name="robots" content="noindex">\n' : ''}<link rel="canonical" href="${url}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Illuminated Translations · 37practices.space">
<meta property="og:title" content="${attr(title)}">
<meta property="og:description" content="${attr(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${site()}/assets/og-image.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#4A0F0F">
<link rel="icon" href="${root}assets/favicon.svg" type="image/svg+xml">
<link rel="icon" href="${root}assets/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="${root}assets/apple-touch-icon.png">
<script type="application/ld+json">${jsonLd(ld)}</script>
<link href="${fontsUrl(fonts)}" rel="stylesheet">
<style>${siteCss()}</style>
</head>
<body${bodyClass ? ` class="${bodyClass}"` : ''}>

<header class="masthead">
  <div class="eyebrow">${esc(eyebrow)}</div>
  ${masthead}
  <nav class="crumbs" aria-label="Breadcrumb">${crumbsHtml}</nav>
</header>

${body}

<footer class="foot">
${footer}
</footer>
${glossData ? `<script type="application/json" id="gloss-data">${jsonLd(glossData)}</script>\n` : ''}<script>${SCRIPT}</script>
</body>
</html>
`;
}
