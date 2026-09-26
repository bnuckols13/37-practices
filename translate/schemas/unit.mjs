import { z } from 'zod';

// Units are written by `segment` and never echoed back by the drafter.
export const Line = z.object({
  id: z.string(),
  group: z.string(),                       // couplet / heading / stanza this line belongs to
  role: z.enum(['heading', 'line', 'lacuna']),
  couplet: z.number().int().optional(),
  lang: z.string(),
  witness: z.string(),
  src: z.string(),
  translit: z.string(),
  refrain: z.boolean().optional(),
  bhanita: z.boolean().optional(),
  emended: z.array(z.object({ from: z.string(), to: z.string(), reason: z.string() })).optional(),
  note: z.string().optional(),
});

export const Segment = z.object({
  id: z.string(),
  anchor: z.string(),                      // unit id or group id the comment is about
  lang: z.string(),
  witness: z.string(),
  src: z.string(),
  translit: z.string(),
});

export const Unit = z.object({
  id: z.string(),
  n: z.number().int(),
  title: z.string().default(''),
  raga: z.string().default(''),
  poet: z.string().default(''),
  sourceSha: z.string(),
  witnesses: z.array(z.string()),
  lines: z.array(Line),
  commentary: z.array(Segment),
});

export const UnitsIndex = z.object({
  text: z.string(),
  units: z.array(z.object({
    id: z.string(), n: z.number().int(), raga: z.string(), poet: z.string(),
    witnesses: z.array(z.string()), lines: z.number().int(), segments: z.number().int(),
    sourceSha: z.string(),
  })),
  ids: z.array(z.string()),                // every live line/segment id, for vanish detection
  tombstones: z.array(z.string()),
});
