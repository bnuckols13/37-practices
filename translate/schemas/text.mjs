import { z } from 'zod';

// usage decides where a witness may go. Mirrors furtherReadingOnly in build/sources.json:
//   prompt+publish  may be shown to the drafter and printed on pages
//   publish-only    may be cited/printed but never sent to the drafter
//   reviewer-only   copyrighted reference; never in prompts, the repo or pages
export const Usage = z.enum(['prompt+publish', 'publish-only', 'reviewer-only']);

export const Witness = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  lang: z.array(z.string()).min(1),
  script: z.string().default(''),
  citation: z.string(),
  label: z.string().default(''),           // short name for page badges
  license: z.string(),
  usage: Usage,
  units: z.array(z.string()).default([]),
  url: z.string().default(''),
  fetch: z.string().default(''),           // page template for `import --fetch N`, e.g. a Wikisource URL with {n}
  note: z.string().default(''),
  path: z.string().default(''),
});

export const Text = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  idPrefix: z.string().regex(/^[a-z][a-z0-9]*$/),
  idWidth: z.number().int().min(1).max(4).default(2),
  unitLabel: z.string().default('Section'),
  title: z.object({ en: z.string(), alt: z.array(z.string()).default([]) }),
  author: z.string().default(''),
  description: z.string().default(''),
  lang: z.object({
    root: z.string(),
    commentary: z.string().default(''),
    html: z.record(z.string(), z.string()).default({}),
    names: z.record(z.string(), z.string()).default({}),
  }),
  segmentation: z.object({ rule: z.enum(['caryagiti', 'lines']) }),
  witnesses: z.array(Witness).min(1),
  commentary: z.object({
    id: z.string(), title: z.string(), author: z.string(), witness: z.string(),
  }).optional(),
  exemplars: z.array(z.string()).default([]),
  catalog: z.object({
    total: z.number().int().optional(),
    lost: z.array(z.number().int()).default([]),
    partial: z.array(z.number().int()).default([]),
    note: z.string().default(''),
  }).default({ lost: [], partial: [], note: '' }),
  publish: z.object({
    dir: z.string(),
    license: z.string(),
    licenseUrl: z.string().default(''),
    credits: z.array(z.string()).default([]),
  }),
});
