// "Why this rendering?": a fresh question to Claude about one line, spent on
// the reviewer's own Claude usage. It is not the drafter's reasoning, and the
// answer is never saved as a decision.

export const WHY_ERRORS = {
  not_granted: 'You declined asking Claude from this page. Ask in the Claude Code session instead.',
  rate_limited: 'Too many questions at once. Try again in a minute.',
  session_expired: 'Your Claude session expired. Reload the Studio.',
  sampling_disabled: 'Asking Claude from pages is turned off for your account.',
  prompt_too_large: 'This line has too much context to send. Ask in the session instead.',
  refused: 'Claude declined to answer this one.',
  cancelled: '',
};

export function whyPrompt({ textTitle, songLabel, line, draftEn, currentEn, neighbours, comment, terms, question }) {
  return [
    `You are helping a translator review an English translation of "${textTitle}" (${songLabel}).`,
    'Explain the rendering of one line. Be concrete about the source words, the choices made and the alternatives.',
    'Say plainly where you are unsure. At most 150 words. Plain text, no headings.',
    'Do not quote or imitate any published translation of this text.',
    '',
    `Source: ${line.src}`,
    `Transliteration: ${line.drafterTranslit || line.translit}`,
    `Word-by-word: ${line.gloss}`,
    `Claude's draft: ${draftEn}`,
    currentEn !== draftEn ? `The reviewer's current version: ${currentEn}` : '',
    line.flags.length ? `Flags the drafter raised: ${line.flags.map(f => `${f.kind} (${f.level}): ${f.note}`).join('; ')}` : '',
    neighbours ? `Neighbouring lines: ${neighbours}` : '',
    comment ? `The traditional commentary on this passage says: ${comment}` : '',
    terms ? `Glossary entries in play: ${terms}` : '',
    '',
    `The reviewer asks: ${question || 'Why this rendering?'}`,
  ].filter(s => s !== '').join('\n');
}

export async function askWhy(sample, prompt, { onText, signal }) {
  const { text } = await sample(prompt, { onText, signal, modelTier: 'default' });
  return text;
}
