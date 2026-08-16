# Dreamy Tales: Current LLM Configuration

## Active Model

The story-generation route does not specify a model per request. It therefore uses the adapter default:

| Runtime | Model | Authentication |
|---|---|---|
| Cloud Run, when `GOOGLE_CLOUD_PROJECT` is set | `GOOGLE_GENAI_MODEL`, defaulting to `gemini-3-flash-preview` | Attached Cloud Run service account through Vertex AI |
| Local/Manus development, when `GOOGLE_CLOUD_PROJECT` is not set | `gemini-3-flash-preview` | Manus Forge API |

The intended production configuration is **Gemini 3.7 Flash** through Vertex AI, selected by the `STORY_LLM_MODEL` environment variable.

## Generation Settings

| Setting | Current value |
|---|---|
| Temperature | `STORY_LLM_TEMPERATURE`, defaulting to `0.7` and validated from `0`–`2` |
| Structured output | JSON object (`title` and `paragraphs`) |
| Thinking level on Vertex AI | `MINIMAL` to reduce latency |
| Target narration pace | 132 words per minute |
| Target story words | `selected minutes × 132` |
| Output token budget | `max(1400, ceil(target words × 1.5) + 450)` |
| Retry | One JSON-only retry if the initial response cannot be parsed |

## Active Prompt Template

```text
You are a gentle, imaginative children's story author who writes soothing bedtime stories.

[Child name clause, when configured]
[Age-specific reading guidance]
[Optional caregiver story idea]
[Language instruction: English, Simplified Chinese, or Spanish]

Write a bedtime story with the following details:
- Main character: A [character]
- Setting: [scenario]
- Story style/mood: [style]
- Target length: approximately [minutes × 132] words

Requirements:
- Write in simple, warm, soothing language appropriate for the child's age.
- End gently to help children drift off to sleep.
- Use short sentences and vivid but soft imagery.
- Include a small adventure or challenge and a peaceful resolution.
- Do not include scary, violent, or overly exciting content.
- Keep the story cozy and reassuring.
- Give the main character a name different from the child's name.
- Make the very last paragraph end with the exact localized line:
  "Good night, sweet dreams, [child name]."
  (English), "晚安，祝你美梦，[child name]。" (Mandarin), or
  "Buenas noches, dulces sueños, [child name]." (Spanish).

Return only this JSON object, with no markdown:
{
  "title": "A short, magical story title",
  "paragraphs": ["First paragraph...", "Second paragraph..."]
}

Each paragraph should contain 2–4 sentences. Aim for approximately
[target words ÷ 60] paragraphs.
```

The server also validates the response and appends the localized closing line if the model omits it.
