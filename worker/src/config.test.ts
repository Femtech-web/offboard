import { describe, expect, it } from "vitest";

import { readWorkerConfiguration } from "./config";

describe("worker configuration", () => {
  it("reports invalid field names without echoing secrets or input", () => {
    const environment = {
      GITHUB_ACCESS_TOKEN: "sensitive-test-value",
      GITHUB_ORGANIZATION: "https://untrusted.example/private-value",
    };

    expect(() => readWorkerConfiguration(environment)).toThrow(
      "GITHUB_ORGANIZATION",
    );
    try {
      readWorkerConfiguration(environment);
    } catch (error) {
      expect(String(error)).not.toContain("sensitive-test-value");
      expect(String(error)).not.toContain("private-value");
    }
  });

  it("fails closed when credentials or an organization are missing", () => {
    expect(() => readWorkerConfiguration({})).toThrow(
      "GITHUB_ACCESS_TOKEN, GITHUB_ORGANIZATION",
    );
  });

  it("preserves stable protected account IDs and rejects invalid IDs", () => {
    const environment = {
      GITHUB_ACCESS_TOKEN: "test-only-token",
      GITHUB_ORGANIZATION: "test-org",
      GITHUB_PROTECTED_USER_IDS: "42, 99",
    };

    expect(readWorkerConfiguration(environment).protectedUserIds).toEqual([
      "42",
      "99",
    ]);
    expect(() =>
      readWorkerConfiguration({
        ...environment,
        GITHUB_PROTECTED_USER_IDS: "owner",
      }),
    ).toThrow("GITHUB_PROTECTED_USER_IDS");
  });
});
