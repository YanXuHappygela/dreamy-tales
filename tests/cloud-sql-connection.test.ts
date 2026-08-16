import { afterEach, describe, expect, it } from "vitest";
import { getDatabaseConnectionConfig } from "../server/db";

const original = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in original)) delete process.env[key];
  }
  Object.assign(process.env, original);
});

describe("Cloud SQL connection configuration", () => {
  it("uses the Cloud Run Unix socket when socket settings are present", () => {
    process.env.DATABASE_SOCKET_PATH = "/cloudsql/dreamytales-498114:us-central1:dreamy-tales-db";
    process.env.DATABASE_USER = "dreamy_tales";
    process.env.DATABASE_PASSWORD = "secret";
    process.env.DATABASE_NAME = "dreamy_tales";

    expect(getDatabaseConnectionConfig()).toEqual(expect.objectContaining({
      socketPath: process.env.DATABASE_SOCKET_PATH,
      user: "dreamy_tales",
      database: "dreamy_tales",
    }));
  });

  it("retains the DATABASE_URL configuration path for local development", () => {
    delete process.env.DATABASE_SOCKET_PATH;
    process.env.DATABASE_URL = "mysql://local:password@localhost:3306/dreamy_tales";
    expect(getDatabaseConnectionConfig()).toBe(process.env.DATABASE_URL);
  });
});
