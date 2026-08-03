import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies.js";
import { systemRouter } from "./_core/systemRouter.js";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc.js";
import * as db from "./db.js";
import { invokeLLM } from "./_core/llm.js";
import { GeneratedStory, StoryConfig } from "../shared/types.js";
import { randomUUID } from "crypto";
import { listGoogleVoices, synthesizeSpeech } from "./googleTts.js";
import { storagePut } from "./storage.js";


// ── Simple in-memory rate limiter ─────────────────────────────────────────────
type RateLimitEntry = { count: number; resetAt: number };
const rateLimitStore = new Map<string, RateLimitEntry>();

function checkRateLimit(key: string, maxPerHour: number): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + 3_600_000 });
    return true; // allowed
  }
  if (entry.count >= maxPerHour) return false; // blocked
  entry.count++;
  return true;
}

function getClientIp(req: { ip?: string; headers: Record<string, string | string[] | undefined> }): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) return (Array.isArray(forwarded) ? forwarded[0] : forwarded).split(",")[0].trim();
  return req.ip ?? "unknown";
}

// Approximate words per minute for a calm, soothing read-aloud voice
const WORDS_PER_MINUTE = 132;

const AGE_INSTRUCTIONS: Record<string, string> = {
  "3-4": "The child is 3–4 years old. Use very simple words (1–2 syllables where possible), very short sentences (5–8 words), and highly repetitive, rhythmic language. Keep the story gentle, slow-paced, and focused on one simple idea.",
  "5-6": "The child is 5–6 years old. Use simple vocabulary, short sentences, and a clear beginning-middle-end structure. Include a small challenge the character overcomes.",
  "7-8": "The child is 7–8 years old. Use richer vocabulary, slightly longer sentences, and a more developed plot with mild suspense that resolves peacefully. Include some descriptive imagery.",
  "8+":  "The child is 8 years or older. Use varied sentence structure, expressive vocabulary, and a well-developed narrative arc with interesting characters and a satisfying, calming resolution.",
};

const LANGUAGE_INSTRUCTIONS: Record<string, string> = {
  English: "Write the story entirely in English.",
  Mandarin:
    "Write the story entirely in Simplified Chinese (Mandarin). Use simple vocabulary appropriate for young children.",
  Spanish:
    "Write the story entirely in Spanish. Use simple vocabulary appropriate for young children.",
};

// BCP-47 codes for each language
const LANGUAGE_CODES: Record<string, string> = {
  English: "en-US",
  Mandarin: "zh-CN",
  Spanish: "es-ES",
};

