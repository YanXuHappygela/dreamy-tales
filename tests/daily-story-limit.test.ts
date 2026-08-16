import { describe, expect, it } from "vitest";
import { DAILY_STORY_LIMIT, ipToGuestId } from "../server/db";

describe("anonymous daily story limit", () => {
  it("sets the requested limit to ten stories per day", () => {
    expect(DAILY_STORY_LIMIT).toBe(10);
  });

  it("derives a stable negative storage key from an IP without storing the raw address", () => {
    const key = ipToGuestId("203.0.113.42");

    expect(key).toBe(ipToGuestId("203.0.113.42"));
    expect(key).not.toBe(ipToGuestId("203.0.113.43"));
    expect(key).toBeLessThan(0);
    expect(String(key)).not.toContain("203.0.113.42");
  });
});
