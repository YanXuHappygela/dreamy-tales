import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies.js";
import { systemRouter } from "./_core/systemRouter.js";
import { publicProcedure, router } from "./_core/trpc.js";
import { invokeLLM } from "./_core/llm.js";
import { GeneratedStory, StoryConfig } from "../shared/types.js";
import { randomUUID } from "crypto";

// Approximate words per minute for a calm, soothing read-aloud voice
const WORDS_PER_MINUTE = 110;

const LANGUAGE_INSTRUCTIONS: Record<string, string> = {
  English: "Write the story entirely in English.",
  Mandarin:
    "Write the story entirely in Simplified Chinese (Mandarin). Use simple vocabulary appropriate for young children aged 3–6.",
  Spanish:
    "Write the story entirely in Spanish. Use simple vocabulary appropriate for young children aged 3–6.",
};

function buildStoryPrompt(config: StoryConfig): string {
  const wordCount = config.lengthMinutes * WORDS_PER_MINUTE;

  // Resolve the actual character description
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

  return `You are a gentle, imaginative children's story author who writes soothing bedtime stories for children aged 3–6.

${childNameClause}
${langInstruction}

Write a bedtime story with the following details:
- Main character: A ${characterDesc}
- Setting: ${config.scenario}
- Story style/mood: ${config.style}
- Target length: approximately ${wordCount} words (about ${config.lengthMinutes} minutes when read aloud at a calm pace)

Requirements:
- Write in simple, warm, soothing language appropriate for 3–6 year olds
- The story should have a gentle, calming ending that helps children drift off to sleep
- Use short sentences and vivid but soft imagery
- Include a satisfying narrative arc: a small adventure or challenge, and a peaceful resolution
- Do NOT include scary, violent, or overly exciting content
- The story should feel cozy and reassuring

Return ONLY valid JSON in this exact format (no markdown, no extra text):
{
  "title": "A short, magical story title",
  "paragraphs": [
    "First paragraph text...",
    "Second paragraph text...",
    "... (continue for all paragraphs)"
  ]
}

Each paragraph should be 2–4 sentences. Aim for ${Math.round(wordCount / 60)} paragraphs total.`;
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  story: router({
    generate: publicProcedure
      .input(
        z.object({
          childName: z.string().max(50).default("the little one"),
          characterType: z.string().max(80),
          customCharacter: z.string().max(80).optional(),
          scenario: z.enum([
            "Forest",
            "Space",
            "Ocean",
            "Castle",
            "Jungle",
            "Cloud Kingdom",
          ]),
          style: z.enum([
            "Funny",
            "Magical",
            "Adventurous",
            "Cozy",
            "Mysterious",
          ]),
          lengthMinutes: z.number().int().min(3).max(10),
          language: z.enum(["English", "Mandarin", "Spanish"]).default("English"),
          voiceId: z.string().optional(),
        })
      )
      .mutation(async ({ input }): Promise<GeneratedStory> => {
        const config: StoryConfig = {
          ...input,
          language: input.language as StoryConfig["language"],
        };
        const prompt = buildStoryPrompt(config);

        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content:
                "You are a gentle children's story author. Always respond with valid JSON only, no markdown fences.",
            },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" },
        });

        const rawContent = response.choices[0]?.message?.content ?? "{}";
        const raw: string =
          typeof rawContent === "string"
            ? rawContent
            : rawContent
                .map((c) => (c.type === "text" ? c.text : ""))
                .join("");

        let parsed: { title?: string; paragraphs?: string[] };
        try {
          parsed = JSON.parse(raw);
        } catch {
          parsed = { title: "A Dreamy Tale", paragraphs: [raw] };
        }

        const title = parsed.title ?? "A Dreamy Tale";
        const rawParagraphs =
          Array.isArray(parsed.paragraphs) && parsed.paragraphs.length > 0
            ? parsed.paragraphs
            : [raw];
        const paragraphs: string[] = rawParagraphs.map((p: unknown) =>
          typeof p === "string" ? p : String(p)
        );

        return {
          id: randomUUID(),
          title,
          paragraphs,
          config,
          generatedAt: new Date().toISOString(),
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;
