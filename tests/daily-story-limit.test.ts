import { describe, expect, it } from "vitest";
import { DAILY_STORY_LIMIT, ipToGuestKey } from "../server/db";

describe("anonymous daily story limit", () => {
  it("sets the requested limit to fifty stories per day", () => {
    expect(DAILY_STORY_LIMIT).toBe(50);
  });

  it("derives a stable one-way storage key from an IP without storing the raw address", () => {
    const key = ipToGuestKey("203.0.113.42");

    expect(key).toBe(ipToGuestKey("203.0.113.42"));
    expect(key).not.toBe(ipToGuestKey("203.0.113.43"));
    expect(key).toMatch(/^[a-f0-9]{64}$/);
    expect(String(key)).not.toContain("203.0.113.42");
  });
});
