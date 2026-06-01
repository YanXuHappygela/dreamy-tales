import { describe, expect, it } from "vitest";

describe("Google Cloud TTS API key validation", () => {
  it("can list voices from Google Cloud TTS", async () => {
    const apiKey = process.env.GOOGLE_TTS_API_KEY;
    expect(apiKey, "GOOGLE_TTS_API_KEY must be set").toBeTruthy();

    const res = await fetch(
      `https://texttospeech.googleapis.com/v1/voices?key=${apiKey}&languageCode=en-US`
    );
    expect(res.status, `API returned ${res.status} — check the key is valid and Cloud TTS API is enabled`).toBe(200);

    const data = await res.json() as { voices?: unknown[] };
    expect(Array.isArray(data.voices), "Response should contain a voices array").toBe(true);
    expect((data.voices ?? []).length).toBeGreaterThan(0);
  });
});
