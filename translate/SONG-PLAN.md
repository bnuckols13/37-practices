# The sung version: carrying the song into English

> **Status:** built and tested. Sung drafts of songs 1, 10 and 14 are in `texts/charyapada/sung/`, unreviewed. How to run it is in [`README.md`](README.md#the-sung-version-the-song-sounded-in-english).

## Why

The Charyapada are songs. Each one names its rāga. Its couplets rhyme, half-line against half-line (song 10 rhymes or half-rhymes in all seven couplets: *kuṛiā / nāṛiā*, *kapālī / mālī*, *molāṇa / parāṇa*). One couplet is the refrain, and the manuscript's ধ্রু tells the singer to come back to it after every couplet that follows. In the last couplet the singer names himself. And the images are meant to startle: a Ḍom woman dancing on a lotus of sixty-four petals, a barren cow giving milk.

The engine's accurate English carries the meaning, line for line, and it has to stay plain and literal for the glossary and the commentary to work. So a reader gets what the songs *say*, but not what a listener gets: the rhyme closing each couplet, the refrain coming round again, the voice of the singer.

## What the songs sound like, and what others have done

Two research briefs cover this with sources and verification marks: [`research/charyapada-sound.md`](research/charyapada-sound.md) (the Charyapada, and Indian devotional song in English) and [`research/precedents-song-translation.md`](research/precedents-song-translation.md) (the Psalms, translation theory, oral song). What they add up to:

**The songs**
- **A four-beat half-line.** Nilratan Sen's edition (1977) counts 35 of the 47 surviving songs in the 16-mora *pādākulaka*, four groups of four: *kāā | tarubara ‖ pañca bi | ḍāla*. He also says the rules "were very much flexible". So the English equivalent is a loose four-stress line, not a syllable count.
- **Rhymed couplets, loosely rhymed.** Every song is in rhymed couplets, and Sen notes the rhymes "are not always satisfactory". These are the oldest rhymes in Bengali, carried over from Apabhraṃśa song. The engine's sound profile agrees: song 10 rhymes or half-rhymes in all seven couplets, song 14 in three of five.
- **The refrain is the second couplet.** The manuscript marks *dhru* after the couplets. Munidatta, Nilratan Sen and Sukumar Sen all take the second couplet as the refrain. Singing it again after each couplet is the historian Niharranjan Ray's account of the custom, an inference and not an eyewitness record. The Reading Room says so.
- **The poet signs the song.** "Lūyī says…" normally comes in the last couplet. Following Lūyī's model, the name often appears in the refrain couplet too.
- **Rāgas are names, not tunes.** No tāla is given and many of the rāgas are obsolete. Recordings made in Nepal show the tunes drifting toward classical forms, and the modern Paṭamañjarī is a later rāga. The rāga is therefore a heading and a mood, never a melody we could restore.
- **The songs are still sung.** Newar Vajrācārya priests sing *caryā* songs with cymbals and drum, and Widdess argues this is a living continuation. In Dhaka the Bhābānagar Foundation has sung the Charyapada every week for years, with Baul singers and folk tunes.

**The translators**
- **Scholar and poet as two passes.** Dimock sent Levertov rough translations, and she made the poems (*In Praise of Krishna*, 1967). The engine's two layers follow the same division.
- **A ladder from sound to song.** Hess and Singh's *Bijak of Kabir* works a song through four rungs: transliteration, word-by-word gloss, literal version, finished poem. The engine now has all four: the Study view, the accurate English, and the sung version.
- **Half-rhyme before distortion.** Radice uses half-rhyme for Tagore "as it leads to fewer distortions of meaning for the sake of form". Jackson refused rhyme altogether for the siddhas' dohās. "Rhyme honestly or not at all" sits between the two.
- **Structural mimicry.** Ramanujan maps the original "onto the soundlook of modern English" by keeping its parallelisms, repetitions and line shapes.
- **Keep the absurd surface.** Dasgupta says the songs' images, read literally, "yield the most absurd meaning", and Hess says that is part of their function. Decoding belongs in the commentary, never in the line.
- **Low words for high truth.** Kværne speaks of "the highest truth in the lowest terms". Schelling says Tagore's biblical English "didn't sing". So: plain, bodily, present-day English.
- **Fixed terms across the layers.** Jackson renders *citta* as "mind" every time, and Hess varies only ordinary words for rhythm. Doctrinal terms therefore keep their glossary English in the sung version too.
- **Two warnings.** Mehrotra "threw a lot out" of Kabir: a singer's licence, and wrong for an edition. Bly made his Kabir out of Tagore's English: never make versions of versions. The sung pack works from the source and the accurate English, and nothing may be dropped.
- **From the Psalms.** A refrain has to be identical every time (Psalm 136 in the King James Bible). Beats, not syllables (the Grail Psalms, Waley). No explanation inside the poem (Alter). Forcing a familiar metre fails (the Bay Psalm Book). Beauty cut loose from the source fails too (Barks's Rumi).

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
5. **Sing shorter:** about four strong beats, like the four-mora groups of the *pādākulaka*; the two halves close in length. The engine flags any line left identical to the accurate English, and any line over about 13 syllables.
6. **Keep the sounds that carry the song:** the name that rings through it, the doubled word, the call ("hey, Ḍombī"), the refrain.
7. **Find the voice, name it, keep it.** Plain living English: no archaisms, no "O", no hymn diction.
8. **Fixed terms.** Doctrinal terms keep their glossary English; only everyday words may vary for rhythm.
9. **Say what you did:** `kept` and `letGo` on every couplet, so the reviewer can see each trade.

**What the first round taught.** The first sung drafts (prompt v1) were the accurate English with its words contracted: 8 of 34 lines unchanged, and only 7% shorter overall. Prompt v2 says outright that a sung version is not that, asks the drafter to sing shorter, and the engine now flags literal and overlong lines. The rules on meaning and images did not move.

## Decisions for Lena

- **Whether to publish sung versions at all**, and under what name. The draft label is "As a song".
- **Who reviews them.** One option is you. Another is a second reader with an ear for song, the way Dimock worked with the poet Levertov. The review record already names whoever accepts the sheet.
- **The rhyme rule.** "Honestly or not at all" is proposed. The alternative is to allow looser rhymes and let the notes carry the trade.
- **Living voices in the Reading Room.** A link per song to a performance, where a good one exists, presented as a living interpretation and not a reconstruction: the Bhābānagar singers in Dhaka, Newar *caryā*. The brief lists verified recordings of songs 1 and 26.
- **Before printing claims about performance:** read Widdess (1992, 2004) in full. Nilratan Sen says some of these very songs were recorded in Nepal; that needs confirming first.

## Next steps

1. Read the three sung drafts (`render charyapada --preview`, Display › *As a song*), then `review charyapada 1,10,14 --sung`.
2. A sung view in the Studio, so these can be reviewed there like everything else.
3. Sing as the songs are approved; the sung pack prefers the approved translation when there is one.
