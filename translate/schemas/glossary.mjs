import { z } from 'zod';

// Modelled on 84000's glossary entries (types, attestation codes), but every
// word of ours is our own: 84000's terms forbid remixing their glossary.
//   AS attested in the source manuscript   AO attested in other manuscripts
//   AD attested in dictionaries            AA approximate
//   RP reconstructed phonetically          RS reconstructed semantically   SU source unspecified
export const Att = z.enum(['AS', 'AO', 'AD', 'AA', 'RP', 'RS', 'SU']);
export const EntryType = z.enum(['term', 'person', 'place', 'text']);
export const Policy = z.enum(['translate', 'keep-source', 'keep-source-first-gloss']);

export const Form = z.object({
  lang: z.string(),
  script: z.string().default(''),          // form in its own script
  translit: z.string().default(''),        // IAST / Wylie
  att: Att.default('SU'),
  where: z.string().default(''),           // passage id where attested
});

export const Reading = z.object({
  referent: z.string(),
  per: z.string(),                         // who reads it this way, e.g. "Munidatta"
  where: z.array(z.string()).default([]),  // segment ids grounding the reading
});

export const Entry = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  type: EntryType,
  status: z.enum(['proposed', 'approved', 'rejected']),
  en: z.string().min(1),
  alt: z.array(z.string()).default([]),
  variants: z.array(z.string()).default([]),  // accepted English surface variants (plurals, possessives)
  policy: Policy.default('translate'),
  forms: z.array(Form).default([]),
  match: z.record(z.string(), z.array(z.string())).default({}),    // lang -> literal source forms
  matchRe: z.record(z.string(), z.array(z.string())).default({}),  // lang -> regex source forms
  definition: z.string().default(''),
  symbolic: z.object({
    image: z.string().default(''),
    readings: z.array(Reading).default([]),
  }).default({ image: '', readings: [] }),
  forbiddenInLine: z.array(z.string()).default([]),
  texts: z.array(z.string()).default([]),  // empty = shared across texts
  provenance: z.object({
    proposed: z.object({ by: z.string(), date: z.string() }).optional(),
    approved: z.object({ by: z.string(), date: z.string() }).optional(),
    rejected: z.object({ by: z.string(), date: z.string() }).optional(),
  }).default({}),
});

export const Glossary = z.object({ entries: z.array(Entry) });

// What the drafter may propose. Structured-output friendly: every field
// required, arrays instead of records.
export const Proposal = z.object({
  id: z.string().describe('lowercase ascii slug, e.g. "dombi"; persons "p-kanha", places "pl-…", texts "tx-…"'),
  type: EntryType,
  en: z.string().describe('the English rendering to use in translations'),
  policy: Policy,
  alt: z.array(z.string()),
  forms: z.array(z.object({
    lang: z.string(), script: z.string(), translit: z.string(), att: Att, where: z.string(),
  })),
  match: z.array(z.object({ lang: z.string(), form: z.string() }))
    .describe('source-script surface forms that should be recognised as this term'),
  definition: z.string().describe('your own words, 60 words or fewer'),
  symbolicImage: z.string().describe('the literal image, or ""'),
  symbolicReadings: z.array(z.object({ referent: z.string(), per: z.string(), where: z.array(z.string()) }))
    .describe('only readings attested in a given commentary segment id; [] otherwise'),
  forbiddenInLine: z.array(z.string()).describe('esoteric referents that must never replace the image inside a verse line'),
  rationale: z.string(),
});
