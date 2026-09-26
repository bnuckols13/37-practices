import { z } from 'zod';

// Documents in the Studio's database. Claude writes meta, units, glossary and
// receipts; the page writes decisions and glossaryDecisions. Everything read
// back from the page is untrusted and validated here before it touches the repo.

const Note = z.object({ n: z.number().int().min(1), kind: z.string().max(40), text: z.string().max(4000), cites: z.array(z.string().max(80)).max(20) });

export const DecisionSection = z.object({
  base: z.string().max(40).default(''),
  decision: z.enum(['ok', 'redraft']).nullable().default(null),
  title: z.string().max(400).optional(),
  summary: z.string().max(4000).optional(),
  en: z.record(z.string().max(12), z.string().max(4000)).optional(),
  translation: z.string().max(20000).optional(),
  note: z.string().max(4000).optional(),
  notes: z.array(Note).max(50).optional(),
  next: z.string().max(4000).optional(),
});

export const Decision = z.object({
  v: z.literal(1),
  unit: z.string().max(40),
  draftSha: z.string().max(40),
  weaveSha: z.string().max(40),
  updatedAt: z.string().max(40),
  ready: z.boolean().default(false),
  readyAt: z.string().max(40).nullable().default(null),
  progress: z.object({ ok: z.number().int(), redraft: z.number().int(), total: z.number().int() }).optional(),
  answers: z.array(z.object({ q: z.string().max(2000), a: z.string().max(4000) })).max(50).default([]),
  sections: z.record(z.string().max(12), DecisionSection).default({}),
});

export const GlossaryFields = z.object({
  en: z.string().max(200),
  type: z.enum(['term', 'person', 'place', 'text']),
  policy: z.enum(['translate', 'keep-source', 'keep-source-first-gloss']),
  alt: z.array(z.string().max(200)).max(20),
  variants: z.array(z.string().max(200)).max(20),
  definition: z.string().max(2000),
  symbolic: z.string().max(2000),            // the sheet's "image → referent (who, ids)" line
  never: z.array(z.string().max(200)).max(20),
}).partial();

export const GlossaryDecision = z.object({
  v: z.literal(1),
  id: z.string().max(80),
  entrySha: z.string().max(40),
  updatedAt: z.string().max(40),
  decision: z.enum(['approve', 'reject', 'defer']).nullable().default(null),
  fields: GlossaryFields.default({}),
  edited: z.array(z.enum(['en', 'type', 'policy', 'alt', 'variants', 'definition', 'symbolic', 'never'])).default([]),
});

export const Receipt = z.object({
  v: z.literal(1),
  subject: z.string(),
  decisionUpdatedAt: z.string(),
  at: z.string(),
  result: z.enum(['approved', 'not-approved', 'stale', 'problems', 'applied', 'skipped']),
  pending: z.array(z.string()).default([]),
  redraft: z.array(z.string()).default([]),
  unapproved: z.array(z.string()).default([]),
  problems: z.array(z.string()).default([]),
});
