import { afterEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("./supabase/service", () => ({ createServiceClient: vi.fn() }));
import { POST } from "@/app/api/switch/route";

afterEach(() => vi.unstubAllEnvs());
it("refuses missing, worker, and incorrect bridge credentials", async () => {
  vi.stubEnv("OFFBOARD_SWITCH_TOKEN", "s".repeat(64));
  vi.stubEnv("OFFBOARD_WORKER_TOKEN", "w".repeat(64));
  for (const token of ["", "w".repeat(64), "x".repeat(64)]) {
    const response = await POST(
      new Request("http://localhost/api/switch", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: "{}",
      }),
    );
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  }
});
it("refuses an approval action even with a valid bridge credential", async () => {
  vi.stubEnv("OFFBOARD_SWITCH_TOKEN", "s".repeat(64));
  const response = await POST(
    new Request("http://localhost/api/switch", {
      method: "POST",
      headers: { Authorization: `Bearer ${"s".repeat(64)}` },
      body: JSON.stringify({
        action: "approve",
        caseId: "b4fce8e6-aba6-4489-b112-2e713d78d2fd",
      }),
    }),
  );
  expect(response.status).toBe(403);
});
