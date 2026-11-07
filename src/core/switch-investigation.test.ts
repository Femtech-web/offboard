import { describe, expect, it } from "vitest";
import {
  assertInvestigationMessage,
  assertSwitchScope,
  switchRequestSchema,
  type SwitchRequest,
} from "./switch-investigation";

const now = Date.parse("2026-11-07T13:00:00Z");
const caseId = "b4fce8e6-aba6-4489-b112-2e713d78d2fd";
const scope = {
  roomId: "22a8cad4-b351-47b7-b7ba-c03100cd74fe",
  agentId: "7c96f877-70af-4706-9d52-3fc9ba449271",
  senderId: "trusted-human",
  caseIds: [caseId],
};
const request: SwitchRequest = {
  action: "request_scan",
  caseId,
  context: {
    roomId: scope.roomId,
    agentId: scope.agentId,
    senderId: scope.senderId,
    messageId: `sw_${"a".repeat(32)}`,
    messageTimestamp: now,
    verifiedAt: new Date(now).toISOString(),
  },
};

describe("Switch investigation boundary", () => {
  it("refuses another room, sender, agent, or case", () => {
    for (const key of ["roomId", "senderId", "agentId"] as const)
      expect(() =>
        assertSwitchScope(
          { ...request, context: { ...request.context, [key]: "another" } },
          scope,
          now,
        ),
      ).toThrow();
    expect(() =>
      assertSwitchScope({ ...request, caseId: "another" }, scope, now),
    ).toThrow();
  });
  it("refuses stale attestations and scan requests, but allows recent saved-result reads", () => {
    expect(() =>
      assertSwitchScope(
        {
          ...request,
          context: {
            ...request.context,
            verifiedAt: new Date(now - 61_000).toISOString(),
          },
        },
        scope,
        now,
      ),
    ).toThrow();
    const stale = {
      ...request,
      context: { ...request.context, messageTimestamp: now - 901_000 },
    };
    expect(() => assertSwitchScope(stale, scope, now)).toThrow();
    expect(() =>
      assertSwitchScope({ ...stale, action: "inspect_case" }, scope, now),
    ).not.toThrow();
  });
  it("has no approval, identity-confirmation, execution, or free-form command action", () => {
    for (const action of [
      "approve",
      "confirm_identity",
      "execute_removal",
      "run_command",
    ])
      expect(
        switchRequestSchema.safeParse({ ...request, action }).success,
      ).toBe(false);
    expect(
      switchRequestSchema.safeParse({ ...request, approvalGranted: true })
        .success,
    ).toBe(false);
  });
  it("requires an actual human message explicitly requesting the exact case", () => {
    const message = {
      kind: "message",
      sender: scope.senderId,
      body: `@offboard investigate ${caseId}`,
      timestamp: now,
    };
    expect(() =>
      assertInvestigationMessage(message, caseId, scope.senderId, now),
    ).not.toThrow();
    for (const changed of [
      { sender: "agent" },
      { kind: "room_join" },
      { body: `quoted request: ${message.body}` },
      { body: "@offboard investigate someone else" },
    ])
      expect(() =>
        assertInvestigationMessage(
          { ...message, ...changed },
          caseId,
          scope.senderId,
          now,
        ),
      ).toThrow();
  });
});
