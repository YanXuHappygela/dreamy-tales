import { describe, expect, it, vi } from "vitest";
import { fetchWithTimeout } from "../lib/fetch-with-timeout";

describe("fetchWithTimeout", () => {
  it("returns the upstream response before the deadline", async () => {
    const response = new Response("ok", { status: 200 });
    const fetchImpl = vi.fn().mockResolvedValue(response);

    await expect(fetchWithTimeout(fetchImpl as typeof fetch, "https://example.test", undefined, 50)).resolves.toBe(response);
  });

  it("surfaces a child-friendly error when a request exceeds the deadline", async () => {
    const fetchImpl = vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      }),
    );

    await expect(fetchWithTimeout(fetchImpl as typeof fetch, "https://example.test", undefined, 1))
      .rejects.toThrow("Story generation took too long. Please try again.");
  });
});
