---
version: 4
---
# Task: propose glossary entries

Read the unit and its commentary, and propose glossary entries for the terms a reader of the translation would need explained: technical and doctrinal terms, recurring images of the twilight language, persons (poets, deities, teachers), places and works. The input lists candidate words by frequency and the entries that already exist; do not re-propose existing ids (propose only genuinely new entries, or new source forms for an existing one using the same id).

For each proposal:

- `id`: a lowercase ascii slug (persons "p-…", places "pl-…", works "tx-…").
- `en`: the rendering translations should use, and `policy` (translate, keep-source, keep-source-first-gloss).
- `forms`: the source forms with transliteration, the attestation code and further languages only if you are sure of them. Codes: AS attested in this source (give the passage id in `where`); AO attested in other manuscripts; AD attested in dictionaries; AA approximate; RP reconstructed phonetically; RS reconstructed semantically; SU source unspecified. For a form you can see in the input, AS is right. Give each form's `lemma`, its dictionary headword (the Sanskrit stem as Monier-Williams lists it, e.g. kāya for kāyasya; the Old Bengali base form; Tibetan in Wylie), so the reviewer can look it up; leave it empty if unsure.
- `match`: the source-script surface forms that should be recognised as this term in future units (include inflected forms you can see). A form is found wherever it stands, inside longer words too, and the longest term wins where two overlap.
- `matchRe`: for a form a literal would over-match (a short word that also sits inside other words), `{lang, re}` with a JavaScript regular expression instead, e.g. the whole word নাবী: `(?<![\p{L}\p{M}])নাবী(?![\p{L}\p{M}])`; or `[]`.
- `definition`: your own words, 60 words or fewer, neutral and plain.
- `symbolicImage` and `symbolicReadings`: only when a commentary segment in the input states the reading; cite the segment id in `where`. Otherwise leave them empty: an unattested reading does not go in the glossary.
- `forbiddenInLine`: esoteric referents that must never replace the image inside a verse line (for Ḍombī, for example, "selflessness").
- `rationale`: one sentence on why the term needs an entry and why this rendering.
