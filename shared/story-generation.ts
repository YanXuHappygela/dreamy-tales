/** Target narration pace used across story generation and length calculations. */
export const STORY_WORDS_PER_MINUTE = 132;

export function getStoryTargetWordCount(lengthMinutes: number): number {
  return lengthMinutes * STORY_WORDS_PER_MINUTE;
}

/**
 * Allows enough room for the requested prose plus JSON structure, without the
 * previous unbounded 32k-token generation allowance.
 */
export function getStoryOutputTokenLimit(lengthMinutes: number): number {
  const targetWords = getStoryTargetWordCount(lengthMinutes);
  return Math.max(1400, Math.ceil(targetWords * 1.5) + 450);
}
