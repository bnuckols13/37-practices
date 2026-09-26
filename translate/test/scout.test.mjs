import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePlaceholder, parseSection, tohFromFilename, normToh, STATUS_GROUP } from '../scout/lib/catalog.mjs';
import { spellings, coreTitles, authorCandidates, mentionsAuthor, looksLikePerson, looksLikeWork } from '../scout/lib/wiki.mjs';
import { availability, graph, effortFactor, score } from '../scout/lib/score.mjs';

// Invented values in 84000's placeholder shape; not copied from their data.
const PLACEHOLDER = `<?xml version="1.0" encoding="UTF-8"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0"><teiHeader><fileDesc>
  <titleStmt>
    <title xml:lang="bo" type="mainTitle">ཚིག་བཅད།</title>
    <title xml:lang="Bo-Ltn" type="mainTitle">tshig bcad/</title>
    <title xml:lang="Sa-Ltn" type="mainTitle">Upa­deśa­nāma­gīti­kārikā</title>
    <title xml:lang="en" type="mainTitle">Verses of Advice called “Song”</title>
  </titleStmt>
  <publicationStmt><availability status="3"/><idno xml:id="UT0000-001-001"/></publicationStmt>
  <sourceDesc>
    <bibl key="toh9001" type="text">
      <ref>Toh 9001</ref>
      <biblScope>ff. 1b-3a</biblScope>
      <author xml:lang="Sa-Ltn">Exemplapāda (II)</author>
      <author role="translatorTib" xml:lang="Bo-Ltn">lo tsA ba dpe</author>
      <author role="translatorEng">A. Translator</author>
      <location work="UT0000" count-pages="4"><volume number="7" start-page="2" end-page="5"/></location>
      <idno parent-id="SEC-LEAF" work="http://read.84000.co/sections"/>
      <idno source-id="SEC-SRC" work="W0000"/>
    </bibl>
    <bibl key="toh9002" type="text"><ref>Toh 9002</ref></bibl>
    <link type="isCommentaryOf" target="toh9000"/>
  </sourceDesc>
</fileDesc></teiHeader><text><front/></text></TEI>`;

test('placeholder parsing', () => {
  const r = parsePlaceholder(PLACEHOLDER, 'x.xml');
  assert.deepEqual(r.toh, ['toh9001', 'toh9002']);
  assert.equal(r.status, '3');
  assert.equal(r.group, 'in-translation');
  assert.equal(r.titles.sa, 'Upadeśanāmagītikārikā', 'soft hyphens removed');
  assert.equal(r.titles.wylie, 'tshig bcad/');
  assert.deepEqual(r.authors, ['Exemplapāda (II)']);
  assert.deepEqual(r.translatorsTib, ['lo tsA ba dpe']);
  assert.deepEqual(r.translatorsEng, ['A. Translator']);
  assert.equal(r.pages, 4);
  assert.deepEqual(r.volumes, [7]);
  assert.equal(r.folios, 'ff. 1b-3a');
  assert.equal(r.sectionId, 'SEC-LEAF');
  assert.deepEqual(r.commentaryOf, ['toh9000']);
});

test('empty status means not started', () => {
  const r = parsePlaceholder(PLACEHOLDER.replace('status="3"', 'status=""'));
  assert.equal(r.status, '0');
  assert.equal(r.group, 'not-started');
  assert.equal(STATUS_GROUP('2.h'), 'translated');
  assert.equal(STATUS_GROUP('1.a'), 'published');
  assert.equal(STATUS_GROUP('4'), 'in-application');
});

test('section parsing', () => {
  const s = parseSection(`<TEI><teiHeader><fileDesc type="section"><titleStmt>
    <title type="mainTitle" xml:lang="en">general works</title></titleStmt>
    <publicationStmt><idno xml:id="SEC-LEAF"/></publicationStmt>
    <sourceDesc><bibl><idno parent-id="SEC-ROOT"/></bibl></sourceDesc></fileDesc></teiHeader></TEI>`);
  assert.deepEqual(s, { id: 'SEC-LEAF', label: 'General works', parent: 'SEC-ROOT' });
});

test('toh identifiers', () => {
  assert.deepEqual(tohFromFilename('052-034_toh2293-caryagitikosavritti.xml'), ['toh2293']);
  assert.deepEqual(tohFromFilename('034-005_toh17,489-the_principles.xml'), ['toh17', 'toh489']);
  assert.deepEqual(tohFromFilename('001-005_toh1-5-chapter_5_on_leather.xml'), ['toh1-5']);
  assert.deepEqual(tohFromFilename('207-057_toh4419a-note.xml'), ['toh4419a']);
  assert.equal(normToh('Toh 44'), 'toh44');
  assert.equal(normToh('toh168'), 'toh168');
});

