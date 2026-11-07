const labels: Record<string, string> = {
  open: "Open",
  confirmed: "Confirmed",
  unconfirmed: "Unconfirmed",
  not_detected: "Not detected in checked sources",
  approved: "Approved",
  rejected: "Rejected",
  consumed: "Used",
  expired: "Expired",
  investigating: "Investigating",
  needs_review: "Needs review",
  partially_verified: "Partially verified",
  action_failed: "Action failed",
  access_detected: "Access detected",
  awaiting_approval: "Awaiting approval",
  removal_in_progress: "Removal in progress",
  verified_removed: "Verified removed",
  access_remains: "Access remains",
  verification_failed: "Verification failed",
  not_checked: "Not checked",
  connected: "Connected",
  not_connected: "Not connected",
  failed: "Failed",
  unsupported: "Not supported",
  queued: "Queued",
  leased: "In progress",
  succeeded: "Completed",
  uncertain: "Needs verification",
};

export function StatusBadge({ status }: { status: string }) {
  const color =
    status === "verified_removed" ||
    status === "connected" ||
    status === "succeeded"
      ? "border-success/20 bg-success/8 text-success"
      : ["failed", "action_failed", "access_remains"].includes(status)
        ? "border-critical/20 bg-critical/8 text-critical"
        : ["not_checked", "not_connected", "unsupported", "open"].includes(
              status,
            )
          ? "border-border bg-surface-muted/40 text-muted-foreground"
          : "border-attention/20 bg-attention/8 text-attention";
  return (
    <span
      className={`inline-flex w-fit items-center rounded-md border px-2 py-1 text-xs font-medium ${color}`}
    >
      {labels[status] ?? status.replaceAll("_", " ")}
    </span>
  );
}
