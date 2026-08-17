export type ParsedStoryOutput = {
  title?: string;
  paragraphs?: string[];
};

/**
 * Extracts the first balanced JSON object from a model response. Unlike a
 * last-brace slice, this tolerates stray text or an extra `{}` after the JSON.
 */
export function parseStoryOutput(raw: string): ParsedStoryOutput | null {
  const start = raw.indexOf("{");
  if (start < 0) return null;

  let depth = 0;
  let quoted = false;
  let escaped = false;

  for (let index = start; index < raw.length; index += 1) {
    const char = raw[index];

    if (quoted) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        quoted = false;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        try {
          const parsed = JSON.parse(raw.slice(start, index + 1));
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            return parsed as ParsedStoryOutput;
          }
        } catch {
          return null;
        }
      }
    }
  }

  return null;
}

/** Removes model formatting artifacts without altering normal story prose. */
export function sanitizeStoryParagraph(paragraph: string): string {
  return paragraph
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .replace(/^\s*(?:\{\s*\}\s*)+/, "")
    .replace(/\s*\{\s*\}\s*(?=(?:Good night|Buenas noches|晚安))/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}
