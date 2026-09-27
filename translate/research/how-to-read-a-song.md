# How to read a song before singing it in English

What Timothy Morton's course *How to Read a Poem* (UC Davis; the seven-lecture
notes and the "How to Read Any Poem Anywhere" guide) gives this edition, and
where each idea now lives in the engine. The course reads English poems; the
point here is to turn its tools on the caryā songs and on our own Englishes, so
that a translation carries how the song *works*, not only what it says.

## 1. The method: read out, not in

Morton's order is fixed: **Structure → Texture → Perception → Narrator →
Narrative**. The architecture first, then the feel of it in the mouth, then
what it makes you see, then who is speaking, and only last what happens. His
first rule is "slow the F down": no interpretation until the form has been
described. His second is "no symbolism": read what the poem does *out* of it,
never read a meaning *into* it.

This edition already keeps that rule in its own terms. The commentary's
readings (the boat is the central channel, Ḍombī is the purified mind) live in
the notes, never inside a line. Morton gives the reason: a symbol read into the
line kills what the line does on its own. So the translator's first job is the
same as the reader's: describe the song as a made thing before deciding what
it means.

`node translate/cli.mjs read charyapada 14` prints the five steps for a song,
with everything that can be measured measured.

## 2. Hot and cool: the one spectrum

Every channel of a poem sits somewhere between two poles:

- **hot**: repetition, consistency, pattern: the drum machine, "four to the
  floor", the mantra. Pushed to the end, it is death: all the same.
- **cool**: variation, inconsistency, surprise: Stockhausen, speech, a
  line that trips. Pushed to the end, it is noise: nothing holds.

