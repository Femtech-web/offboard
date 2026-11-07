import { createHash } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ sessionRpc: vi.fn(), serviceRpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("./auth", () => ({
  requireAdministrator: async () => ({ client: { rpc: mocks.sessionRpc } }),
}));
vi.mock("./supabase/service", () => ({
  createServiceClient: () => ({ rpc: mocks.serviceRpc }),
}));
import {
  performEmailDecision,
  sendApprovalEmail,
  submitApprovalEmail,
  EmailDeliveryRejected,
  dispatchNextApprovalEmail,
} from "./approval-email";

const id = "2080d791-6d6b-43e2-9226-32ca3e52aac5";
const request = {
  id,
  caseId: id,
  personName: "Test fixture",
  recipientEmail: "admin@example.invalid",
  expiresAt: "2026-11-07T12:15:00Z",
  target: {
    organizationId: "7",
    organization: "controlled-org",
    providerUserId: "42",
    username: "controlled-user",
    grantType: "organization_membership",
    resourceIdentifier: "github:organization:7",
  },
};
beforeEach(() => {
  mocks.sessionRpc
    .mockReset()
    .mockResolvedValue({ data: request, error: null });
  mocks.serviceRpc.mockReset().mockResolvedValue({ data: null, error: null });
  vi.stubEnv("RESEND_API_KEY", "test-email-key");
  vi.stubEnv("APPROVAL_EMAIL_FROM", "Offboard <notifications@paayee.org>");
  vi.stubEnv("OFFBOARD_APP_URL", "http://127.0.0.1:3000");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it("uses Resend once with a request-bound idempotency key, saving only a hash and provider ID", async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(Response.json({ id: "resend-test-id" }));
  vi.stubGlobal("fetch", fetcher);
  await sendApprovalEmail(id);
  expect(fetcher).toHaveBeenCalledTimes(1);
  const [url, options] = fetcher.mock.calls[0]!;
  expect(url).toBe("https://api.resend.com/emails");
  expect(options?.redirect).toBe("error");
  expect(new Headers(options?.headers).get("idempotency-key")).toBe(
    `offboard-approval/${id}`,
  );
  const message = JSON.parse(String(options?.body));
  const rawToken = /#token=([a-f0-9]{64})/.exec(message.text)?.[1];
  expect(rawToken).toBeTruthy();
  expect(mocks.sessionRpc).toHaveBeenCalledWith(
    "offboard_request_approval_email",
    {
      p_finding_id: id,
      p_token_hash: createHash("sha256").update(rawToken!).digest("hex"),
    },
  );
  expect(JSON.stringify(mocks.serviceRpc.mock.calls)).not.toContain(rawToken);
  expect(mocks.serviceRpc).toHaveBeenCalledWith(
    "offboard_record_approval_email_delivery",
    {
      p_request_id: id,
      p_status: "accepted",
      p_provider_message_id: "resend-test-id",
    },
  );
});
it.each([false, true])(
  "leaves ambiguous delivery unusable and never automatically resends (timeout=%s)",
  async (timeout) => {
    const fetcher = vi.fn<typeof fetch>();
    if (timeout)
      fetcher.mockRejectedValue(new Error("untrusted provider detail"));
    else fetcher.mockResolvedValue(Response.json({ malformed: true }));
    vi.stubGlobal("fetch", fetcher);
    await expect(sendApprovalEmail(id)).rejects.toThrow(
      "email_confirmation_unavailable",
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(mocks.serviceRpc).toHaveBeenLastCalledWith(
      "offboard_record_approval_email_delivery",
      { p_request_id: id, p_status: "unknown", p_provider_message_id: null },
    );
  },
);
it("records provider rejection separately from uncertain delivery", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response("sensitive provider detail", { status: 403 }),
      ),
  );
  await expect(sendApprovalEmail(id)).rejects.toThrow(
    "email_confirmation_unavailable",
  );
  expect(mocks.serviceRpc).toHaveBeenLastCalledWith(
    "offboard_record_approval_email_delivery",
    { p_request_id: id, p_status: "failed", p_provider_message_id: null },
  );
  await expect(
    submitApprovalEmail("test", id, {
      from: "Offboard <a@example.invalid>",
      to: ["b@example.invalid"],
      subject: "test",
      text: "test",
    }),
  ).rejects.toBeInstanceOf(EmailDeliveryRejected);
});
it("refuses approval without explicit acknowledgement before making a decision RPC", async () => {
  await expect(
    performEmailDecision({
      requestId: id,
      token: "a".repeat(64),
      action: "approved",
    }),
  ).rejects.toThrow("acknowledgement_required");
  expect(mocks.serviceRpc).not.toHaveBeenCalled();
});

it("dispatches a persisted scan proposal without giving the worker a recipient, token, or approval", async () => {
  mocks.serviceRpc.mockImplementation(async (name: string) => {
    if (name === "offboard_claim_email_dispatch")
      return { data: { id }, error: null };
    if (name === "offboard_prepare_automatic_email")
      return { data: request, error: null };
    return { data: null, error: null };
  });
  const fetcher = vi
    .fn()
    .mockResolvedValue(Response.json({ id: "automatic-provider-id" }));
  vi.stubGlobal("fetch", fetcher);
  expect(await dispatchNextApprovalEmail()).toBeUndefined();
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(JSON.parse(fetcher.mock.calls[0]![1].body).to).toEqual([
    request.recipientEmail,
  ]);
  expect(mocks.serviceRpc).toHaveBeenLastCalledWith(
    "offboard_finish_email_dispatch",
    { p_dispatch_id: id, p_status: "accepted" },
  );
  expect(
    mocks.serviceRpc.mock.calls.some(([name]) =>
      String(name).includes("decide"),
    ),
  ).toBe(false);
  expect(mocks.sessionRpc).not.toHaveBeenCalled();
});

it("skips an ineligible automatic proposal without sending or approving", async () => {
  mocks.serviceRpc.mockImplementation(async (name: string) => ({
    data: name === "offboard_claim_email_dispatch" ? { id } : null,
    error:
      name === "offboard_prepare_automatic_email" ? { code: "denied" } : null,
  }));
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  await dispatchNextApprovalEmail();
  expect(fetcher).not.toHaveBeenCalled();
  expect(mocks.serviceRpc).toHaveBeenLastCalledWith(
    "offboard_finish_email_dispatch",
    { p_dispatch_id: id, p_status: "skipped" },
  );
});

it("keeps an ambiguous automatic send uncertain without retrying", async () => {
  mocks.serviceRpc.mockImplementation(async (name: string) => ({
    data:
      name === "offboard_claim_email_dispatch"
        ? { id }
        : name === "offboard_prepare_automatic_email"
          ? request
          : null,
    error: null,
  }));
  const fetcher = vi.fn().mockRejectedValue(new Error("timeout"));
  vi.stubGlobal("fetch", fetcher);
  await dispatchNextApprovalEmail();
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(mocks.serviceRpc).toHaveBeenLastCalledWith(
    "offboard_finish_email_dispatch",
    { p_dispatch_id: id, p_status: "unknown" },
  );
});

it("does not consume the queue when email is not configured", async () => {
  vi.stubEnv("RESEND_API_KEY", "");
  await dispatchNextApprovalEmail();
  expect(mocks.serviceRpc).not.toHaveBeenCalled();
});
