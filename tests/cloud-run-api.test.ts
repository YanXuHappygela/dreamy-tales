import { describe, expect, it } from "vitest";

describe("configured Cloud Run API", () => {
  it("responds successfully at its health endpoint", async () => {
    const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
    expect(baseUrl).toBe("https://dreamy-tales-api-883430697720.us-central1.run.app");

    const response = await fetch(`${baseUrl}/api/health`);
    expect(response.ok).toBe(true);
    await expect(response.json()).resolves.toMatchObject({ ok: true });
  }, 15_000);
});