function buildStoryPrompt(config: StoryConfig): string {
  const wordCount = config.lengthMinutes * WORDS_PER_MINUTE;

  const characterDesc =
    config.characterType === "Custom" && config.customCharacter?.trim()
      ? config.customCharacter.trim()
      : config.characterType;

  const childNameClause =
    config.childName && config.childName !== "the little one"
      ? `The story is for a child named ${config.childName}.`
      : "";

  const goodNightLine =
    config.childName && config.childName !== "the little one"
      ? `"Good night, sweet dreams, ${config.childName}."`
      : `"Good night, sweet dreams."`;

  const storyIdeaClause =
    config.storyIdea?.trim()
      ? `The caregiver has suggested this story idea or plot direction: "${config.storyIdea.trim()}". Incorporate this naturally into the story while keeping it gentle and age-appropriate.`
      : "";

  const ageInstruction =
    AGE_INSTRUCTIONS[config.ageGroup ?? "5-6"] ?? AGE_INSTRUCTIONS["5-6"];

  const langInstruction =
    LANGUAGE_INSTRUCTIONS[config.language] ?? LANGUAGE_INSTRUCTIONS["English"];

  return `You are a gentle, imaginative children's story author who writes soothing bedtime stories.

${childNameClause}
${ageInstruction}
${storyIdeaClause}
${langInstruction}

Write a bedtime story with the following details:
- Main character: A ${characterDesc}
- Setting: ${config.scenario}
- Story style/mood: ${config.style}
- Target length: approximately ${wordCount} words (about ${config.lengthMinutes} minutes when read aloud at a calm pace)

Requirements:
- Write in simple, warm, soothing language appropriate for the child's age
- The story should have a gentle, calming ending that helps children drift off to sleep
- Use short sentences and vivid but soft imagery
- Include a satisfying narrative arc: a small adventure or challenge, and a peaceful resolution
- Do NOT include scary, violent, or overly exciting content
- The story should feel cozy and reassuring
- The main character must have a name that is DIFFERENT from the child's name (${config.childName && config.childName !== "the little one" ? `"${config.childName}"` : "the child's name"}). Give the character a distinct, imaginative name that fits their type (e.g. a bunny named Pip, a dragon named Ember)
- The VERY LAST paragraph must end with the exact closing line: ${goodNightLine} — this is the final sentence of the story, spoken gently as if tucking the child in

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

  // ── Story generation ─────────────────────────────────────────────────────────
  story: router({
    generate: protectedProcedure
      .input(
        z.object({
          childName: z.string().max(50).default("the little one"),
          characterType: z.string().max(80),
          customCharacter: z.string().max(80).optional(),
          scenario: z.enum([
            "Forest", "Space", "Ocean", "Castle", "Jungle", "Cloud Kingdom",
            "Volcano", "Desert", "Mountain",
          ]),
          style: z.enum([
            "Funny", "Magical", "Adventurous", "Cozy", "Mysterious", "Silly",
          ]),
          lengthMinutes: z.number().int().min(3).max(10),
          language: z.enum(["English", "Mandarin", "Spanish"]).default("English"),
          ageGroup: z.enum(["3-4", "5-6", "7-8", "8+"]).default("5-6"),
          voiceId: z.string().optional(),
          voiceLanguageCode: z.string().optional(),
          storyIdea: z.string().max(300).optional(),
        })
      )
      .mutation(async ({ input, ctx }): Promise<GeneratedStory> => {
        // Enforce daily story limit for free users
        await db.incrementStoryUsage(ctx.user.id);

        const ip = getClientIp(ctx.req as any);
        if (!checkRateLimit(`generate:${ip}`, 10)) {
          throw new Error("Rate limit exceeded. You can generate up to 10 stories per hour.");
        }
        const config: StoryConfig = {
          ...input,
          language: input.language as StoryConfig["language"],
          ageGroup: input.ageGroup as StoryConfig["ageGroup"],
        };
        const prompt = buildStoryPrompt(config);

        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content:
                "You are a gentle children's story author. You MUST respond with ONLY a raw JSON object — no markdown fences, no backticks, no explanatory text before or after. The response must start with { and end with }.",
            },
            { role: "user", content: prompt },
          ],
        });

        const rawContent = response.choices[0]?.message?.content ?? "{}";
        const raw: string =
          typeof rawContent === "string"
            ? rawContent
            : rawContent.map((c) => (c.type === "text" ? c.text : "")).join("");

        // Helper: extract JSON object from any surrounding text/fences
        function extractJson(text: string): { title?: string; paragraphs?: string[] } | null {
          let s = text.trim();
          // Strip opening/closing backtick fences (with or without closing fence)
          s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
          // Find the first { ... } block
          const start = s.indexOf("{");
          const end = s.lastIndexOf("}");
          if (start === -1 || end <= start) return null;
          try {
            return JSON.parse(s.slice(start, end + 1));
          } catch {
            return null;
          }
        }

        let parsed: { title?: string; paragraphs?: string[] } | null = extractJson(raw);

        // If first attempt failed (e.g. model returned only backticks), retry with a direct prompt
        if (!parsed || !Array.isArray(parsed.paragraphs) || parsed.paragraphs.length === 0) {
          const retryResponse = await invokeLLM({
            messages: [
              {
                role: "system",
                content: "Output ONLY valid JSON. No markdown. No backticks. Start with {.",
              },
              {
                role: "user",
                content: `${prompt}\n\nIMPORTANT: Your response must be ONLY a JSON object starting with { and ending with }. No code blocks.`,
              },
            ],
          });
          const retryContent = retryResponse.choices[0]?.message?.content ?? "{}";
          const retryRaw: string =
            typeof retryContent === "string"
              ? retryContent
              : retryContent.map((c: { type: string; text?: string }) => (c.type === "text" ? c.text ?? "" : "")).join("");
          parsed = extractJson(retryRaw);
        }

        if (!parsed) {
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

    /** Get today's story usage count for the logged-in user */
    usage: protectedProcedure.query(async ({ ctx }) => {
      const count = await db.getStoryUsageToday(ctx.user.id);
      return { count, limit: 3, remaining: Math.max(0, 3 - count) };
    }),
  }),

  // ── Google Cloud TTS ─────────────────────────────────────────────────────────
  tts: router({
    /**
     * List available Google Cloud voices for a given language.
     */
    listVoices: publicProcedure
      .input(z.object({ language: z.enum(["English", "Mandarin", "Spanish"]) }))
      .query(async ({ input }) => {
        const voices = await listGoogleVoices(input.language);
        return { voices };
      }),

    /**
     * Synthesize a paragraph of text to MP3 audio.
     * Returns a storage URL that the client can play directly.
     */
    synthesize: publicProcedure
      .input(
        z.object({
          text: z.string().max(5000),
          voiceId: z.string().min(1),  // Google voice name, e.g. "en-US-Wavenet-C"
          languageCode: z.string().min(2), // BCP-47, e.g. "en-US"
          speakingRate: z.number().min(0.25).max(4.0).default(0.9),
        })
      )
      .mutation(async ({ input }) => {
        const audioBuffer = await synthesizeSpeech({
          text: input.text,
          voiceId: input.voiceId,
          languageCode: input.languageCode,
          speakingRate: input.speakingRate,
        });

        // Upload to storage and return a URL the client can stream
        const key = `tts/${randomUUID()}.mp3`;
        const { url } = await storagePut(key, audioBuffer, "audio/mpeg");

        return { url };
      }),
  }),

});

export type AppRouter = typeof appRouter;
