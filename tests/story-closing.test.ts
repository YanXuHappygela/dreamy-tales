import { describe, expect, it } from "vitest";
import { ensureLocalizedStoryClosing, getLocalizedGoodNightLine } from "../shared/story-closing";

describe("localized story closings", () => {
  it.each([
    ["English", "Lily", "Good night, sweet dreams, Lily."],
    ["Mandarin", "小明", "晚安，祝你美梦，小明。"],
    ["Spanish", "Sofía", "Buenas noches, dulces sueños, Sofía."],
  ] as const)("uses a child-addressed %s good-night line", (language, childName, expected) => {
    expect(getLocalizedGoodNightLine(language, childName)).toBe(expected);
  });

  it("adds the selected-language closing if a generated story omits it", () => {
    const paragraphs = ensureLocalizedStoryClosing(
      ["Pip found a cozy place to sleep."],
      "Spanish",
      "Sofía",
    );

    expect(paragraphs).toEqual([
      "Pip found a cozy place to sleep. Buenas noches, dulces sueños, Sofía.",
    ]);
  });

  it("does not duplicate a closing already returned by the model", () => {
    const closing = "晚安，祝你美梦，小明。";
    const paragraphs = ensureLocalizedStoryClosing([`小龙闭上了眼睛。${closing}`], "Mandarin", "小明");

    expect(paragraphs).toEqual([`小龙闭上了眼睛。${closing}`]);
  });
});
