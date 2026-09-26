---
version: 1
---
# Task: weave the commentary

Translate the traditional commentary on this unit and write the short notes that will sit beside the passages it explains. The input gives the unit's source lines, the current English draft of those lines (for reference; do not change it), and the commentary segments.

For every commentary segment, in order:

1. `translit`: your transliteration of the segment.
2. `translation`: a complete, faithful English translation of the segment. Mark glossary terms as `[surface]{term-id}`. Where the commentator quotes a line of the song, translate it consistently with the draft. Where he quotes another work, translate the quotation and record it in `citations` (the work, if he names it or you can identify it; `confident: false` if the identification is your guess).
3. `note`: the woven note, 60 words or fewer, beginning with the commentator's name ("Munidatta reads…"). It says what he takes the passage to mean, in plain English, without adding readings he does not give.
4. `equations`: each explicit gloss of the form "X means Y" (in Sanskrit often "X iti Y"): the source word, the English referent, and the glossary id of the term (or "" if there is none; propose one if it recurs).

Flag doubtful readings of the commentary text itself with `flags`.
