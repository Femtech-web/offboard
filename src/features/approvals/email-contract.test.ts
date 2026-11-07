import { describe, expect, it } from "vitest";
import {
  approvalEmailMessage,
  approvalReviewUrl,
  approvalSenderSchema,
  emailReviewInput,
} from "./email-contract";

const id = "2080d791-6d6b-43e2-9226-32ca3e52aac5";
const token = "a".repeat(64);
const reviewFixture = {
  id,
  personName: "Controlled test person",
  recipientEmail: "admin@example.invalid",
  expiresAt: "2026-11-07T12:15:00Z",
  actionable: true,
  target: {
    organizationId: "7",
    organization: "controlled-org",
    providerUserId: "42",
    username: "controlled-user",
    grantType: "organization_membership" as const,
    resourceIdentifier: "github:organization:7",
  },
};

describe("private approval email", () => {
  it("keeps the capability out of the HTTP URL and permits loopback development", () => {
    for (const origin of [
      "https://offboard.example",
      "http://127.0.0.1:3000",
      "http://localhost:3000",
    ]) {
      const link = new URL(approvalReviewUrl(origin, id, token));
      expect(link.pathname).toBe(`/email-approvals/${id}`);
      expect(link.search).toBe("");
      expect(link.hash).toBe(`#token=${token}`);
    }
  });
  it.each([
    "http://offboard.example",
    "https://user:secret@offboard.example",
    "https://offboard.example/path",
    "https://offboard.example?tracking=1",
    "javascript:alert(1)",
  ])("rejects an unsafe application origin: %s", (origin) => {
    expect(() => approvalReviewUrl(origin, id, token)).toThrow();
  });
  it("validates the sender and exact target without HTML or automatic approval links", () => {
    expect(
      approvalSenderSchema.safeParse(
        "Offboard <notifications@paayee.org>\r\nBcc: x@example.invalid",
      ).success,
    ).toBe(false);
    const message = approvalEmailMessage(
      "Offboard <notifications@paayee.org>",
      approvalReviewUrl("https://offboard.example", id, token),
      reviewFixture,
    );
    expect(message.to).toEqual([reviewFixture.recipientEmail]);
    expect(message.text).toContain("@controlled-user");
    expect(message.text).toContain("controlled-org");
    expect(message.text).toContain("Nothing changes until you approve");
    expect(message).not.toHaveProperty("html");
    expect(message.text).not.toMatch(
      /worker|preflight|organization_membership|github:organization/,
    );
    expect(
      emailReviewInput.safeParse({
        requestId: id,
        token,
        action: "approved",
        approvedBy: id,
      }).success,
    ).toBe(false);
  });
});
