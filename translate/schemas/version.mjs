import { z } from 'zod';

// A version: a poem in English made from one song through a lens (Blake's
// couplets, the ballad, the psalm…), in the Workshop or in a session. The
// third English beside the accurate and the sung ones: an imitation in
// Dryden's sense, which keeps the song's shape and images and says what it
// changed. See prompts/tasks/version.md and research/western-lenses.md.
const Heat = z.number().min(0).max(1);

export const Board = z.object({ lineation: Heat, syntax: Heat, rhythm: Heat, rhyme: Heat });

export const VersionLine = z.object({
  id: z.string().describe('the unit line id (verse lines only, same order as the input)'),
  en: z.string().describe('the line of the version; plain text, no glossary markup'),
});

export const VersionCouplet = z.object({
  group: z.string().describe('the couplet id, e.g. cp.14.3'),
  kept: z.string().describe('what the couplet keeps of the source\'s sound, image or feeling, and how; 40 words or fewer'),
  letGo: z.string().describe('what it gives up, if anything; 40 words or fewer, "" if nothing'),
});

// What the maker (or the drafter) hands over.
export const Version = z.object({
  unit: z.string(),
  title: z.string().describe('the version\'s own title; "" to use the song\'s'),
  lens: z.string().describe('a lens id from prompts/lenses.json, or "own" for a version made without one'),
  latitude: z.enum(['close', 'free']),
  board: Board.describe('the board the maker set: 0 cool .. 1 hot'),
  voice: z.string(),
  refrainCue: z.string().describe('the opening words of the refrain as this version sings it; "" if none'),
  lines: z.array(VersionLine),
  couplets: z.array(VersionCouplet),
  added: z.array(z.string()).describe('what a free version adds; [] for a close one'),
  note: z.string().describe('the maker\'s note, if any'),
});

// As filed under texts/<text>/versions/<unit>/<id>.json.
export const VersionFiled = Version.extend({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  by: z.string().describe('who made it: a name, or "Claude" for a drafted example'),
  made: z.string().describe('YYYY-MM-DD'),
  via: z.enum(['workshop', 'session', 'hand']),
  sourceSha: z.string(),
  status: z.enum(['draft', 'kept']).describe('kept: the reviewer chose it for the Reading Room'),
});
