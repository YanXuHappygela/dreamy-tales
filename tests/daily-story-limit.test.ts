import { describe, expect, it } from "vitest";
import { createDailyLimitReachedLog, DAILY_STORY_LIMIT, getUtcDailyKey, ipToGuestKey } from "../server/db";

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

  it("resets on the UTC midnight boundary", () => {
    expect(getUtcDailyKey(new Date("2026-08-16T23:59:59.999Z"))).toBe("2026-08-16");
    expect(getUtcDailyKey(new Date("2026-08-17T00:00:00.000Z"))).toBe("2026-08-17");
  });

  it("creates an aggregate monitoring event without a client identifier", () => {
    const event = createDailyLimitReachedLog("2026-08-17");

    expect(event).toEqual({
      severity: "WARNING",
      event: "daily_limit_reached",
      service: "dreamy-tales-api",
      limit: 50,
      resetBoundary: "UTC_MIDNIGHT",
      date: "2026-08-17",
    });
    expect(JSON.stringify(event)).not.toContain("203.0.113");
    expect(JSON.stringify(event)).not.toMatch(/[a-f0-9]{64}/);
  });
});
