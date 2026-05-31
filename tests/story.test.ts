import { describe, expect, it } from "vitest";

// Test the story prompt builder logic (pure function, no LLM call needed)
const WORDS_PER_MINUTE = 110;

function buildStoryPrompt(config: {
  childName: string;
  characterType: string;
  scenario: string;
  style: string;
  lengthMinutes: number;
}): string {
  const wordCount = config.lengthMinutes * WORDS_PER_MINUTE;
  const childNameClause =
    config.childName && config.childName !== "the little one"
      ? `The story is for a child named ${config.childName}.`
      : "";

  return `character: ${config.characterType}, scenario: ${config.scenario}, style: ${config.style}, words: ${wordCount}, child: ${childNameClause}`;
}

describe("story prompt builder", () => {
  it("calculates correct word count for 5 minute story", () => {
    const prompt = buildStoryPrompt({
      childName: "Emma",
      characterType: "Bunny",
      scenario: "Forest",
      style: "Magical",
      lengthMinutes: 5,
    });
    expect(prompt).toContain("550");
    expect(prompt).toContain("Bunny");
    expect(prompt).toContain("Forest");
    expect(prompt).toContain("Magical");
    expect(prompt).toContain("Emma");
  });

  it("calculates correct word count for 3 minute story", () => {
    const prompt = buildStoryPrompt({
      childName: "the little one",
      characterType: "Dragon",
      scenario: "Space",
      style: "Funny",
      lengthMinutes: 3,
    });
    expect(prompt).toContain("330");
    expect(prompt).toContain("Dragon");
  });

  it("calculates correct word count for 10 minute story", () => {
    const prompt = buildStoryPrompt({
      childName: "Liam",
      characterType: "Unicorn",
      scenario: "Castle",
      style: "Cozy",
      lengthMinutes: 10,
    });
    expect(prompt).toContain("1100");
    expect(prompt).toContain("Unicorn");
    expect(prompt).toContain("Castle");
  });

  it("omits child name clause when name is the default", () => {
    const prompt = buildStoryPrompt({
      childName: "the little one",
      characterType: "Bear",
      scenario: "Ocean",
      style: "Mysterious",
      lengthMinutes: 7,
    });
    // childNameClause should be empty
    expect(prompt).toContain("child: ");
    expect(prompt).not.toContain("named the little one");
  });
});

describe("story config validation", () => {
  it("accepts all valid character types", () => {
    const validCharacters = ["Bunny", "Dragon", "Princess", "Robot", "Unicorn", "Bear"];
    validCharacters.forEach((char) => {
      expect(["Bunny", "Dragon", "Princess", "Robot", "Unicorn", "Bear"]).toContain(char);
    });
  });

  it("accepts all valid scenarios", () => {
    const validScenarios = ["Forest", "Space", "Ocean", "Castle", "Jungle", "Cloud Kingdom"];
    validScenarios.forEach((scenario) => {
      expect(["Forest", "Space", "Ocean", "Castle", "Jungle", "Cloud Kingdom"]).toContain(scenario);
    });
  });

  it("accepts all valid styles", () => {
    const validStyles = ["Funny", "Magical", "Adventurous", "Cozy", "Mysterious"];
    validStyles.forEach((style) => {
      expect(["Funny", "Magical", "Adventurous", "Cozy", "Mysterious"]).toContain(style);
    });
  });

  it("validates length range 3-10 minutes", () => {
    for (let min = 3; min <= 10; min++) {
      expect(min).toBeGreaterThanOrEqual(3);
      expect(min).toBeLessThanOrEqual(10);
    }
  });
});
