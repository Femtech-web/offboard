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
