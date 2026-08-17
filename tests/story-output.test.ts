import { describe, expect, it } from "vitest";
import { parseStoryOutput, sanitizeStoryParagraph } from "../shared/story-output";

describe("story output parsing", () => {
  it("extracts the first balanced JSON object when a model appends stray braces", () => {
    const raw = '{"title":"Moon","paragraphs":["Hello"]} {} Good night, sweet dreams.';
    expect(parseStoryOutput(raw)).toEqual({ title: "Moon", paragraphs: ["Hello"] });
  });

  it("handles braces inside quoted story text", () => {
    const raw = '{"title":"Moon","paragraphs":["Pip found a {sparkly} stone."]} trailing';
    expect(parseStoryOutput(raw)?.paragraphs).toEqual(["Pip found a {sparkly} stone."]);
  });

  it("removes the leaked empty-object artifact before the bedtime closing", () => {
    expect(sanitizeStoryParagraph("{} Good night, sweet dreams, Ari.")).toBe("Good night, sweet dreams, Ari.");
  });
});
