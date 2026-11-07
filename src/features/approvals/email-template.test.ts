import { expect, it } from "vitest";
import { renderApprovalEmail } from "./email-template";

it("renders a readable HTML email with an escaped identity and an explicit review button", async () => {
  const html = await renderApprovalEmail(
    {
      id: "2080d791-6d6b-43e2-9226-32ca3e52aac5",
      personName: '<script>alert("test")</script>',
      recipientEmail: "admin@example.invalid",
      expiresAt: "2026-11-07T13:41:00Z",
      target: {
        organization: "controlled-org",
        organizationId: "7",
        username: "controlled-user",
        providerUserId: "42",
        grantType: "organization_membership",
        resourceIdentifier: "github:organization:7",
      },
    },
    "https://offboard.example/email-approvals/2080d791-6d6b-43e2-9226-32ca3e52aac5#token=test-only",
  );
  expect(html).toContain("Review access removal");
  expect(html).toContain("@controlled-user");
  expect(html).toContain("&lt;script&gt;");
  expect(html).not.toMatch(
    /<script|<img|worker|preflight|organization_membership|github:organization/,
  );
  expect(html).toContain("#token=test-only");
  expect(html).toContain("font-family");
});