A poem's effect is the **conversation between channels**, like faders on a
mixing board: hot lineation with cool syntax (Williams), hot rhythm with hot
rhyme (Blake's "Tyger": "extra heat"). Contrasts are a pleasure of their own
(Morton's **Baked Alaska**: hot meringue on cold ice cream). And the right
heat is the one that *whelms* you, neither under- nor overwhelms.

**For translation this becomes one rule: temperature matching.** Read the
source's board channel by channel, then set the English's: match each channel,
or trade one channel for another knowingly (a lost rhyme paid back with a name
struck three times) and say so. The engine now measures four channels for the
source and for any English of it (`lib/reading.mjs`), and says where an English
runs cooler than its song.

## 3. The channels, and what each means for a caryā

### Structure: the architecture

**Lineation.** The caryā is made of couplets; each closes on a double daṇḍa (॥),
and after each one the manuscript writes ধ্রু (*dhru*): sing the refrain again.
A refrain that comes round after every couplet is the hottest lineation there
is. An English that drops the refrain, or lets its lines run on, cools the song.

**Syntax.** Morton's atom of meaning is the **phrase**, not the word; syntax is
how phrases touch. Side by side (parataxis: *and … and*, a comma, a colon, a
command) runs hot: "I went to the store and I was hungry and I bought too
much." Hung one under another (hypotaxis: *when*, *because*, *which*) runs cool
and thinks. The caryās are paratactic: images and commands laid side by side,
with only a few participles ("having climbed", "having tied") hung under. Blake's
"The Lamb" is Morton's example of what hot parataxis does: a child's voice,
"a child with a bomb", innocence that is also a dare. The English should keep
the caryā's side-by-side-ness and resist explaining with *because*.

### Texture: the song in the mouth

Morton: rhythm is **line**, rhyme is **colour**. Texture is the "mouth feel"
of a poem, felt in time before it is understood. It has to be *read aloud*,
with the body; no one can scan silently.

**Rhythm.** English counts **stresses**, not syllables (it is a creole, with no
Academy to keep syllables in order); "five syllables is not pentameter; five
stresses is". Old Bengali, like Sanskrit and Apabhraṃśa, counts **mātrās**
(weights: a long vowel two, a short one). The method is the same for both:
**find the groove, then the deviations.** Four beats is the English lyric's
home ("four to the floor"; Blake's tetrameter; the ballad), five is the
thinking metre, seven the prophetic. A line that ends on a stress, missing its
last weak beat (catalectic: "Tyger, Tyger, burning *bright*"), closes with more
force than a full one.

A deviation is where form becomes meaning. In song 1 every half-line weighs
about fifteen mātrās, except one: *eṛieu chāndaka bāndha karaṇaka pāṭera āsa*,
about twenty-five, the line that says to let go of the bonds of *chanda*: of
metre (or of desire; the word means both, and the accurate English chose
metre). The line that tells you to drop the metre breaks it. An English that
keeps that line inside its groove has lost something no dictionary would show.

**Rhyme: the solar system.** Morton arranges every chime of sound as a galaxy
around a sun, hottest at the centre:

| planet | what chimes | heat | example |
|---|---|---|---|
| **absolute** (the sun) | the same word again: mantra, refrain | hottest | *Ḍombī … Ḍombī*; "Om mani…" |
| **perfect** (Mercury, Venus) | the same vowel and everything after it | hot | parimāṇa / jāṇa; bright / night |
| **vowel** (Earth, Mars) | the same vowel, other consonants | warm | sāṅga / lāga; sun / bundle |
| **off** (Jupiter, Saturn) | the consonants hold, the vowel shifts | mild | pulindā / chandā; love / move |
| **para** (the Oort cloud) | the whole consonant frame kept, the vowel changed | cold, uncanny | hall / hell (Wilfred Owen) |
| **alliteration** (outside the system) | only the first sounds | barely warm | |

Para rhyme is a sonic weapon: Owen used it for the trenches because the
overtones make the flesh creep. That is a colour for the caryās' cremation
grounds and threats, where perfect rhyme would sound too comfortable.

The engine places every couplet of the source and of each English on this
map. What it shows about our first sung drafts is the plainest diagnosis of why
they felt flat:

| song | source rhyme | sung draft rhyme | what the source strikes again |
|---|---|---|---|
| 1, Lūyī | warm (4 of 5 couplets; three perfect) | mild (4 of 5, but loosely, and not the refrain) | "Lūyī says", twice |
| 10, Kāṇha | **hot** (7 of 7; five perfect) | mild (3 of 7) | Ḍombī, nine times |
| 14, Ḍombīpāda | warm (3 of 5) | mild (1 of 5) | row, Ḍombī, across (*bāhatu*, *ḍombī*, *pāra*) |

Song 10 is one of the hottest poems a translator will meet: every couplet
rhymes and the woman's name comes down like a drumbeat nine times. An English
at half that heat is a different song, however exact its words.

Rhyme scheme is also thought. An Italian sonnet thinks smoothly and then turns;
an English sonnet goes "thinking, thinking, thinking, oh, whoops!" and trips on
its couplet. The caryā's scheme is couplet after couplet with the refrain
between: a circling, a return, a trance.

### Perception: what it makes you see

The images in order, and what they force on the body before any meaning:
Morton's "sensory forcing". Song 14 shows two rivers, a boat, a girl plunged in
the water, five oars, a sky-scoop, the moon and the sun as wheels, a chariot
that sinks. Keep the order. Keep the strange things strange (the sky-scoop, the
pulinda): a riddle solved in the line is a riddle lost. `read` lists the song's
marked things and names in the order the accurate English meets them.

### Narrator: who sings, to whom

Every caryā has a **bhaṇitā**: the poet names himself ("Lūyī says…"), stepping
outside his song to sign it, speaking of himself in the third person. Many
call to someone (*ālo*, *hālo*, *lo*: "hey", "you there") and many command.
Decide whose voice it is and how close the singer stands; an English "O
Ḍombī" puts a pulpit between them. Morton adds a stranger idea: a poem is "the
enjoyment of the other", an alien entity that seizes your breath and jaw; to
read it is to coexist with someone else's pleasure. The translator's version of
that courtesy is not to tame the singer.

### Narrative: how it moves, where it turns

The smallest story is a turn "from A to not-A" (the sonnet's volta). Genre is a
**horizon of expectation**: a listener to a caryā expects a riddle, a refrain, a
signature at the end. Where a song turns (song 10 swings from courting Ḍombī to
"I will kill Ḍombī") the English must turn at the same place and as hard.

## 4. Learning by making: Morton's exercises, for a translator

Morton teaches form by **manipulation**: change one thing and feel what changes.
Each exercise is also a way to draft.

1. **Make it hotter; make it cooler.** Write the couplet twice: once with more
   repetition and pattern (rhyme it, even the beats, strike the name again),
   once with less (let the lines run on, hang a clause under another). Keep the
   one nearer the source's heat, or the trade you mean. The Workshop's Hotter
   and Cooler buttons do this for a whole version.
2. **Verse into prose and back.** Write the couplet as a prose sentence, then
   break it into lines two different ways. The lines you keep are an argument
   about where the breath goes.
3. **Twinkle, twinkle, little bat.** Replace the words and keep the rhythm
   (Lewis Carroll's trick; Morton's "four beans have jumped"): nonsense words on
   the source's beat show you the groove the English has to find.
4. **The blank sheet.** Before reading the English at all, look at the Bengali
   on the page: its length, its repetitions, the ধ্রু marks. That shape is the
   first thing to keep.
5. **Read aloud, with the body.** Morton counts stresses by saying the line in an
   exaggerated voice (and in a robot's flat voice, to hear what is missing). The
   sing prompt says it plainly: say each line at the pace of a song before
   keeping it.

## 5. Where this now lives

- `lib/english.mjs`: the English ear (CMU Pronouncing Dictionary): stresses,
  the solar system of rhyme, parataxis against hypotaxis.
- `lib/reading.mjs`: the source's board (mātrās, groove and deviation, rhyme
  planets, words struck again) and any English's; the two compared.
- `read <text> [units] [--en accurate,sung]`: the five steps, printed.
- `sing` packs carry the source's board; `prompts/tasks/sing.md` (version 4)
  asks the drafter to hear the song first and match its temperature.
- `ingest --task sing`, sung review sheets (lines marked **HEAT**) and `check`
  say where a sung version runs cooler than its song. Advice, never a refusal:
  the reviewer weighs it.
- The Workshop page: the source's board as faders, each English's board live
  as you write, and Hotter and Cooler as tools.

Every figure is an estimate for the ear to check. Stress is relative, rhyme is
heard not spelled, and the mātrā count is the written weight, not the sung one.
The board is for listening better, not for scoring.
