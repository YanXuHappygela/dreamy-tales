import { beforeEach, describe, expect, it, vi } from "vitest";

const vertexMock = vi.hoisted(() => ({
  generateContent: vi.fn(),
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent: vertexMock.generateContent };
  },
  ThinkingLevel: { LOW: "LOW" },
}));

import { invokeLLM } from "../server/_core/llm";

describe("Cloud Run Vertex AI LLM adapter", () => {
  beforeEach(() => {
    vertexMock.generateContent.mockReset();
    vertexMock.generateContent.mockResolvedValue({ text: '{"title":"Moon Tale","paragraphs":["Hello"]}' });
    process.env.GOOGLE_CLOUD_PROJECT = "dreamytales-498114";
    process.env.GOOGLE_CLOUD_LOCATION = "global";
  });

  it("uses the Cloud Run service identity path and requests structured low-latency output", async () => {
    const result = await invokeLLM({
      temperature: 0.7,
      maxTokens: 1400,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Return JSON only." },
        { role: "user", content: "Tell a tiny bedtime story." },
      ],
    });

    expect(vertexMock.generateContent).toHaveBeenCalledWith(expect.objectContaining({
      model: "gemini-3.7-flash",
      contents: [{ role: "user", parts: [{ text: "Tell a tiny bedtime story." }] }],
      config: expect.objectContaining({
        systemInstruction: "Return JSON only.",
        maxOutputTokens: 1400,
        temperature: 0.7,
        responseMimeType: "application/json",
        thinkingConfig: { thinkingLevel: "LOW" },
      }),
    }));
    expect(result.choices[0].message.content).toContain("Moon Tale");
  });
});
