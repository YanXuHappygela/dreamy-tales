import { describe, expect, it } from "vitest";
import {
  getStoryOutputTokenLimit,
  getStoryTargetWordCount,
  STORY_WORDS_PER_MINUTE,
} from "../shared/story-generation";

describe("story-generation output budget", () => {
  it("keeps the established calm narration pace", () => {
    expect(STORY_WORDS_PER_MINUTE).toBe(132);
    expect(getStoryTargetWordCount(5)).toBe(660);
    expect(getStoryTargetWordCount(10)).toBe(1320);
  });

  it("uses bounded response budgets sized for each requested story length", () => {
    expect(getStoryOutputTokenLimit(3)).toBe(1400);
    expect(getStoryOutputTokenLimit(5)).toBe(1440);
    expect(getStoryOutputTokenLimit(8)).toBe(2034);
    expect(getStoryOutputTokenLimit(10)).toBe(2430);
  });
});
