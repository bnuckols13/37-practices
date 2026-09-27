# The sung version: carrying the song into English

> **Status:** built and tested. Sung drafts of songs 1, 10 and 14 are in `texts/charyapada/sung/`, unreviewed. How to run it is in [`README.md`](README.md#the-sung-version-the-song-sounded-in-english).

## Why

The Charyapada are songs. Each one names its rāga. Its couplets rhyme, half-line against half-line (song 10 rhymes or half-rhymes in all seven couplets: *kuṛiā / nāṛiā*, *kapālī / mālī*, *molāṇa / parāṇa*). One couplet is the refrain, and the manuscript's ধ্রু tells the singer to come back to it after every couplet that follows. In the last couplet the singer names himself. And the images are meant to startle: a Ḍom woman dancing on a lotus of sixty-four petals, a barren cow giving milk.

The engine's accurate English carries the meaning, line for line, and it has to stay plain and literal for the glossary and the commentary to work. So a reader gets what the songs *say*, but not what a listener gets: the rhyme closing each couplet, the refrain coming round again, the voice of the singer.

## What others have done (the short version)

Two briefs in [`research/`](research/) cover this with sources. What they add up to:

- **Some things survive translation by themselves.** Lowth found in 1753 that Hebrew poetry rhymes thoughts, not sounds: parallelism survives prose translation. The Charyapada's paradoxes and paired images are the same. Keep them exactly.
- **A refrain has to be kept identical.** The King James Bible renders the refrain of Psalm 136 the same way all twenty-six times. Robert Alter thinks it was sung back by the congregation. A refrain that varies stops being a refrain.
- **Count beats, not syllables.** The Grail Psalms (Gelineau, 1963) and Arthur Waley's Chinese (1918) kept the pulse of the original by giving each English line a fixed number of stresses and letting the rest fall where English puts them.
- **Don't explain the poem inside the poem.** Alter's "heresy of explanation" is the engine's rule already: the boat stays a boat.
- **Forcing the song into a tune costs more than it gives.** The Bay Psalm Book (1640) squeezed the psalms into hymn metres to fit known tunes, and none of its versions stayed in use.
- **Beauty cut loose from the source is the worst failure.** Coleman Barks's Rumi is loved, and much of Rumi's Islam disappeared from it. Every line must be traceable to the source.
- **Scholar and poet can be two passes.** *(Charyapada research: see `research/charyapada-sound.md`.)*

## The one idea: a second English with its own life

The sung version is a **second English beside the accurate one**. It is never a replacement, never blended into it, and never reviewed as part of it:

- **Its own pass.** `sing` drafts it from the accurate English, the source and a sound profile of the song. It can therefore never change the translation.
- **Its own review.** `review --sung` and `accept --sung` work on `<unit>.sung.md`. A song's meaning can be approved without its music, and the music can be redrafted without reopening the meaning.
- **Its own view.** In the Reading Room, Display › *As a song* swaps the sung lines in for the accurate ones. Everything else stays: the passage numbers, the glossary links, Munidatta in the margin.
- **Held to the source.** It must say what the accurate English says, keep every image, add none, never put a reading into a line, and never use a word the glossary forbids in a line. `ingest` and `check` enforce the mechanical parts. The reviewer judges the rest, helped by a `kept` / `let go` note on every couplet.

## What the engine does

| Piece | What it is |
|---|---|
| `lib/sound.mjs` | The **sound profile**: for each couplet, the word each half ends on, whether the two ends rhyme (full, near or none, judged on the transliteration with b/v, y/j, ṛ/ḍ, ṇ/n, dental/retroflex and vowel length folded together), a rough syllable count, and which couplet is the refrain and which names the poet. `node translate/cli.mjs sound charyapada 10` prints it. |
| `prompts/tasks/sing.md` | The rules, below. |
| `schemas/sung.mjs` | `voice`, `refrainCue`, one sung line per half-line, a `kept` and `letGo` note per couplet, `questions`. |
| `pack.mjs` | The `sing` pack: the accurate English (approved if current, else the draft) with its gloss and flags, the sound profile, and Munidatta's readings for sense and mood only. A redraft carries the previous version and the reviewer's notes. |
| `ingest.mjs`, `check.mjs` | Shape, refrain cue, glossary ids, forbidden words, and staleness (a sung version made from an older draft is flagged). Also the 8-word overlap guard: a singing English is where remembered phrasing from published translations would creep in. |
| `review/sung.mjs` | The sung review sheet: for each couplet the source, the rhyme it has, the accurate English (for reference), then the editable sung lines and notes. Accepting it writes `approved/<unit>.sung.json`, or notes for the next `sing`. |
| `render/` | Display › *As a song*: sung lines, a refrain cue after each later couplet, the source "as heard" with its rhyme marked, the singer's voice under the summary, and a sentence in the colophon on who approved the sung version. |

## The rules for the sung English

From `prompts/tasks/sing.md`, where each is spelled out:

1. **Same shape.** Line for half-line; the refrain in the same words every time; the poet's self-naming kept.
2. **Every image, none added, none explained.** Paradox stays paradox.
3. **The meaning stays the accurate English's meaning.** Where the translation flags two senses, the song may take either and must say which.
4. **Rhyme honestly or not at all.** Take a full rhyme, a slant rhyme or an echo when English offers one without bending the sense. Never add a word for the rhyme, and never invert the syntax for it. An unrhymed couplet says so in its `letGo`.
5. **A line to sing:** about four strong beats; the two halves close in length.
6. **Keep the sounds that carry the song:** the name that rings through it, the doubled word, the call ("hey, Ḍombī"), the refrain.
7. **Find the voice, name it, keep it.** Plain living English: no archaisms, no "O", no hymn diction.
8. **Say what you did:** `kept` and `letGo` on every couplet, so the reviewer can see each trade.

## Decisions for Lena

- **Whether to publish sung versions at all**, and under what name. The draft label is "As a song".
- **Who reviews them.** One option is you. Another is a second reader with an ear for song, the way Dimock worked with the poet Levertov. The review record already names whoever accepts the sheet.
- **The rhyme rule.** "Honestly or not at all" is proposed. The alternative is to allow looser rhymes and let the notes carry the trade.
- **Sound in the Reading Room.** A link per song to a recording, where a good one exists, of a Newar *caryā* singer or a modern Bengali setting. See the research brief for what exists.

## Next steps

1. Read the three sung drafts (`render charyapada --preview`, Display › *As a song*), then `review charyapada 1,10,14 --sung`.
2. A sung view in the Studio, so these can be reviewed there like everything else.
3. Sing as the songs are approved; the sung pack prefers the approved translation when there is one.
