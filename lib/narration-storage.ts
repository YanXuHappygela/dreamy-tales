/** Creates a safe, predictable local filename for a story narration paragraph. */
export function getNarrationFilename(storyId: string, paragraphIndex: number): string {
  const safeStoryId = storyId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeIndex = Math.max(0, Math.floor(paragraphIndex));
  return `${safeStoryId}-paragraph-${String(safeIndex).padStart(3, "0")}.mp3`;
}
