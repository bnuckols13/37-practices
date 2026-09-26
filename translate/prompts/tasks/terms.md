---
version: 1
---
# Task: propose glossary entries

Read the unit and its commentary, and propose glossary entries for the terms a reader of the translation would need explained: technical and doctrinal terms, recurring images of the twilight language, persons (poets, deities, teachers), places and works. The input lists candidate words by frequency and the entries that already exist; do not re-propose existing ids (propose only genuinely new entries, or new source forms for an existing one using the same id).

For each proposal:

- `id`: a lowercase ascii slug (persons "p-…", places "pl-…", works "tx-…").
- `en`: the rendering translations should use, and `policy` (translate, keep-source, keep-source-first-gloss).
- `forms`: the source forms with transliteration, the attestation code (AS if attested in this source, with the passage id in `where`), and further languages only if you are sure of them.
- `match`: the source-script surface forms that should be recognised as this term in future units (include inflected forms you can see).
- `definition`: your own words, 60 words or fewer, neutral and plain.
- `symbolicImage` and `symbolicReadings`: only when a commentary segment in the input states the reading; cite the segment id in `where`. Otherwise leave them empty: an unattested reading does not go in the glossary.
- `forbiddenInLine`: esoteric referents that must never replace the image inside a verse line (for Ḍombī, for example, "selflessness").
- `rationale`: one sentence on why the term needs an entry and why this rendering.
