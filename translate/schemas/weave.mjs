import { z } from 'zod';
import { Proposal } from './glossary.mjs';
import { Flag } from './draft.mjs';

// The commentary pass: every segment of the traditional commentary gets a
// full translation and a short woven note shown beside the passage it reads.
export const WeaveSegment = z.object({
  id: z.string().describe('the commentary segment id, same order as the input'),
  translit: z.string(),
  translation: z.string().describe('full English of the segment, glossary terms as [surface]{term-id}'),
  note: z.string().describe('60 words or fewer, beginning with the commentator\'s name, e.g. "Munidatta reads…"'),
  equations: z.array(z.object({ src: z.string(), en: z.string(), term: z.string() }))
    .describe('the commentator\'s explicit glosses ("X means Y"): source word, English referent, glossary id or ""'),
  citations: z.array(z.object({ quoted: z.string(), work: z.string(), confident: z.boolean() }))
    .describe('works the commentator quotes; confident=false when the identification is a guess'),
  flags: z.array(Flag),
});

export const Weave = z.object({
  unit: z.string(),
  segments: z.array(WeaveSegment),
  proposals: z.array(Proposal),
  questions: z.array(z.string()),
});
