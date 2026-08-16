/**
 * Non-secret generation controls. Set these as Cloud Run environment variables
 * to change story behavior without changing the mobile application.
 */
export const DEFAULT_STORY_LLM_MODEL = "gemini-3.7-flash";
export const DEFAULT_STORY_LLM_TEMPERATURE = 0.7;
export const DEFAULT_STORY_BASE_PROMPT =
  "You are a gentle, imaginative children's story author who writes soothing bedtime stories.";

function parseTemperature(value: string | undefined): number {
  if (!value?.trim()) return DEFAULT_STORY_LLM_TEMPERATURE;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 2
    ? parsed
    : DEFAULT_STORY_LLM_TEMPERATURE;
}

export type StoryGenerationSettings = {
  model: string;
  temperature: number;
  basePrompt: string;
};

export function getStoryGenerationSettings(
  env: Record<string, string | undefined> = process.env,
): StoryGenerationSettings {
  return {
    model:
      env.STORY_LLM_MODEL?.trim() ||
      DEFAULT_STORY_LLM_MODEL,
    temperature: parseTemperature(env.STORY_LLM_TEMPERATURE),
    basePrompt: env.STORY_BASE_PROMPT?.trim() || DEFAULT_STORY_BASE_PROMPT,
  };
}
