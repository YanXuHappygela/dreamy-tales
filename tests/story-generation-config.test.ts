import { describe, expect, it } from "vitest";
import {
  DEFAULT_STORY_BASE_PROMPT,
  DEFAULT_STORY_LLM_MODEL,
  DEFAULT_STORY_LLM_TEMPERATURE,
  getStoryGenerationSettings,
} from "../server/story-generation-config";

describe("story generation deployment settings", () => {
  it("uses the safe Gemini Flash defaults", () => {
    expect(DEFAULT_STORY_LLM_MODEL).toBe("gemini-3.7-flash");
    expect(getStoryGenerationSettings({})).toEqual({
      model: DEFAULT_STORY_LLM_MODEL,
      temperature: DEFAULT_STORY_LLM_TEMPERATURE,
      basePrompt: DEFAULT_STORY_BASE_PROMPT,
    });
  });

  it("accepts a deployment-configured model, temperature, and author persona", () => {
    expect(
      getStoryGenerationSettings({
        STORY_LLM_MODEL: "gemini-3-flash-preview",
        STORY_LLM_TEMPERATURE: "1.15",
        STORY_BASE_PROMPT: "You write playful but peaceful bedtime adventures.",
      }),
    ).toEqual({
      model: "gemini-3-flash-preview",
      temperature: 1.15,
      basePrompt: "You write playful but peaceful bedtime adventures.",
    });
  });

  it("falls back to the safe temperature for invalid values", () => {
    expect(getStoryGenerationSettings({ STORY_LLM_TEMPERATURE: "3" }).temperature).toBe(
      DEFAULT_STORY_LLM_TEMPERATURE,
    );
    expect(getStoryGenerationSettings({ STORY_LLM_TEMPERATURE: "many" }).temperature).toBe(
      DEFAULT_STORY_LLM_TEMPERATURE,
    );
  });
});
