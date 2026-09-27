import { z } from 'zod';
import { RunProvenance } from './approved.mjs';

// The `sing` task: the unit sounded in English, a second English beside the
// accurate one. The accurate translation carries the meaning; this carries the
// song: its line shapes, its rhymes where English can give them honestly, its
// refrain, its voice. Every field is required; use "" or [].
export const SungLine = z.object({
  id: z.string().describe('the unit line id (verse lines only, same order as the input)'),
  en: z.string().describe('the line as it would be sung; glossary markup [surface]{term-id} is allowed, not required'),
});

export const SungCouplet = z.object({
  group: z.string().describe('the couplet id, e.g. cp.10.3'),
  kept: z.string().describe('what this couplet keeps of the source\'s sound, image or feeling, and how; 40 words or fewer'),
  letGo: z.string().describe('what it gives up to do so, if anything; 40 words or fewer, "" if nothing'),
});

export const Sung = z.object({
  unit: z.string(),
  voice: z.string().describe('one or two sentences: whose voice this is, to whom, in what mood, and the register chosen for it'),
  refrainCue: z.string().describe('the opening words of the sung refrain, printed after each later couplet as a cue to sing it again; "" if the unit has no refrain'),
  lines: z.array(SungLine),
  couplets: z.array(SungCouplet),
  questions: z.array(z.string()),
});

export const SungFiled = Sung.extend({
  provenance: RunProvenance.extend({ draftSha: z.string().describe('the accurate draft this was sung from') }),
});

// Written only by `accept --sung`, after the reviewer has said ok to every section.
export const ApprovedSung = z.object({
  unit: z.string(),
  sourceSha: z.string(),
  voice: z.string(),
  refrainCue: z.string(),
  lines: z.array(SungLine),
  couplets: z.array(SungCouplet),
  provenance: z.object({
    sung: SungFiled.shape.provenance,
    review: z.object({
      by: z.string(), date: z.string(), sheetSha: z.string(), sungSha: z.string(),
      decisions: z.record(z.string(), z.enum(['ok', 'edited'])),
    }),
  }),
});
