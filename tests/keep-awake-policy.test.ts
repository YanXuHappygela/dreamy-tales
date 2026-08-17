import { describe, expect, it } from "vitest";
import { shouldUseKeepAwake } from "../lib/keep-awake-policy";

describe("shouldUseKeepAwake", () => {
  it("does not invoke the Wake Lock API in the web preview", () => {
    expect(shouldUseKeepAwake("web")).toBe(false);
  });

  it("keeps the screen-awake behavior enabled for native bedtime reading", () => {
    expect(shouldUseKeepAwake("ios")).toBe(true);
    expect(shouldUseKeepAwake("android")).toBe(true);
  });
});
