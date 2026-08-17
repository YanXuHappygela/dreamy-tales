import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GeneratedStory } from "../shared/types";

const storage = vi.hoisted(() => ({
  getItem: vi.fn(),
  setItem: vi.fn(),
}));

vi.mock("@react-native-async-storage/async-storage", () => ({ default: storage }));

import { loadActiveStory, saveActiveStory } from "../lib/story-navigation";

const story: GeneratedStory = {
  id: "story-123",
  title: "Bramble's Moon",
  paragraphs: ["A gentle bedtime paragraph."],
  config: { childName: "Ari", characterType: "Bunny", scenario: "Forest", style: "Cozy", lengthMinutes: 3, language: "English", ageGroup: "5-6" },
  generatedAt: "2026-08-17T00:00:00.000Z",
};

describe("story navigation storage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("stores a full story locally while returning only its compact ID for navigation", async () => {
    await expect(saveActiveStory(story)).resolves.toBe("story-123");
    expect(storage.setItem).toHaveBeenCalledWith("dreamy_tales_active_story", JSON.stringify(story));
    expect("story-123".length).toBeLessThan(64);
  });

  it("loads only the story matching the compact route ID", async () => {
    storage.getItem.mockResolvedValue(JSON.stringify(story));
    await expect(loadActiveStory("story-123")).resolves.toEqual(story);
    await expect(loadActiveStory("different-story")).resolves.toBeNull();
  });
});
