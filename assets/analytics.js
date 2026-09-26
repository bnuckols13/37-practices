/**
 * 37practices.space: analytics bootstrap.
 *
 * Loaded synchronously in <head> on every page, before any other script, so the
 * consent defaults are in place before Google Analytics starts:
 *
 *   1. Consent Mode v2 defaults: analytics denied in the EEA, UK and Switzerland
 *      until the visitor accepts; ad signals denied everywhere (the site runs no ads).
 *   2. Page context (page_type, verse_number) from <html data-page-type data-verse>.
 *   3. Google Analytics 4, either straight through gtag.js or through Google Tag
 *      Manager, depending on MODE below. See analytics/README.md.
 *   4. window.track(event, params) for page scripts, plus site-wide tracking of
 *      mailto: links and [data-cta] clicks.
 *   5. A small consent notice for visitors whose time zone is in Europe, reopened
 *      by any [data-consent-open] link.
 *
 * Never send names, email addresses, or anything typed into the forms.
 */
(function (w, d) {
  'use strict';

  // How analytics reaches Google:
  //   'gtag'  straight to GA4 with gtag.js, using GA4_ID.
  //   'gtm'   through Google Tag Manager, using GTM_ID. GA4 is then set up inside the
  //           container (analytics/gtm-container.json): switch only once that container
  //           is published, or nothing is recorded. Never run both, or visits count twice.
  var MODE = 'gtag';
  var GA4_ID = 'G-RNEDTE01W6';         // Google Analytics 4 measurement ID
  var GTM_ID = 'GTM-NTGV6HVQ';         // Google Tag Manager container ID
  var STORE = '37p-consent';           // 'granted' | 'denied'

  // In GTM mode every event parameter is cleared before each event, so a value from
  // one event (a verse topic, a search term) never carries over into the next.
  var EVENT_KEYS = ['verse_id', 'verse_number', 'verse_topic', 'block', 'search_term', 'results',
    'commentator', 'state', 'translation', 'tab_id', 'cta_id', 'link_url', 'form_id',
    'lead_type', 'meeting_format'];

  // EEA + UK + Switzerland: analytics waits for an explicit yes.
  var CONSENT_REGIONS = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE',
    'GR', 'HU', 'IS', 'IE', 'IT', 'LV', 'LI', 'LT', 'LU', 'MT', 'NL', 'NO', 'PL', 'PT', 'RO',
    'SK', 'SI', 'ES', 'SE', 'GB', 'CH'];

  /* ---- 1. consent defaults ---- */
  w.dataLayer = w.dataLayer || [];
  function gtag() { w.dataLayer.push(arguments); }
  w.gtag = w.gtag || gtag;

  gtag('consent', 'default', {
    ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
    analytics_storage: 'denied', region: CONSENT_REGIONS, wait_for_update: 500
  });
  gtag('consent', 'default', {
    ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
    analytics_storage: 'granted'
  });
  gtag('set', 'ads_data_redaction', true);

  var saved = null;
  try { saved = localStorage.getItem(STORE); } catch (e) {}
  if (saved === 'granted' || saved === 'denied') {
    gtag('consent', 'update', { analytics_storage: saved });
  }

  /* ---- 2. page context: sent with every event from this page ---- */
  var root = d.documentElement;
  var ctx = { page_type: root.getAttribute('data-page-type') || 'other' };
  if (root.getAttribute('data-verse')) ctx.verse_number = root.getAttribute('data-verse');
  if (MODE === 'gtm') w.dataLayer.push(ctx);
  else gtag('set', ctx);

  /* ---- 3. Google Analytics 4, directly or through Tag Manager ---- */
  function load(src) {
    var s = d.createElement('script');
    s.async = true;
    s.src = src;
    (d.head || d.documentElement).appendChild(s);
  }
  var live = false;
  if (location.protocol !== 'file:') {
    if (MODE === 'gtm' && /^GTM-[A-Z0-9]+$/.test(GTM_ID)) {
      live = true;
      w.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
      load('https://www.googletagmanager.com/gtm.js?id=' + GTM_ID);
    } else if (MODE === 'gtag' && /^G-[A-Z0-9]+$/.test(GA4_ID)) {
      live = true;
      load('https://www.googletagmanager.com/gtag/js?id=' + GA4_ID);
      gtag('js', new Date());
      gtag('config', GA4_ID);
    }
  }

  /* ---- 4. track() ---- */
  w.track = function (event, params) {
    if (!live) return;
    var o = {}, k, i;
    if (MODE === 'gtm') for (i = 0; i < EVENT_KEYS.length; i++) o[EVENT_KEYS[i]] = undefined;
    for (k in params) {
      if (Object.prototype.hasOwnProperty.call(params, k) && params[k] !== undefined) o[k] = params[k];
    }
    if (MODE === 'gtm') { o.event = event; w.dataLayer.push(o); }
    else gtag('event', event, o);
  };

  /* ---- 5. consent notice ---- */
  // Resolve links relative to this script, so the notice works from /verses/ too.
  var base = '';
  try { base = d.currentScript.src.replace(/assets\/analytics\.js.*$/, ''); } catch (e) {}

  function inConsentRegion() {
    var tz = '';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
    return /^Europe\//.test(tz)
      || /^Atlantic\/(Azores|Madeira|Canary|Reykjavik|Faroe)$/.test(tz)
      || tz === 'Arctic/Longyearbyen';
  }

  var bar = null;
  function hideNotice() { if (bar) bar.className = 'cc-bar'; }
  function choose(v) {
    try { localStorage.setItem(STORE, v); } catch (e) {}
    gtag('consent', 'update', { analytics_storage: v });
    hideNotice();
  }
  function showNotice() {
    if (!bar) {
      var css = d.createElement('style');
      css.textContent = ''
        + '.cc-bar{position:fixed;left:16px;right:16px;bottom:16px;z-index:1000;max-width:620px;margin:0 auto;'
        + 'background:#4A0F0F;color:#FAF5EC;border-top:3px solid #C8821A;box-shadow:0 8px 28px rgba(28,16,8,.28);'
        + 'padding:18px 22px;font-family:Lato,system-ui,sans-serif;font-size:13.5px;line-height:1.6;display:none}'
        + '.cc-bar.show{display:block}'
        + '.cc-bar p{margin:0 0 12px}'
        + '.cc-bar a{color:#E8A84A}'
        + '.cc-acts{display:flex;gap:10px;flex-wrap:wrap}'
        + '.cc-acts button{font:inherit;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;cursor:pointer;'
        + 'padding:9px 18px;border-radius:2px;border:1px solid #C8821A}'
        + '.cc-yes{background:#C8821A;color:#4A0F0F}'
        + '.cc-yes:hover{background:#E8A84A;border-color:#E8A84A}'
        + '.cc-no{background:none;color:#FAF5EC}'
        + '.cc-no:hover{border-color:#E8A84A;color:#E8A84A}'
        + '@media print{.cc-bar{display:none!important}}';
      d.head.appendChild(css);

      bar = d.createElement('div');
      bar.className = 'cc-bar';
      bar.setAttribute('role', 'region');
      bar.setAttribute('aria-label', 'Privacy choices');
      bar.innerHTML = '<p>May we use Google Analytics cookies to learn which verses and pages help study groups? '
        + 'No ads, and nothing is sold. <a href="' + base + 'privacy.html">Privacy</a></p>'
        + '<div class="cc-acts"><button type="button" class="cc-yes">Accept</button>'
        + '<button type="button" class="cc-no">No thanks</button></div>';
      bar.querySelector('.cc-yes').onclick = function () { choose('granted'); };
      bar.querySelector('.cc-no').onclick = function () { choose('denied'); };
      d.body.appendChild(bar);
    }
    bar.className = 'cc-bar show';
  }

  /* ---- site-wide clicks ---- */
  d.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var open = t.closest('[data-consent-open]');
    if (open) { e.preventDefault(); showNotice(); return; }
    var mail = t.closest('a[href^="mailto:"]');
    if (mail) { w.track('contact_email_click', { link_url: mail.getAttribute('href') }); return; }
    var cta = t.closest('[data-cta]');
    if (cta) w.track('cta_click', { cta_id: cta.getAttribute('data-cta'), link_url: cta.getAttribute('href') || undefined });
  });

  function onReady() {
    if (saved !== 'granted' && saved !== 'denied' && inConsentRegion()) showNotice();
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', onReady);
  else onReady();
})(window, document);
