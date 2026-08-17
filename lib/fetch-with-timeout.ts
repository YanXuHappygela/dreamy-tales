export const STORY_REQUEST_TIMEOUT_MS = 45_000;

/**
 * Bounds a client request without replacing a caller-provided abort signal.
 * The explicit message is shown by the story configuration screen on timeout.
 */
export async function fetchWithTimeout(
  fetchImpl: typeof fetch,
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs = STORY_REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetchImpl(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error("Story generation took too long. Please try again.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
