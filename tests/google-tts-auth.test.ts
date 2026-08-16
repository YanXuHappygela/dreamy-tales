import { afterEach, describe, expect, it } from "vitest";
import { usesCloudRunIdentity } from "../server/googleTts";

const originalProject = process.env.GOOGLE_CLOUD_PROJECT;

afterEach(() => {
  if (originalProject === undefined) delete process.env.GOOGLE_CLOUD_PROJECT;
  else process.env.GOOGLE_CLOUD_PROJECT = originalProject;
});

describe("Google Cloud TTS authentication selection", () => {
  it("uses the Cloud Run service identity when a Google Cloud project is configured", () => {
    process.env.GOOGLE_CLOUD_PROJECT = "dreamytales-498114";
    expect(usesCloudRunIdentity()).toBe(true);
  });

  it("uses the local API-key path outside Cloud Run", () => {
    delete process.env.GOOGLE_CLOUD_PROJECT;
    expect(usesCloudRunIdentity()).toBe(false);
  });
});
