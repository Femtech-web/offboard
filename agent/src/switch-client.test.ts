import { describe, expect, it, vi } from "vitest";
import { investigateThroughSwitch } from "./switch-client";
import { trustedBaseUrl, type AgentConfiguration } from "./config";

const caseId = "b4fce8e6-aba6-4489-b112-2e713d78d2fd";
const configuration: AgentConfiguration = {
  appUrl: new URL("https://offboard.example"),
  switchUrl: new URL("http://127.0.0.1:52425"),
  token: "restricted-bridge-token",
  switchToken: "switch-agent-token",
  scope: {
    caseIds: [caseId],
    roomId: "22a8cad4-b351-47b7-b7ba-c03100cd74fe",
    agentId: "7c96f877-70af-4706-9d52-3fc9ba449271",
    senderId: "authorized-human",
  },
};
const input = {
  action: "request_scan" as const,
  caseId,
  sourceMessageId: `sw_${"b".repeat(32)}`,
};
function transport(sender: string, failure = false) {
  return vi.fn<typeof fetch>(async (url) => {
    if (String(url).endsWith("get_room_detail"))
      return Response.json({
        result: {
          id: configuration.scope.roomId,
          archived: false,
          bridge_display_name: "Mattermost",
          agent_names: ["offboard"],
        },
      });
    if (String(url).endsWith("read_context"))
      return failure
        ? new Response(null, { status: 503 })
        : Response.json({
            result: {
              threads: [
                {
                  root: {
                    id: input.sourceMessageId,
                    kind: "message",
                    sender,
                    body: `@offboard investigate ${caseId}`,
                    timestamp: Date.now(),
                  },
                  replies: [],
                },
              ],
              truncated: false,
            },
          });
    return Response.json({ jobId: "saved-job", approvalGranted: false });
  });
}
describe("trusted local Switch adapter", () => {
  it("re-reads real room context before forwarding an attestation; separates credentials", async () => {
    const fetcher = transport(configuration.scope.senderId);
    await investigateThroughSwitch(configuration, input, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(3);
    const [url, options] = fetcher.mock.calls[2]!;
    expect(String(url)).toBe("https://offboard.example/api/switch");
    expect(options?.body).not.toContain(configuration.switchToken);
    expect(options?.body).not.toContain(configuration.token);
    expect(JSON.parse(String(options?.body)).context.senderId).toBe(
      configuration.scope.senderId,
    );
    expect(options?.redirect).toBe("error");
  });
  it("never reaches the app for a spoofed sender or unavailable Switch context", async () => {
    for (const fetcher of [
      transport("agent"),
      transport(configuration.scope.senderId, true),
    ]) {
      await expect(
        investigateThroughSwitch(configuration, input, fetcher),
      ).rejects.toThrow();
      expect(
        fetcher.mock.calls.some(([url]) => String(url).includes("/api/switch")),
      ).toBe(false);
    }
  });
  it("refuses unallowlisted cases before contacting Switch", async () => {
    const fetcher = transport(configuration.scope.senderId);
    await expect(
      investigateThroughSwitch(
        configuration,
        { ...input, caseId: "other" },
        fetcher,
      ),
    ).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("refuses credential-bearing, redirected-base, or non-loopback plaintext origins", () => {
    for (const url of [
      "https://user:password@example.com",
      "http://example.com",
      "https://example.com/path",
      "https://example.com?secret=value",
    ])
      expect(() => trustedBaseUrl(url)).toThrow();
  });
});
