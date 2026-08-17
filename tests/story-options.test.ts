import { describe, expect, it } from "vitest";
import { CHARACTER_OPTIONS } from "../lib/story-options";

describe("CHARACTER_OPTIONS", () => {
  it("includes the requested animal characters for the Main Character carousel", () => {
    const labels = CHARACTER_OPTIONS.map((option) => option.label);

    expect(labels).toEqual(expect.arrayContaining(["Panda", "Spider", "Bird", "Dog"]));
  });
});
