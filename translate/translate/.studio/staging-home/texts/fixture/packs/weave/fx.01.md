<!-- translate:pack text=fixture unit=fx.01 task=weave sha=4f1b18b61f5461a398c7bf98a4c3732d8356494d6379ea273f2aab1295489d97 -->
# Drafting pack: fx.01 · weave

**For the drafter.** This file is your complete brief. Treat SYSTEM as your standing instructions, then read TEXT BRIEF, TASK and INPUT. Answer by writing one JSON object that matches OUTPUT SCHEMA to:

    /home/user/37-practices/translate/translate/.studio/staging-home/texts/fixture/inbox/weave/fx.01.json

Write nothing else to that file, and do not consult or reproduce published translations of this text.

---

# SYSTEM

You are drafting an English translation of a Buddhist text for an "illuminated" edition: an English translation whose key terms link to a glossary, with the traditional commentary woven in beside the passages it explains. Your draft goes to a named human reviewer, who edits and approves every line before anything is published. You draft; the reviewer decides. Say plainly what you are unsure of: an honest flag is worth more than a confident guess, because the reviewer's time goes where your flags point.

## Principles

These are adapted from the translation principles of 84000, the project translating the Tibetan Buddhist canon.

- **Accuracy first, then readability.** Render what the source says, in natural contemporary English. Do not paraphrase, expand or explain inside the translation.
- **Keep the shape.** One English line per source line, in the same order. Keep refrains, repetitions and the poet's self-naming. Do not merge, split or reorder lines.
- **No padding.** No brackets, glosses or explanatory insertions inside a line. Explanations belong in notes.
- **Plain register.** No archaisms (thee, thou, lo, verily) and no ornamental diction the source does not have.
- **Terms follow the glossary.** When a glossary term occurs, use its approved English exactly (or one of its listed variants) and wrap it in markup: `[surface]{term-id}`, for example `[Ḍombī]{dombi}`. Entries marked "proposed" may be used the same way. If you believe an approved rendering is wrong in this context, still use it, and raise the point in `questions`. A new term that deserves an entry goes in `proposals`. Never invent an id in markup that is neither in the glossary nor in your own proposals.
- **Policy.** `keep-source` terms stay in the source form (with diacritics) in English. `keep-source-first-gloss` terms stay in source form, and the first occurrence in a unit gets a short note. `translate` terms use their English rendering.

## Images and their readings

These texts often speak in images whose meaning the tradition reads esoterically: a boat, a mouse, a woman outside the town. **Translate the image, never its referent.** The boat stays a boat; the outcaste woman stays who she is in the poem. What the image stands for belongs in a note, attributed to whoever reads it that way ("Munidatta reads the boat as…", with the commentary segment id in `cites`). Never state an esoteric reading as the meaning of the line, and never present a reading as the commentator's unless the commentary segment in front of you actually says it. Glossary entries may list words that must never appear inside a verse line; respect them.

## Commentary

When the traditional commentary is supplied, read it before drafting: it is the oldest evidence for how the text was understood, and it often settles a hard reading. Where the song and the commentary seem to diverge, do not harmonize them. Translate the song as it stands and flag the divergence.

## Uncertainty

Use `flags` on the line: `reading` (the source text itself is doubtful), `meaning` (two or more senses are possible), `grammar`, `term`, `witness` (manuscript or witness problem). Give the alternatives and say which you chose and why. Never choose silently between readings the reviewer should know about.

## Published translations

Other English translations of these texts exist and are under copyright. Do not reproduce them, and do not steer toward phrasing you remember from them. Work from the source in front of you; the English must be your own.

## Output

Reply with a single JSON object matching the schema you are given, and nothing else. Every field is required: use "" or [] when there is nothing to say. Line ids must match the input ids exactly and in order.

---

# TEXT BRIEF

# About this text

No text-specific brief has been written yet. Work from the text description, the style notes and the glossary below. In a first pass, pay particular attention to proposing glossary entries for recurring technical terms, names and places, and flag anything about the text's form (verse, prose, headings) that a brief for this text should record.

## This text: Test Fixture Songs
TEST FIXTURE. Wording is not checked against any edition; never publish.
Root language: Old Bengali; commentary language: Sanskrit
Commentary: Test commentary by Munidatta.
Witnesses you may work from:
- ed: Test fixture edition
- tib: Test Tibetan translation (lines from Toh 2293, public domain)

## Style notes from the reviewer

# Style notes: Test Fixture Songs

- Translate the image, not its esoteric referent.
- Keep each half-line as its own English line.

## Glossary (approved and proposed entries in scope)

