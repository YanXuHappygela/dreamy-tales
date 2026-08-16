import { describe, expect, it } from "vitest";
import { getNarrationFilename } from "../lib/narration-storage";

describe("local narration storage", () => {
  it("creates stable, ordered local filenames for narration paragraphs", () => {
    expect(getNarrationFilename("story-123", 0)).toBe("story-123-paragraph-000.mp3");
    expect(getNarrationFilename("story-123", 12)).toBe("story-123-paragraph-012.mp3");
  });

  it("sanitizes a story identifier before using it in a device filename", () => {
    expect(getNarrationFilename("story/../child", 1)).toBe("story____child-paragraph-001.mp3");
  });
});
