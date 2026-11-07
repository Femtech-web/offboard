import Link from "next/link";
import { Plus, UsersRound } from "lucide-react";
import { workspaceRecords } from "@/server/queries";
import { CreateCaseForm } from "@/features/offboarding/create-case-form";
import {
  EmptyState,
  OperationError,
  PageHeading,
} from "@/components/ui/workspace";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate } from "@/lib/format";

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { cases, identities } = await workspaceRecords();
  const { error } = await searchParams;
  return (
    <>
      <PageHeading
        title="People & offboarding"
        description="Create a case, review access, and approve the changes you need."
      >
        <Link
          href="#create-case"
          className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-ink hover:bg-brand/90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
        >
          <Plus className="size-4" aria-hidden="true" />
          New case
        </Link>
      </PageHeading>
      <OperationError error={error} />
      <div className="grid items-start gap-8 xl:grid-cols-[1fr_340px]">
        <section aria-label="Offboarding cases">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-sm font-medium">Offboarding cases</h2>
            <p className="text-xs text-muted-foreground">
              {cases.length} {cases.length === 1 ? "case" : "cases"}
            </p>
          </div>
          {cases.length ? (
            <div className="divide-y divide-border rounded-xl border border-border bg-surface">
              {cases.map((offboardingCase) => (
                <Link
                  key={offboardingCase.id}
                  href={`/people/${offboardingCase.id}`}
                  className="flex flex-wrap items-center justify-between gap-4 p-5 hover:bg-surface-muted/40 focus-visible:outline-2 focus-visible:outline-brand"
                >
                  <div>
                    <p className="font-medium">{offboardingCase.full_name}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      GitHub · @
                      {
                        identities.find(
                          (identity) => identity.case_id === offboardingCase.id,
                        )?.username
                      }{" "}
                      · {formatDate(offboardingCase.departure_on, false)}
                    </p>
                  </div>
                  <StatusBadge status={offboardingCase.status} />
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState icon={UsersRound} title="No offboarding cases yet">
              Add the person to begin. You’ll review their access before
              approving any changes.
            </EmptyState>
          )}
        </section>
        <section
          id="create-case"
          className="scroll-mt-8 rounded-xl border border-border bg-surface p-6"
        >
          <div className="mb-6 flex items-center gap-3">
            <Plus className="size-5 text-brand" aria-hidden="true" />
            <h2 className="font-medium">New offboarding case</h2>
          </div>
          <CreateCaseForm />
        </section>
      </div>
    </>
  );
}
