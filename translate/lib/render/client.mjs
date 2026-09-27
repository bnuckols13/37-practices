/**
 * The Reading Room's browser script, written once to
 * translations/assets/reader.js. Pages work without it: terms link to the
 * glossary page, passage numbers are plain anchors, commentary sits in the
 * margin. The script adds the glossary panel and hover preview, the display
 * settings, the passage menu and search.
 */

// Runs synchronously in <head>, before first paint, so a saved theme or display never flashes.
export const HEAD_JS = `(function(){var d=document.documentElement;try{var s=localStorage,t=s.getItem('rr:theme'),p=s.getItem('rr:display'),c=s.getItem('rr:comm');if(t==='light'||t==='dark')d.setAttribute('data-theme',t);if(p)d.setAttribute('data-display',p);if(c)d.setAttribute('data-comm',c);}catch(e){}})();`;

export const READER_JS = String.raw`(function () {
'use strict';
var doc = document, html = doc.documentElement;
function $(s, r) { return (r || doc).querySelector(s); }
function $$(s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); }
function el(tag, attrs, kids) {
  var e = doc.createElement(tag);
  for (var k in attrs || {}) { if (attrs[k] == null || attrs[k] === false) continue; if (k === 'class') e.className = attrs[k]; else if (k === 'text') e.textContent = attrs[k]; else e.setAttribute(k, attrs[k]); }
  (kids || []).forEach(function (c) { if (c != null) e.appendChild(typeof c === 'string' ? doc.createTextNode(c) : c); });
  return e;
}
function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } return null; }
function track(name, data) { try { if (window.track) window.track(name, data || {}); } catch (e) {} }
function copy(text, node) {
  return (navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(text) : Promise.reject()).then(function () { return true; }, function () {
    if (node) { var r = doc.createRange(); r.selectNodeContents(node); var s = getSelection(); s.removeAllRanges(); s.addRange(r); }
    return false;
  });
}
var data = {};
try { var gd = $('#gloss-data'); if (gd) data = JSON.parse(gd.textContent); } catch (e) {}
var fine = window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches;

// ---------- settings ----------
var LABELS = {
  display: { english: 'English', bilingual: 'English and source', study: 'Study', sung: 'As a song' },
  comm: { margin: 'commentary in the margin', inline: 'commentary under each couplet', hidden: 'commentary hidden' },
  theme: { system: 'System', light: 'Light', dark: 'Dark' }
};
function setting(name) { return name === 'theme' ? (html.getAttribute('data-theme') || 'system') : html.getAttribute('data-' + name); }
function apply(name, value) {
  if (name === 'theme') { if (value === 'system') html.removeAttribute('data-theme'); else html.setAttribute('data-theme', value); }
  else html.setAttribute('data-' + name, value);
  store('rr:' + name, value);
  label();
  track('reader_setting', { name: name, value: value });
}
function label() {
  var b = $('#settings-btn'); if (!b) return;
  var hasComm = !!$('.sidenote, .song-comment');
  var d = setting('display'), t = (d === 'sung' && !$('.sung')) ? 'English' : (LABELS.display[d] || 'English');
  var text = 'Display: ' + t + (hasComm ? ', ' + (LABELS.comm[setting('comm')] || '') : '');
  var lab = b.querySelector('.runhead__label'); if (lab) lab.textContent = text;
  b.setAttribute('aria-label', text + '. Change display settings');
}
function openSettings() {
  var hasSrc = !!$('.src'), hasComm = !!$('.sidenote, .song-comment');
  var groups = [];
  function group(name, legend, opts) {
    return el('fieldset', {}, [el('legend', { text: legend })].concat(opts.map(function (o) {
      var id = 'set-' + name + '-' + o[0];
      var input = el('input', { type: 'radio', name: name, id: id, value: o[0] });
      if (setting(name) === o[0]) input.checked = true;
      input.addEventListener('change', function () { apply(name, o[0]); });
      return el('label', { for: id }, [input, el('span', {}, [o[1], o[2] ? el('span', { class: 'hint', text: o[2] }) : null])]);
    })));
  }
  var textOpts = [['english', 'English'], ['bilingual', 'English and source', 'The source text beside the English'], ['study', 'Study', 'The source, a transliteration and a word-by-word gloss beside the English']];
  if ($('.sung')) textOpts.push(['sung', 'As a song', 'The song sounded in English: its rhymes, its refrain and its voice, with the source as it is heard beneath each couplet']);
  if (hasSrc) groups.push(group('display', 'Text', textOpts));
  if (hasComm) groups.push(group('comm', 'Commentary', [['margin', 'In the margin', 'Beside the couplet it explains; under it when the source is shown'], ['inline', 'Under each couplet'], ['hidden', 'Hidden']]));
  groups.push(group('theme', 'Appearance', [['system', 'Match my device'], ['light', 'Light'], ['dark', 'Dark']]));
  dialog('Display', [el('form', { class: 'settings' }, groups)]);
}

// ---------- dialog ----------
var lastFocus = null;
function dialog(title, kids) {
  closeDialog();
  lastFocus = doc.activeElement;
  var close = el('button', { type: 'button', class: 'link', text: 'Done' });
  var card = el('div', { class: 'dialog__card', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'dlg-h' }, [el('h2', { id: 'dlg-h', text: title })].concat(kids, [el('p', { class: 'dialog__done' }, [close])]));
  var wrap = el('div', { class: 'dialog', id: 'dialog' }, [card]);
  wrap.addEventListener('click', function (e) { if (e.target === wrap) closeDialog(); });
  close.addEventListener('click', closeDialog);
  doc.body.appendChild(wrap);
  var first = card.querySelector('input:checked, input, button');
  if (first) first.focus();
  return card;
}
function closeDialog() { var d = $('#dialog'); if (d) { d.remove(); if (lastFocus && lastFocus.focus) lastFocus.focus(); } }

// ---------- glossary panel and preview ----------
var panel = null, pinned = null, preview = null, hoverTimer = null;
function formsLine(e) {
  return el('p', { class: 'glpanel__forms' }, e.forms.map(function (f, i) {
    return el('span', {}, [i ? '; ' : '', f.lang + ' ', el('span', { lang: f.html || null, text: f.script || '' }), f.script ? ' ' : '', el('i', { text: f.translit || '' }), f.att ? ' ' : '', f.att ? el('abbr', { class: 'att', title: f.attTitle, text: f.att }) : null]);
  }));
}
function openPanel(a) {
  var id = a.getAttribute('data-g'), e = data[id]; if (!e) return false;
  closePreview();
  if (pinned) pinned.setAttribute('aria-expanded', 'false');
  pinned = a; a.setAttribute('aria-expanded', 'true');
  if (!panel) { panel = el('aside', { class: 'glpanel', id: 'gl-panel', role: 'dialog', 'aria-labelledby': 'gl-h', tabindex: '-1' }); doc.body.appendChild(panel); }
  panel.hidden = false;
  panel.replaceChildren();
  var close = el('button', { type: 'button', class: 'link glpanel__close', text: 'Close' });
  close.addEventListener('click', closePanel);
  var kids = [close, el('h2', { id: 'gl-h', text: e.en }), el('p', { class: 'glpanel__type', text: e.type })];
  if (e.forms.length) kids.push(formsLine(e));
  if (e.def) kids.push(el('p', { class: 'glpanel__def', text: e.def }));
  if (e.sym) kids.push(el('p', { class: 'glpanel__sym', text: e.sym }));
  if (e.where && e.where.length) {
    var at = ['In this text at '];
    e.where.forEach(function (w, i) { if (i) at.push(i === e.where.length - 1 ? ' and ' : ', '); at.push(el('a', { href: w.href, text: w.label })); });
    at.push('.');
    kids.push(el('p', { class: 'glpanel__where' }, at));
  }
  kids.push(el('p', { class: 'glpanel__where' }, [el('a', { href: a.getAttribute('href'), text: 'Full entry in the glossary' })]));
  kids.forEach(function (k) { panel.appendChild(k); });
  panel.focus();
  track('glossary_open', { term: id });
  return true;
}
function closePanel() {
  if (!panel || panel.hidden) return;
  panel.hidden = true;
  if (pinned) { pinned.setAttribute('aria-expanded', 'false'); pinned.focus(); pinned = null; }
}
function showPreview(a) {
  var e = data[a.getAttribute('data-g')]; if (!e) return;
  closePreview();
  preview = el('div', { class: 'preview', role: 'tooltip' }, [el('b', { text: e.en }), el('i', { text: e.type + (e.forms[0] && e.forms[0].translit ? ', ' + e.forms[0].translit : '') }), e.def ? el('p', { text: e.def.length > 180 ? e.def.slice(0, 177) + '…' : e.def }) : null]);
  doc.body.appendChild(preview);
  var r = a.getBoundingClientRect(), w = preview.offsetWidth;
  preview.style.left = Math.max(16, Math.min(scrollX + r.left, scrollX + html.clientWidth - w - 16)) + 'px';
  preview.style.top = (scrollY + r.bottom + 8) + 'px';
}
function closePreview() { clearTimeout(hoverTimer); if (preview) { preview.remove(); preview = null; } }

// ---------- passage menu ----------
var menu = null;
function closeMenu() { if (menu) { menu.remove(); menu = null; } }
function openMenu(btn) {
  closeMenu();
  var sec = btn.closest('.passage'); if (!sec) return;
  var url = location.href.split('#')[0] + '#' + sec.id;
  var no = btn.textContent.trim();
  var meta = $('meta[name="citation"]');
  var cite = (meta ? meta.getAttribute('content').replace('{p}', no) : doc.title + ', ' + no + '.') + ' ' + url;
  var citeBox = el('p', { class: 'cite', text: cite });
  var b1 = el('button', { type: 'button', text: 'Copy link to ' + no });
  var b2 = el('button', { type: 'button', text: 'Copy citation' });
  b1.addEventListener('click', function () { copy(url).then(function (ok) { b1.textContent = ok ? 'Link copied' : 'Press Ctrl+C to copy'; }); track('passage_link', { passage: no }); });
  b2.addEventListener('click', function () { copy(cite, citeBox).then(function (ok) { b2.textContent = ok ? 'Citation copied' : 'Selected: press Ctrl+C'; }); track('passage_cite', { passage: no }); });
  menu = el('div', { class: 'menu', role: 'menu' }, [b1, b2, citeBox]);
  doc.body.appendChild(menu);
  var r = btn.getBoundingClientRect();
  menu.style.left = Math.max(16, Math.min(scrollX + r.left, scrollX + html.clientWidth - menu.offsetWidth - 16)) + 'px';
  menu.style.top = (scrollY + r.bottom + 6) + 'px';
  b1.focus();
}

// ---------- search ----------
var index = null;
function fold(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
function openSearch() {
  var src = $('meta[name="search-index"]'); if (!src) return;
  var q = el('input', { type: 'search', class: 'search__q', id: 'search-q', placeholder: 'Words, names or passage numbers', 'aria-label': 'Search this text', autocomplete: 'off' });
  var res = el('ul', { class: 'search__res', id: 'search-res', 'aria-live': 'polite' });
  dialog('Search this text', [q, res]);
  q.focus();
  function run() {
    var f = fold(q.value.trim()); res.replaceChildren();
    if (!f || !index) return;
    var hits = [];
    index.docs.forEach(function (d) {
      var hay = fold(d.slice(3).join(' ')), i = hay.indexOf(f);
      if (i < 0) return;
      var rank = (d[0] === 'g' ? 0 : d[0] === 'p' ? 1 : 2) * 10 + (fold(d[3]).indexOf(f) === 0 ? 0 : 5);
      hits.push([rank, d]);
    });
    hits.sort(function (a, b) { return a[0] - b[0]; });
    if (!hits.length) { res.appendChild(el('li', { class: 'search__none', text: 'Nothing matches “' + q.value + '”.' })); return; }
    hits.slice(0, 30).forEach(function (h) {
      var d = h[1], kind = { p: 'Passage ' + d[1] + (d[3] ? ', ' + d[3] : ''), c: d[3] + ' on ' + d[1], g: 'Glossary: ' + d[3] }[d[0]];
      var text = d[4] || '', at = fold(text).indexOf(f);
      var body = at < 0 ? [text] : [text.slice(0, at), el('mark', { text: text.slice(at, at + q.value.trim().length) }), text.slice(at + q.value.trim().length)];
      res.appendChild(el('li', {}, [el('a', { href: d[2] }, [el('span', { class: 'k', text: kind }), el('span', { class: 't' }, body)])]));
    });
  }
  q.addEventListener('input', run);
  if (!index) fetch(src.getAttribute('content')).then(function (r) { return r.json(); }).then(function (j) { index = j; run(); }, function () { res.replaceChildren(el('li', { class: 'search__none', text: 'Search could not load. Try again later.' })); });
  track('search_open', {});
}

// ---------- events ----------
doc.addEventListener('click', function (e) {
  var t = e.target;
  var a = t.closest && t.closest('a.gl');
  if (a && data[a.getAttribute('data-g')] && !e.metaKey && !e.ctrlKey) { e.preventDefault(); if (pinned === a && panel && !panel.hidden) closePanel(); else openPanel(a); return; }
  var pno = t.closest && t.closest('.passages .pno');
  if (pno && !e.metaKey && !e.ctrlKey && !e.shiftKey) { e.preventDefault(); if (history.replaceState && pno.hash) history.replaceState(null, '', pno.hash); openMenu(pno); return; }
  if (menu && !menu.contains(t)) closeMenu();
  if (t.closest && t.closest('#settings-btn')) { openSettings(); return; }
  if (t.closest && t.closest('[data-search]')) { openSearch(); return; }
  if (t.closest && t.closest('[data-rail-toggle]')) {
    var open = html.getAttribute('data-rail') === 'open';
    if (open) { closeRail(); return; }
    html.setAttribute('data-rail', 'open'); t.closest('[data-rail-toggle]').setAttribute('aria-expanded', 'true');
    var cur = $('#rail [aria-current="page"]') || $('#rail a'); if (cur) cur.focus();
    return;
  }
  if (panel && !panel.hidden && !panel.contains(t)) closePanel();
  if (html.getAttribute('data-rail') === 'open' && !(t.closest && t.closest('#rail'))) closeRail();
});
function closeRail() { html.setAttribute('data-rail', ''); var b = $('[data-rail-toggle]'); if (b) b.setAttribute('aria-expanded', 'false'); }
if (fine) {
  doc.addEventListener('mouseover', function (e) { var a = e.target.closest && e.target.closest('a.gl'); if (!a || a === pinned) return; clearTimeout(hoverTimer); hoverTimer = setTimeout(function () { showPreview(a); }, 380); });
  doc.addEventListener('mouseout', function (e) { var a = e.target.closest && e.target.closest('a.gl'); if (a) closePreview(); });
}
doc.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') { if ($('#dialog')) closeDialog(); else if (menu) closeMenu(); else if (panel && !panel.hidden) closePanel(); else if (html.getAttribute('data-rail') === 'open') closeRail(); closePreview(); return; }
  var typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target || {}).tagName || '');
  if (!typing && e.key === '/' && $('meta[name="search-index"]')) { e.preventDefault(); openSearch(); }
});
window.addEventListener('beforeprint', function () { $$('details').forEach(function (d) { d.open = true; }); });

// ---------- glossary page filters ----------
var gfilter = $('#gfilter');
if (gfilter) {
  var type = 'all';
  var refresh = function () {
    var f = fold(gfilter.value.trim());
    $$('.gentry').forEach(function (g) { g.hidden = !((type === 'all' || g.getAttribute('data-type') === type) && (!f || fold(g.textContent).indexOf(f) >= 0)); });
    $$('.letter').forEach(function (l) { var n = l.nextElementSibling, any = false; while (n && !n.classList.contains('letter')) { if (n.classList.contains('gentry') && !n.hidden) any = true; n = n.nextElementSibling; } l.hidden = !any; });
  };
  gfilter.addEventListener('input', refresh);
  $$('.gtools .seg').forEach(function (b) { b.addEventListener('click', function () { type = b.getAttribute('data-type'); $$('.gtools .seg').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); }); refresh(); }); });
}

label();
})();
`;
