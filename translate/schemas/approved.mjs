import { z } from 'zod';

export const RunProvenance = z.object({
  mode: z.enum(['session', 'api', 'batch']),
  model: z.string(),
  date: z.string(),
  packSha: z.string(),
  prompts: z.record(z.string(), z.number()),
  glossarySha: z.string(),
  sourceSha: z.string(),
});

// Written only by `accept`, after the reviewer has said ok to every section.
export const Approved = z.object({
  unit: z.string(),
  n: z.number().int(),
  title: z.string(),
  summary: z.string(),
  sourceSha: z.string(),
  lines: z.array(z.object({ id: z.string(), en: z.string(), gloss: z.string(), translit: z.string() })),
  notes: z.array(z.object({ anchor: z.string(), kind: z.string(), text: z.string(), cites: z.array(z.string()) })),
  commentary: z.array(z.object({
    id: z.string(), anchor: z.string(), translit: z.string(), translation: z.string(), note: z.string(),
    citations: z.array(z.object({ quoted: z.string(), work: z.string(), confident: z.boolean() })),
  })),
  provenance: z.object({
    draft: RunProvenance,
    weave: RunProvenance.nullable(),
    review: z.object({
      by: z.string(), date: z.string(), sheetSha: z.string(), draftSha: z.string(), weaveSha: z.string(),
      decisions: z.record(z.string(), z.enum(['ok', 'edited'])),
    }),
  }),
});
