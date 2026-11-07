import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("./approval-email", () => ({ performEmailDecision: vi.fn() }));
import { performEmailDecision } from "./approval-email";
import * as route from "@/app/api/email-approvals/route";

beforeEach(() => {
  vi.mocked(performEmailDecision).mockReset();
  vi.stubEnv("OFFBOARD_APP_URL", "https://offboard.example");
});
afterEach(() => vi.unstubAllEnvs());
it("checks the configured browser origin even when Next uses an internal localhost URL", async () => {
  vi.stubEnv("OFFBOARD_APP_URL", "http://127.0.0.1:3000");
  vi.mocked(performEmailDecision).mockResolvedValue({
    approvalId: "2080d791-6d6b-43e2-9226-32ca3e52aac5",
    decision: "approved",
  });
  const response = await route.POST(
    new Request("http://localhost:3000/api/email-approvals", {
      method: "POST",
      headers: {
        origin: "http://127.0.0.1:3000",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        requestId: "2080d791-6d6b-43e2-9226-32ca3e52aac5",
        token: "a".repeat(64),
        action: "preview",
      }),
    }),
  );
  expect(response.status).toBe(200);
  expect(performEmailDecision).toHaveBeenCalledOnce();
});
it("bounds the body before attempting a privileged operation", async () => {
  const response = await route.POST(
    new Request("https://offboard.example/api/email-approvals", {
      method: "POST",
      headers: {
        origin: "https://offboard.example",
        "content-type": "application/json",
      },
      body: "x".repeat(1501),
    }),
  );
  expect(response.status).toBe(413);
  expect(performEmailDecision).not.toHaveBeenCalled();
});
it("exposes no GET approval and refuses cross-site, missing-origin, malformed, and impersonated requests", async () => {
  expect(route).not.toHaveProperty("GET");
  for (const [origin, body] of [
    ["https://evil.example", "{}"],
    ["", "{}"],
    ["https://offboard.example", "{}"],
    [
      "https://offboard.example",
      JSON.stringify({
        requestId: "2080d791-6d6b-43e2-9226-32ca3e52aac5",
        token: "a".repeat(64),
        action: "approved",
        administratorId: "untrusted",
      }),
    ],
  ]) {
    const response = await route.POST(
      new Request("https://offboard.example/api/email-approvals", {
        method: "POST",
        headers: {
          origin: origin!,
          "content-type": "application/json",
          authorization: "Bearer switch-token-is-not-approval",
        },
        body,
      }),
    );
    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  }
  expect(performEmailDecision).not.toHaveBeenCalled();
});
