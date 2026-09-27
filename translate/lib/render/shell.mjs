/**
 * Page shell for /translations/: a running head like a book's, the
 * self-hosted type, and the site's shared plumbing (analytics.js,
 * canonical/OG/JSON-LD, favicon and the consent link). The breadcrumb trail
 * lives in JSON-LD; on the page, the running head carries it.
 */

import { config } from '../io.mjs';
import { COLORS } from '../design/tokens.mjs';
import { HEAD_JS } from './client.mjs';

// Same small helpers as build/build.mjs:45-55 and :364.
export const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const attr = s => esc(s).replace(/"/g, '&quot;');
export const jsonLd = o => JSON.stringify(o).replace(/</g, '\\u003c');
export const site = () => (config().site || 'https://37practices.space').replace(/\/$/, '');

export function breadcrumbLd(url, items) {
  return {
    '@type': 'BreadcrumbList', '@id': url + '#breadcrumb',
    itemListElement: items.map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item })),
  };
}

/**
 * root: path from this page to the site root ("../../" for translations/<text>/x.html)
 * assets: path to translations/assets/ ("../assets/" or "assets/")
 */
export function page({ root, assets, v, url, title, description, pageType, unitAttr = '', ld, body, footer,
  textTitle = '', textHref = '', rail = false, search = '', citation = '', glossData = null, noindex = false }) {
  return `<!DOCTYPE html>
<html lang="en" data-page-type="${pageType}" data-display="english" data-comm="margin"${unitAttr ? ` data-unit="${attr(unitAttr)}"` : ''}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script>${HEAD_JS}</script>
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
<meta name="theme-color" content="${COLORS.paper[0]}" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="${COLORS.paper[1]}" media="(prefers-color-scheme: dark)">
${citation ? `<meta name="citation" content="${attr(citation)}">\n` : ''}${search ? `<meta name="search-index" content="${attr(search)}">\n` : ''}<link rel="icon" href="${root}assets/favicon.svg" type="image/svg+xml">
<link rel="icon" href="${root}assets/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="${root}assets/apple-touch-icon.png">
<script type="application/ld+json">${jsonLd(ld)}</script>
<link rel="preload" href="${assets}fonts/IlluminatedText-Regular.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${assets}reader.css?v=${v}">
<script src="${assets}reader.js?v=${v}" defer></script>
</head>
<body>
<a class="skip" href="#main">Skip to the text</a>
<header class="runhead">
  ${rail ? '<button type="button" class="link only-narrow" data-rail-toggle aria-expanded="false" aria-controls="rail">Contents</button>' : ''}
  <a class="runhead__home" href="${root}translations/index.html"><span class="runhead__mark" aria-hidden="true">॥</span><span class="runhead__name">Illuminated Translations</span></a>
  ${textTitle ? `<a class="runhead__text" href="${attr(textHref)}">${esc(textTitle)}</a>` : '<span class="runhead__text"></span>'}
  <span class="runhead__tools">${search ? '<button type="button" class="link" data-search>Search</button>' : ''}<button type="button" class="link" id="settings-btn"><span class="runhead__label">Display</span><span class="runhead__short">Display</span></button></span>
</header>
${body}
<footer class="foot">
${footer}
</footer>
${glossData ? `<script type="application/json" id="gloss-data">${jsonLd(glossData)}</script>\n` : ''}</body>
</html>
`;
}
