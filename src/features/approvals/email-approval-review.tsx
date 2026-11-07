"use client";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { emailReviewSchema, type EmailReview } from "./email-contract";
import { formatDate, humanize } from "@/lib/format";

export function EmailApprovalReview({ requestId }: { requestId: string }) {
  const token = useRef<string | null>(null);
  const [review, setReview] = useState<EmailReview | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [decision, setDecision] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [identityAcknowledged, setIdentityAcknowledged] = useState(false);
  useEffect(() => {
    function captureToken() {
      const value = new URLSearchParams(location.hash.slice(1)).get("token");
      if (location.hash) history.replaceState(null, "", location.pathname);
      if (value && /^[a-f0-9]{64}$/.test(value)) token.current = value;
    }
    captureToken();
    window.addEventListener("hashchange", captureToken);
    return () => window.removeEventListener("hashchange", captureToken);
  }, []);
  async function submit(action: "preview" | "approved" | "rejected") {
    if (pending) return;
    if (!token.current) {
      setError(
        "Open the complete private link from your email to review this proposal.",
      );
      return;
    }
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/email-approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId,
          token: token.current,
          action,
          acknowledged,
          identityAcknowledged,
        }),
        cache: "no-store",
        redirect: "error",
      });
      if (!response.ok) throw new Error("Review unavailable");
      const data: unknown = await response.json();
      if (action === "preview") {
        setReview(z.object({ review: emailReviewSchema }).parse(data).review);
      } else {
        z.object({ approvalId: z.uuid(), decision: z.literal(action) }).parse(
          data,
        );
        setDecision(action);
        token.current = null;
        setReview(null);
      }
    } catch {
      setError(
        "This review link is no longer available. Open the latest Offboard email or request a new review.",
      );
    } finally {
      setPending(false);
    }
  }
  const button =
    "min-h-12 rounded-lg px-5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-40";
  return (
    <div className="mt-14">
      <p className="text-xs font-medium text-brand">Access review</p>
      <h1 className="mt-3 text-3xl font-medium tracking-tight sm:text-4xl">
        Review an access removal
      </h1>
      <p className="mt-4 text-sm leading-7 text-muted-foreground">
        Confirm the person and review the proposed change before you decide.
      </p>
      {error && (
        <p
          role="alert"
          className="mt-6 rounded-xl border border-critical/25 bg-critical/5 p-5 text-sm leading-7 text-critical"
        >
          {error}
        </p>
      )}
      {decision ? (
        <div
          role="status"
          className="mt-8 rounded-xl border border-border bg-surface p-6"
        >
          <h2 className="text-lg font-medium">
            {decision === "approved" ? "Approval received" : "Removal declined"}
          </h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            {decision === "approved"
              ? "Your approval is saved. The access check will confirm the outcome separately. You can close this page."
              : "Your decision is saved. This request will not remove access."}{" "}
            This link cannot be used again.
          </p>
        </div>
      ) : review ? (
        <section className="mt-8 rounded-xl border border-border bg-surface p-6">
          <h2 className="text-lg font-medium">
            Remove {humanize(review.target.grantType)}
          </h2>
          <dl className="mt-5 grid gap-5 text-sm sm:grid-cols-2">
            {[
              ["Person", review.personName],
              ["GitHub account", `@${review.target.username}`],
              ["Organization", review.target.organization],
              ["Access", humanize(review.target.grantType)],
              ["Authorized recipient", review.recipientEmail],
              ["Link expires", formatDate(review.expiresAt)],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="mt-1 leading-7 break-words">{value}</dd>
              </div>
            ))}
          </dl>
          {!review.actionable && (
            <p className="mt-5 text-sm leading-7 text-attention">
              Approval is currently unavailable for this access. Refresh its
              status to see the latest check, or review the case in Offboard.
            </p>
          )}
          <button
            type="button"
            onClick={() => submit("preview")}
            disabled={pending}
            className={`${button} mt-5 border border-border text-muted-foreground hover:text-foreground`}
          >
            {pending ? "Checking…" : "Refresh check"}
          </button>
          {!review.identityConfirmed && (
            <label className="mt-7 flex items-start gap-3 text-sm leading-7 text-muted-foreground">
              <input
                type="checkbox"
                checked={identityAcknowledged}
                onChange={(event) =>
                  setIdentityAcknowledged(event.target.checked)
                }
                className="mt-1.5 size-4 accent-brand"
              />
              I confirm @{review.target.username} is the correct GitHub account
              for {review.personName}.
            </label>
          )}
          <label className="mt-7 flex items-start gap-3 text-sm leading-7 text-muted-foreground">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(event) => setAcknowledged(event.target.checked)}
              className="mt-1.5 size-4 accent-brand"
            />
            I authorize removing the access shown above.
          </label>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => submit("approved")}
              disabled={
                pending ||
                !acknowledged ||
                !review.actionable ||
                (!review.identityConfirmed && !identityAcknowledged)
              }
              className={`${button} bg-critical text-ink hover:bg-critical/90`}
            >
              {pending ? "Saving decision…" : "Approve exact removal"}
            </button>
            <button
              type="button"
              onClick={() => submit("rejected")}
              disabled={pending}
              className={`${button} border border-border hover:bg-surface-muted`}
            >
              Decline removal
            </button>
          </div>
        </section>
      ) : (
        <div className="mt-8 rounded-xl border border-border bg-surface p-6">
          <h2 className="font-medium">Open your private review</h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            Use the complete link from your email. Review the account,
            organization, and permission before making a decision. Keep the link
            private.
          </p>
          <button
            type="button"
            onClick={() => submit("preview")}
            disabled={pending}
            className={`${button} mt-6 bg-brand text-ink hover:bg-brand/90`}
          >
            {pending ? "Checking review…" : "Review request"}
          </button>
        </div>
      )}
      <p className="mt-6 text-xs leading-6 text-muted-foreground">
        Your decision applies only to the access shown. Other access is reviewed
        separately. Keep this private link to yourself.
      </p>
    </div>
  );
}
