import { z } from 'zod';
import { Proposal } from './glossary.mjs';

// The one schema the drafter fills, in session mode (pack -> inbox -> ingest)
// and in API mode (output_config.format). Every field is required; use "" or [].
export const Flag = z.object({
  kind: z.enum(['reading', 'meaning', 'grammar', 'term', 'witness']),
  level: z.enum(['low', 'medium', 'high']),
  note: z.string(),
});

export const DraftLine = z.object({
  id: z.string().describe('the unit line id, same order as the input; lacunae are skipped'),
  translit: z.string().describe('your transliteration (IAST / Wylie); may correct the machine one'),
  gloss: z.string().describe('literal word-by-word gloss, " · "-separated'),
  en: z.string().describe('the translation, glossary terms wrapped as [surface]{term-id}'),
  terms: z.array(z.object({ id: z.string(), src: z.string() }))
    .describe('glossary terms in this line: term id and the source-script form it renders'),
  flags: z.array(Flag),
});

export const Note = z.object({
  anchor: z.string().describe('unit id, group id or line id the note is about'),
  kind: z.enum(['philology', 'imagery', 'doctrine', 'witness']),
  text: z.string(),
  cites: z.array(z.string()).describe('commentary segment ids this note relies on'),
});

export const Draft = z.object({
  unit: z.string(),
  title: z.string().describe('a short English title for the unit'),
  summary: z.string().describe('two or three sentences on what the unit says, image first'),
  lines: z.array(DraftLine),
  notes: z.array(Note),
  termsOmitted: z.array(z.object({ id: z.string(), line: z.string(), reason: z.string() })),
  proposals: z.array(Proposal),
  questions: z.array(z.string()),
});

// `terms` task: seed or extend the glossary from a unit.
export const TermsResult = z.object({
  unit: z.string(),
  proposals: z.array(Proposal),
  questions: z.array(z.string()),
});

// `terms-bo` task: the Tibetan word that renders each glossary term, read off the aligned Tibetan line.
export const TibetanTerms = z.object({
  unit: z.string(),
  equivalents: z.array(z.object({
    id: z.string().describe('the glossary entry id'),
    line: z.string().describe('the line or segment id whose Tibetan renders the term'),
    script: z.string().describe('the Tibetan word exactly as it stands in that Tibetan line, in Tibetan script, without a trailing tsheg or shad'),
    wylie: z.string().describe('the same word in Wylie'),
    lemma: z.string().describe('its dictionary form in Wylie, without case particles; "" if the same as wylie'),
    confidence: z.enum(['clear', 'likely']).describe('clear: the Tibetan word plainly renders the term; likely: probably, by position and sense'),
    note: z.string().describe('one sentence if the rendering is interesting (a gloss, an interpretation, a different reading), else ""'),
  })),
  questions: z.array(z.string()).describe('terms you could not match, and why'),
});
