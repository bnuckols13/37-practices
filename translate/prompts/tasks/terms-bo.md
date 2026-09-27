---
version: 2
---
# Task: Tibetan equivalents for glossary terms

The unit's lines and commentary segments carry `parallel`: the same passage in the Tibetan translation, aligned by id. The input lists, for each line or segment that has Tibetan, the glossary terms found in the Bengali or Sanskrit, with the Tibetan beside them.

For each term, find the Tibetan word or phrase that renders it in the aligned Tibetan, and give:

- `id`: the glossary entry id; `line`: the line or segment id where you read it.
- `script`: the word exactly as it stands in that Tibetan text, in Tibetan script, without a trailing tsheg or shad. It must be a substring of that id's Tibetan: the answer is checked, and a word that is not there is refused.
- `wylie`: the same in Wylie; `lemma`: its dictionary form in Wylie (without case particles such as gi, la, na, kyis), or "" if the same.
- `confidence`: clear, when the Tibetan word plainly renders the term (ljon shing for taru, "tree"); likely, when position and sense point to it but the line is rephrased. A clear equivalent is searched for across the whole Tibetan text and every occurrence counts as this term, so a common word with other uses (lam "path", yid "mind", rang bzhin "nature", a syllable such as rkang that sits inside other words) is "likely" even where it renders the term here. When you cannot match a term, leave it out and say why in `questions`.
- `note`: one sentence when the Tibetan reads the term in a way worth knowing (it glosses the image, reads a different word, or interprets it), else "".

Give one equivalent per term and line. Prefer verse lines; use commentary segments for terms that occur only there, or when Munidatta's Tibetan shows a standard equivalent (bdag med ma for nairātmā). A term the input marks as already matched in the Tibetan needs no answer unless the Tibetan uses a different word here.

Work only from the input. Do not use dictionaries' glosses as if they were the text: the question is which word this translation used.