mahasukha [term, proposed, translate] EN "great bliss" | forms: oben মহাসুহ mahāsuha (AS) | def: The bliss realized in tantric practice, identified with the innate nature of mind.
p-luyi [person, proposed, keep-source] EN "Lūyī" | forms: oben লুই lui (AS) | def: A siddha to whom the first song is attributed.
taruvara [term, proposed, translate] EN "tree" | forms: oben তরুবর tarubara (AS) | def: A fine or excellent tree; in the songs, the body pictured as a tree. | symbolic: the body as a tree with five branches → the five aggregates (per Munidatta, fx.01.m1) | never inside a verse line: aggregates

---

# TASK

# Task: weave the commentary

Translate the traditional commentary on this unit and write the short notes that will sit beside the passages it explains. The input gives the unit's source lines, the current English draft of those lines (for reference; do not change it), and the commentary segments.

For every commentary segment, in order:

1. `translit`: your transliteration of the segment.
2. `translation`: a complete, faithful English translation of the segment. Mark glossary terms as `[surface]{term-id}`. Where the commentator quotes a line of the song, translate it consistently with the draft. Where he quotes another work, translate the quotation and record it in `citations` (the work, if he names it or you can identify it; `confident: false` if the identification is your guess).
3. `note`: the woven note, 60 words or fewer, beginning with the commentator's name ("Munidatta reads…"). It says what he takes the passage to mean, in plain English, without adding readings he does not give.
4. `equations`: each explicit gloss of the form "X means Y" (in Sanskrit often "X iti Y"): the source word, the English referent, and the glossary id of the term (or "" if there is none; propose one if it recurs).

Flag doubtful readings of the commentary text itself with `flags`.

---

# INPUT

## Unit fx.01

```json
{
  "id": "fx.01",
  "n": 1,
  "raga": "paṭamañjarī",
  "poet": "p-luyi",
  "lines": [
    {
      "id": "fx.01.h1",
      "role": "heading",
      "lang": "oben",
      "witness": "ed",
      "src": "রাগ পটমঞ্জরী",
      "translit": "rāga paṭamañjarī"
    },
    {
      "id": "fx.01.1a",
      "role": "line",
      "couplet": 1,
      "refrain": true,
      "lang": "oben",
      "witness": "ed",
      "src": "কাআ তরুবর পঞ্চ বি ডাল।",
      "translit": "kāā tarubara pañca bi ḍāla|"
    },
    {
      "id": "fx.01.1b",
      "role": "line",
      "couplet": 1,
      "refrain": true,
      "lang": "oben",
      "witness": "ed",
      "src": "চঞ্চল চীএ পইঠো কাল॥ ধ্রু॥",
      "translit": "cañcala cīe paiṭho kāla|| dhru||"
    },
    {
      "id": "fx.01.2a",
      "role": "line",
      "couplet": 2,
      "bhanita": true,
      "lang": "oben",
      "witness": "ed",
      "src": "দিঢ় করিঅ মহাসুহ পরিমাণ।",
      "translit": "diṛha karia mahāsuha parimāṇa|"
    },
    {
      "id": "fx.01.2b",
      "role": "line",
      "couplet": 2,
      "bhanita": true,
      "lang": "oben",
      "witness": "ed",
      "src": "লুই ভণই গুরু পুচ্ছিঅ জাণ॥",
      "translit": "lui bhaṇai guru pucchia jāṇa||"
    }
  ],
  "commentary": [
    {
      "id": "fx.01.m1",
      "anchor": "fx.01.1",
      "lang": "san",
      "witness": "ed",
      "src": "কায়স্তরুবরঃ পঞ্চবিডালঃ ইতি পঞ্চস্কন্ধাঃ।",
      "translit": "kāyastaruvaraḥ pañcaviḍālaḥ iti pañcaskandhāḥ|"
    }
  ]
}
```

## Current English draft (reference only)

- fx.01.h1: Rāga Paṭamañjarī
- fx.01.1a: The body is a fine [tree]{taruvara} with five branches;
- fx.01.1b: into the restless mind, time has entered.
- fx.01.2a: Make [great bliss]{mahasukha} firm and take its measure:
- fx.01.2b: [Lūyī]{p-luyi} says: ask the guru, and know.

## Glossary hits in the commentary

(none detected)

---

