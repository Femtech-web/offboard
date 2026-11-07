import type { SwitchContext } from "@/core/switch-investigation";
import { formatDate } from "@/lib/format";

export function InvestigationSource({
  context,
}: {
  context: SwitchContext | null;
}) {
  if (!context) return null;
  return (
    <section className="rounded-xl border border-border bg-surface p-6">
      <h2 className="text-lg font-medium">Switch investigation source</h2>
      <p className="mt-2 text-sm leading-7 text-muted-foreground">
        The local adapter verified this request against the configured
        Mattermost room’s saved Switch context. It requested a read-only scan
        and granted no removal approval.
      </p>
      <dl className="mt-5 grid gap-4 text-xs sm:grid-cols-2">
        {[
          ["Room ID", context.roomId],
          ["Source message", context.messageId],
          ["Verified sender", context.senderId],
          [
            "Request received",
            formatDate(new Date(context.messageTimestamp).toISOString()),
          ],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="mt-2 leading-6 break-all">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
