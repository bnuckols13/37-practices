---
version: 1
---
# Task: draft

Draft the English translation of the unit in the input.

1. Read the whole unit, and the commentary segments on it if any are given, before writing a line.
2. For every non-lacuna line, in order, give: your transliteration, a literal word-by-word gloss (" · "-separated, one item per source word), and the translation with glossary markup.
3. For each glossary term you render, add `{id, src}` to the line's `terms` (src = the source-script form). The input lists the glossary hits detected in each line; each hit must either be marked in your English or listed in `termsOmitted` with the reason.
4. Notes: philology (a hard word, an emendation), imagery (what the image is, literally), doctrine (a reading, attributed and cited), witness (manuscript matters). Anchor each note to the line, couplet or unit it is about. A note that reports the commentator's reading must cite the segment id.
5. Propose glossary entries for recurring technical terms, persons (the poet, figures named in the song) and places that the glossary lacks. Definitions are your own words, 60 words or fewer. A symbolic reading goes in a proposal only when a commentary segment in the input states it; cite that segment id in `where`.
6. `title`: a short English title drawn from the song's main image. `summary`: two or three sentences, image first, then (attributed) how the commentary reads it.
7. Put questions for the reviewer in `questions`: rendering choices you want confirmed, readings you could not settle.