test('name spellings reach Wikipedia forms', () => {
  assert.deepEqual(spellings('Śāntideva'), ['Śāntideva', 'Santideva', 'Shantideva']);
  assert.ok(spellings('Candrakīrti').includes('Chandrakirti'));
  assert.ok(spellings('Kṛṣṇa').includes('Krishna'));
  const c = authorCandidates('Atīśa Dīpaṃkaraśrījñāna');
  assert.ok(c.parts.includes('Atisa'));
  assert.deepEqual(authorCandidates('Saraha (II)').whole.slice(0, 1), ['Saraha']);
});

test('core titles split on nāma and drop kārikā', () => {
  const t = coreTitles('Prajñānāmamūlamadhyamakakārikā');
  assert.ok(t.includes('Mūlamadhyamakakārikā'));
  assert.ok(coreTitles('Yuktiṣaṣṭikākārikā').includes('Yuktiṣaṣṭikā'));
  assert.ok(coreTitles('Āryaprajñāpāramitāhṛdayaṭīkā').includes('Prajñāpāramitāhṛdayaṭīkā'));
  assert.deepEqual(coreTitles(''), []);
});

test('description and lead checks', () => {
  assert.ok(looksLikePerson('Indian Mahayana Buddhist philosopher'));
  assert.ok(!looksLikePerson('One of the earliest bodhisattvas of Mahayana Buddhism'));
  assert.ok(looksLikePerson('King of Ayodhya'), 'kings still pass; overrides.json catches the wrong ones');
  assert.ok(looksLikeWork('Mahayana Buddhist text'));
  assert.ok(!looksLikeWork('Genre of Buddhist poetry'));
  assert.ok(mentionsAuthor('The Bodhicharyavatara is a Mahayana text written by Shantideva.', ['Śāntideva']));
  assert.ok(!mentionsAuthor('The Tattvasiddhi is a treatise by Harivarman.', ['Śāntarakṣita']));
});

test('availability, commentary graph, effort', () => {
  const rec = (toh, group, commentaryOf = []) => ({ toh: [toh], group, commentaryOf, authors: [], titles: {}, section: [], canon: 'tengyur', pages: 10, label: toh });
  const records = [rec('toh1', 'not-started'), rec('toh2', 'not-started', ['toh1']), rec('toh3', 'in-translation', ['toh1']), rec('toh4', 'not-started')];
  const published = new Map([['toh4', {}]]);
  assert.equal(availability(records[0], published, new Set()), 'open');
  assert.equal(availability(records[2], published, new Set()), 'claimed');
  assert.equal(availability(records[3], published, new Set()), 'published');
  assert.equal(availability(records[0], published, new Set(['toh1'])), 'claimed', 'a TEI with content counts as claimed');
  const g = graph(records);
  assert.deepEqual([...g.commentaries[0]].sort(), [1, 2]);
  assert.deepEqual([...g.roots[1]], [0]);
  const bands = [{ maxPages: 6, factor: 1 }, { maxPages: 60, factor: 0.8 }, { maxPages: 99999, factor: 0.4 }];
  assert.equal(effortFactor(4, bands), 1);
  assert.equal(effortFactor(40, bands), 0.8);
  assert.equal(effortFactor(4000, bands), 0.4);
});

test('score: demand, gap and effort move the rank the right way', () => {
  const cfg = {
    weights: { author: 0.25, title: 0.3, commentaries: 0.2, reddit: 0.1, fit: 0.15 }, companionBoost: 0.6,
    gap: { lotsawa: 0.3, known: 0.25, openLibrary: 0.6, kangyur: 0.75 },
    effort: [{ maxPages: 6, factor: 1 }, { maxPages: 99999, factor: 0.5 }],
    fit: [{ tag: 'songs', weight: 1, match: 'gīti' }],
  };
  const r = (toh, extra = {}) => ({ toh: [toh], group: 'not-started', commentaryOf: [], authors: ['A'], titles: { sa: 'x' }, section: [], canon: 'tengyur', pages: 4, label: toh, ...extra });
  const recs = [r('t1'), r('t2'), r('t3', { pages: 300 }), r('t4', { titles: { sa: 'Dohāgīti' } })];
  const rows = recs.map((rec, i) => ({ i, r: rec, avail: 'open', author: { name: 'A', title: 'A', views: 50000, perText: 50000, texts: 1 } }));
  rows[1].elsewhere = [{ source: 'Lotsawa House', url: 'u' }];
  score(rows, graph(recs), cfg);
  assert.ok(rows[0].score > rows[1].score, 'a free translation elsewhere cuts the score');
  assert.ok(rows[0].score > rows[2].score, 'length cuts the score');
  assert.ok(rows[3].score > rows[0].score, 'fit raises it');
  assert.ok(rows[1].flags.some(f => /Lotsawa/.test(f)));
});
