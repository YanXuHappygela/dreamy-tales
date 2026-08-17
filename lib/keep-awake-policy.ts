/**
 * The web Wake Lock API rejects requests made while a page is hidden.
 * Native bedtime reading keeps its screen-awake behavior unchanged.
 */
export function shouldUseKeepAwake(platform: string): boolean {
  return platform !== "web";
}
