import { describe, expect, it } from "vitest";
import { buildSettingsSummary } from "../lib/settings-summary";

describe("buildSettingsSummary", () => {
  it("shows the current saved language", () => {
    expect(buildSettingsSummary({ childName: "", ageGroup: "5-6", language: "Mandarin" }))
      .toBe("🎂 5-6 yrs  · 🌐 Mandarin");
  });

  it("includes a saved child name without retaining surrounding whitespace", () => {
    expect(buildSettingsSummary({ childName: "  Mei  ", ageGroup: "3-4", language: "Spanish" }))
      .toBe("👤 Mei  · 🎂 3-4 yrs  · 🌐 Spanish");
  });
});
