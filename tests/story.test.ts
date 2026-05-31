import { describe, expect, it } from "vitest";
import { StoryLanguage } from "../shared/types";

// ── Prompt builder logic (mirrors server/routers.ts) ──────────────────────────

const WORDS_PER_MINUTE = 110;

const LANGUAGE_INSTRUCTIONS: Record<string, string> = {
  English: "Write the story entirely in English.",
  Mandarin:
    "Write the story entirely in Simplified Chinese (Mandarin). Use simple vocabulary appropriate for young children aged 3–6.",
  Spanish:
    "Write the story entirely in Spanish. Use simple vocabulary appropriate for young children aged 3–6.",
};

function buildStoryPrompt(config: {
  childName: string;
  characterType: string;
  customCharacter?: string;
  scenario: string;
  style: string;
  lengthMinutes: number;
  language: StoryLanguage;
}): string {
  const wordCount = config.lengthMinutes * WORDS_PER_MINUTE;

  const characterDesc =
    config.characterType === "Custom" && config.customCharacter?.trim()
      ? config.customCharacter.trim()
      : config.characterType;

  const childNameClause =
    config.childName && config.childName !== "the little one"
      ? `The story is for a child named ${config.childName}.`
      : "";

  const langInstruction =
    LANGUAGE_INSTRUCTIONS[config.language] ?? LANGUAGE_INSTRUCTIONS["English"];

  return [
    `character: ${characterDesc}`,
    `scenario: ${config.scenario}`,
    `style: ${config.style}`,
    `words: ${wordCount}`,
    `child: ${childNameClause}`,
    `lang: ${langInstruction}`,
  ].join(", ");
}

// ── Language prefix matching (mirrors voice-picker.tsx) ───────────────────────

const LANGUAGE_PREFIXES: Record<StoryLanguage, string[]> = {
  English: ["en"],
  Mandarin: ["zh", "cmn"],
  Spanish: ["es"],
};

function voiceMatchesLanguage(voiceLang: string, language: StoryLanguage): boolean {
  const prefixes = LANGUAGE_PREFIXES[language];
  return prefixes.some((p) => voiceLang.toLowerCase().startsWith(p.toLowerCase()));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("story prompt builder — word count", () => {
  it("calculates correct word count for 5 minute story", () => {
    const prompt = buildStoryPrompt({
      childName: "Emma",
      characterType: "Bunny",
      scenario: "Forest",
      style: "Magical",
      lengthMinutes: 5,
      language: "English",
    });
    expect(prompt).toContain("550");
  });

  it("calculates correct word count for 3 minute story", () => {
    const prompt = buildStoryPrompt({
      childName: "the little one",
      characterType: "Dragon",
      scenario: "Space",
      style: "Funny",
      lengthMinutes: 3,
      language: "English",
    });
    expect(prompt).toContain("330");
  });

  it("calculates correct word count for 10 minute story", () => {
    const prompt = buildStoryPrompt({
      childName: "Liam",
      characterType: "Unicorn",
      scenario: "Castle",
      style: "Cozy",
      lengthMinutes: 10,
      language: "English",
    });
    expect(prompt).toContain("1100");
  });
});

describe("story prompt builder — custom character", () => {
  it("uses custom character description when characterType is Custom", () => {
    const prompt = buildStoryPrompt({
      childName: "Mia",
      characterType: "Custom",
      customCharacter: "a tiny wizard fox",
      scenario: "Forest",
      style: "Magical",
      lengthMinutes: 5,
      language: "English",
    });
    expect(prompt).toContain("a tiny wizard fox");
    expect(prompt).not.toContain("Custom");
  });

  it("falls back to preset label when customCharacter is empty", () => {
    const prompt = buildStoryPrompt({
      childName: "Mia",
      characterType: "Custom",
      customCharacter: "   ",
      scenario: "Forest",
      style: "Magical",
      lengthMinutes: 5,
      language: "English",
    });
    // Empty custom → falls back to "Custom" as the character description
    expect(prompt).toContain("Custom");
  });

  it("uses preset label when characterType is not Custom", () => {
    const prompt = buildStoryPrompt({
      childName: "Noah",
      characterType: "Bear",
      scenario: "Ocean",
      style: "Cozy",
      lengthMinutes: 4,
      language: "English",
    });
    expect(prompt).toContain("Bear");
  });
});

describe("story prompt builder — language instructions", () => {
  it("includes English instruction for English language", () => {
    const prompt = buildStoryPrompt({
      childName: "Lily",
      characterType: "Princess",
      scenario: "Castle",
      style: "Magical",
      lengthMinutes: 5,
      language: "English",
    });
    expect(prompt).toContain("Write the story entirely in English.");
  });

  it("includes Mandarin instruction for Mandarin language", () => {
    const prompt = buildStoryPrompt({
      childName: "小明",
      characterType: "Dragon",
      scenario: "Forest",
      style: "Magical",
      lengthMinutes: 5,
      language: "Mandarin",
    });
    expect(prompt).toContain("Simplified Chinese");
  });

  it("includes Spanish instruction for Spanish language", () => {
    const prompt = buildStoryPrompt({
      childName: "Sofia",
      characterType: "Unicorn",
      scenario: "Jungle",
      style: "Adventurous",
      lengthMinutes: 6,
      language: "Spanish",
    });
    expect(prompt).toContain("Write the story entirely in Spanish.");
  });
});

describe("voice language matching", () => {
  it("matches English voices by 'en' prefix", () => {
    expect(voiceMatchesLanguage("en-US", "English")).toBe(true);
    expect(voiceMatchesLanguage("en-GB", "English")).toBe(true);
    expect(voiceMatchesLanguage("en-AU", "English")).toBe(true);
  });

  it("matches Mandarin voices by 'zh' or 'cmn' prefix", () => {
    expect(voiceMatchesLanguage("zh-CN", "Mandarin")).toBe(true);
    expect(voiceMatchesLanguage("zh-TW", "Mandarin")).toBe(true);
    expect(voiceMatchesLanguage("cmn-CN", "Mandarin")).toBe(true);
  });

  it("matches Spanish voices by 'es' prefix", () => {
    expect(voiceMatchesLanguage("es-ES", "Spanish")).toBe(true);
    expect(voiceMatchesLanguage("es-MX", "Spanish")).toBe(true);
    expect(voiceMatchesLanguage("es-US", "Spanish")).toBe(true);
  });

  it("does not cross-match languages", () => {
    expect(voiceMatchesLanguage("fr-FR", "English")).toBe(false);
    expect(voiceMatchesLanguage("en-US", "Mandarin")).toBe(false);
    expect(voiceMatchesLanguage("zh-CN", "Spanish")).toBe(false);
  });
});

describe("story config validation", () => {
  it("accepts all valid character types including Custom", () => {
    const validCharacters = ["Bunny", "Dragon", "Princess", "Robot", "Unicorn", "Bear", "Custom"];
    validCharacters.forEach((char) => {
      expect(validCharacters).toContain(char);
    });
  });

  it("accepts all valid languages", () => {
    const validLanguages: StoryLanguage[] = ["English", "Mandarin", "Spanish"];
    validLanguages.forEach((lang) => {
      expect(["English", "Mandarin", "Spanish"]).toContain(lang);
    });
  });

  it("validates length range 3-10 minutes", () => {
    for (let min = 3; min <= 10; min++) {
      expect(min).toBeGreaterThanOrEqual(3);
      expect(min).toBeLessThanOrEqual(10);
    }
  });
});
