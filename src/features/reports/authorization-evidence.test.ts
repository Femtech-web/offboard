import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { approvalRecord, operationRecord } from "@/core/records";
import { AuthorizationEvidence } from "./authorization-evidence";

const approval = approvalRecord.parse({
  id: "2080d791-6d6b-43e2-9226-32ca3e52aac5",
  finding_id: "c53225ae-102d-4ee6-a081-c82bb2a0a1bc",
  approved_by: "016654cb-ee43-4bd9-938e-91a1ea63b115",
  status: "approved",
  created_at: "2026-11-07T12:00:00Z",
  expires_at: "2026-11-07T12:15:00Z",
  consumed_at: null,
  authorization_method: "dashboard",
  email_request_id: null,
  target_snapshot: {
    organizationId: "7",
    organization: "controlled-org",
    providerUserId: "42",
    username: "controlled-user",
    grantType: "organization_membership",
    resourceIdentifier: "github:organization:7",
  },
});

describe("approval evidence without successful execution", () => {
  it("keeps the exact authorization visible when no provider operation was saved", () => {
    const html = renderToStaticMarkup(
      createElement(AuthorizationEvidence, { approval }),
    );
    expect(html).toContain(approval.approved_by);
    expect(html).toContain("controlled-user");
    expect(html).toContain("controlled-org");
    expect(html).toContain("Not consumed");
    expect(html).toContain("No provider operation was saved");
    expect(html).not.toContain("Verified removed");
  });
  it("does not turn an HTTP 204 response into verified-removal wording", () => {
    const operation = operationRecord.parse({
      id: "aa23d10b-b782-49b9-915a-bb532e21b77d",
      approval_id: approval.id,
      finding_id: approval.finding_id,
      job_id: "2797be7d-c425-468a-9c1e-0efed3b52b30",
      action: "organization_membership",
      status: "verification_failed",
      preflight: {},
      provider_response: {
        status: 204,
        outcome: "accepted",
        requestId: "test-provider-request",
        attemptedAt: "2026-11-07T12:01:00Z",
      },
      verification: null,
      attempted_at: "2026-11-07T12:01:00Z",
      verified_at: null,
    });
    const html = renderToStaticMarkup(
      createElement(AuthorizationEvidence, {
        approval: {
          ...approval,
          status: "consumed",
          consumed_at: "2026-11-07T12:00:30Z",
        },
        operation,
      }),
    );
    expect(html).toContain("HTTP 204");
    expect(html).toContain("Verification failed");
    expect(html).toContain("No successful rescan recorded");
    expect(html).not.toContain("Verified removed");
  });
});
