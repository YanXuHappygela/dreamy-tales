/**
 * Starts synthesis for every paragraph immediately, then returns each result
 * in source-paragraph order. Promise.all preserves input ordering even when
 * individual requests complete out of order.
 */
export async function synthesizeParagraphsInParallel<T>(
  paragraphs: readonly string[],
  synthesize: (paragraph: string, index: number) => Promise<T>,
  onProgress?: (percent: number) => void,
): Promise<T[]> {
  if (paragraphs.length === 0) {
    onProgress?.(100);
    return [];
  }

  let completed = 0;
  const results = await Promise.all(
    paragraphs.map(async (paragraph, index) => {
      const result = await synthesize(paragraph, index);
      completed += 1;
      onProgress?.(Math.round((completed / paragraphs.length) * 100));
      return result;
    }),
  );

  return results;
}
