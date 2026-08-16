import type { StoryLanguage } from "./types";

/** Returns the exact final sentence used to tuck the child in, in story language. */
export function getLocalizedGoodNightLine(
  language: StoryLanguage | undefined,
  childName: string | undefined,
): string {
  const name = childName?.trim();
  const includeName = Boolean(name && name !== "the little one");

  switch (language) {
    case "Mandarin":
      return includeName ? `晚安，祝你美梦，${name}。` : "晚安，祝你美梦。";
    case "Spanish":
      return includeName
        ? `Buenas noches, dulces sueños, ${name}.`
        : "Buenas noches, dulces sueños.";
    case "English":
    default:
      return includeName
        ? `Good night, sweet dreams, ${name}.`
        : "Good night, sweet dreams.";
  }
}

/**
 * Ensures a generated story's final paragraph has the localized closing line.
 * This serves as a deterministic safeguard if a model omits the prompt's final sentence.
 */
export function ensureLocalizedStoryClosing(
  paragraphs: string[],
  language: StoryLanguage | undefined,
  childName: string | undefined,
): string[] {
  const closingLine = getLocalizedGoodNightLine(language, childName);
  const normalized = paragraphs.map((paragraph) => paragraph.trim()).filter(Boolean);

  if (normalized.length === 0) return [closingLine];

  const lastIndex = normalized.length - 1;
  if (!normalized[lastIndex].endsWith(closingLine)) {
    const joiner = language === "Mandarin" ? "" : " ";
    normalized[lastIndex] = `${normalized[lastIndex]}${joiner}${closingLine}`;
  }

  return normalized;
}