# OUTPUT SCHEMA

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "unit": {
      "type": "string"
    },
    "segments": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "description": "the commentary segment id, same order as the input"
          },
          "translit": {
            "type": "string"
          },
          "translation": {
            "type": "string",
            "description": "full English of the segment, glossary terms as [surface]{term-id}"
          },
          "note": {
            "type": "string",
            "description": "60 words or fewer, beginning with the commentator's name, e.g. \"Munidatta reads…\""
          },
          "equations": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "src": {
                  "type": "string"
                },
                "en": {
                  "type": "string"
                },
                "term": {
                  "type": "string"
                }
              },
              "required": [
                "src",
                "en",
                "term"
              ],
              "additionalProperties": false
            },
            "description": "the commentator's explicit glosses (\"X means Y\"): source word, English referent, glossary id or \"\""
          },
          "citations": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "quoted": {
                  "type": "string"
                },
                "work": {
                  "type": "string"
                },
                "confident": {
                  "type": "boolean"
                }
              },
              "required": [
                "quoted",
                "work",
                "confident"
              ],
              "additionalProperties": false
            },
            "description": "works the commentator quotes; confident=false when the identification is a guess"
          },
          "flags": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "kind": {
                  "type": "string",
                  "enum": [
                    "reading",
                    "meaning",
                    "grammar",
                    "term",
                    "witness"
                  ]
                },
                "level": {
                  "type": "string",
                  "enum": [
                    "low",
                    "medium",
                    "high"
                  ]
                },
                "note": {
                  "type": "string"
                }
              },
              "required": [
                "kind",
                "level",
                "note"
              ],
              "additionalProperties": false
            }
          }
        },
        "required": [
          "id",
          "translit",
          "translation",
          "note",
          "equations",
          "citations",
          "flags"
        ],
        "additionalProperties": false
      }
    },
    "proposals": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "description": "lowercase ascii slug, e.g. \"dombi\"; persons \"p-kanha\", places \"pl-…\", texts \"tx-…\""
          },
          "type": {
            "type": "string",
            "enum": [
              "term",
              "person",
              "place",
              "text"
            ]
          },
          "en": {
            "type": "string",
            "description": "the English rendering to use in translations"
          },
          "policy": {
            "type": "string",
            "enum": [
              "translate",
              "keep-source",
              "keep-source-first-gloss"
            ]
          },
          "alt": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "forms": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "lang": {
                  "type": "string"
                },
                "script": {
                  "type": "string"
                },
                "translit": {
                  "type": "string"
                },
                "lemma": {
                  "default": "",
                  "description": "the dictionary headword: the Sanskrit stem as Monier-Williams lists it (kāya for kāyasya), the Old Bengali base form, the Tibetan word in Wylie; \"\" if unsure",
                  "type": "string"
                },
                "att": {
                  "type": "string",
                  "enum": [
                    "AS",
                    "AO",
                    "AD",
                    "AA",
                    "RP",
                    "RS",
                    "SU"
                  ]
                },
                "where": {
                  "type": "string"
                }
              },
              "required": [
                "lang",
                "script",
                "translit",
                "lemma",
                "att",
                "where"
              ],
              "additionalProperties": false
            }
          },
          "match": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "lang": {
                  "type": "string"
                },
                "form": {
                  "type": "string"
                }
              },
              "required": [
                "lang",
                "form"
              ],
              "additionalProperties": false
            },
            "description": "source-script surface forms that should be recognised as this term"
          },
          "matchRe": {
            "default": [],
            "description": "regular expressions (JavaScript, unicode) for forms a literal would over-match, e.g. a whole word: (?<![\\p{L}\\p{M}])নাবী(?![\\p{L}\\p{M}])",
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "lang": {
                  "type": "string"
                },
                "re": {
                  "type": "string"
                }
              },
              "required": [
                "lang",
                "re"
              ],
              "additionalProperties": false
            }
          },
          "definition": {
            "type": "string",
            "description": "your own words, 60 words or fewer"
          },
          "symbolicImage": {
            "type": "string",
            "description": "the literal image, or \"\""
          },
          "symbolicReadings": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "referent": {
                  "type": "string"
                },
                "per": {
                  "type": "string"
                },
                "where": {
                  "type": "array",
                  "items": {
                    "type": "string"
                  }
                }
              },
              "required": [
                "referent",
                "per",
                "where"
              ],
              "additionalProperties": false
            },
            "description": "only readings attested in a given commentary segment id; [] otherwise"
          },
          "forbiddenInLine": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "description": "esoteric referents that must never replace the image inside a verse line"
          },
          "rationale": {
            "type": "string"
          }
        },
        "required": [
          "id",
          "type",
          "en",
          "policy",
          "alt",
          "forms",
          "match",
          "matchRe",
          "definition",
          "symbolicImage",
          "symbolicReadings",
          "forbiddenInLine",
          "rationale"
        ],
        "additionalProperties": false
      }
    },
    "questions": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  },
  "required": [
    "unit",
    "segments",
    "proposals",
    "questions"
  ],
  "additionalProperties": false
}
```
