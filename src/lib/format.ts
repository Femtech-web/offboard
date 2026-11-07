export function formatDate(
  value: string | null | undefined,
  includeTime = true,
) {
  if (!value) return "Not checked";
  return (
    new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      ...(includeTime
        ? { timeStyle: "short", timeZone: "UTC" }
        : { timeZone: "UTC" }),
    }).format(new Date(value)) + (includeTime ? " UTC" : "")
  );
}
export function humanize(value: string) {
  return value.replaceAll("_", " ");
}

export function activityLabel(value: string, kind?: unknown) {
  if (value === "job_completed") {
    return kind === "scan"
      ? "Access check finished"
      : kind === "execute_removal"
        ? "Removal processed"
        : "Connection check finished";
  }
  const labels: Record<string, string> = {
    case_created: "Case created",
    integration_check_requested: "Connection check requested",
    scan_requested: "Access check requested",
    switch_investigation_requested: "Investigation requested in Switch",
    identity_confirmed: "Account confirmed",
    removal_approved: "Removal approved",
    removal_rejected: "Removal rejected",
    approval_consumed: "Approved removal started",
    job_retries_exhausted: "Check could not be completed",
    approval_email_requested: "Review email requested",
    email_review_scan_requested: "Access recheck requested",
    removal_reverified: "Removal verification updated",
  };
  return labels[value] ?? humanize(value);
}

export function actorLabel(value: string) {
  const labels: Record<string, string> = {
    human: "Administrator",
    worker: "Offboard",
    system: "Offboard",
    agent: "Switch agent",
  };
  return labels[value] ?? humanize(value);
}
