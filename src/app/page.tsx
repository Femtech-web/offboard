import {
  ArrowRight,
  ArrowUpRight,
  FileCheck2,
  GitBranch,
  LockKeyhole,
  MessagesSquare,
  ScanLine,
  UserRoundCheck,
} from "lucide-react";
import Link from "next/link";
import { Brand } from "@/components/ui/brand";

const workflow = [
  {
    icon: MessagesSquare,
    title: "Start with a conversation.",
    description:
      "Bring the case into your team’s Switch room. Investigate together, with the person and the provider account in clear view.",
  },
  {
    icon: UserRoundCheck,
    title: "Make the decision human.",
    description:
      "Review the discovered permission and the exact proposed removal. An authorized administrator decides what happens next.",
  },
  {
    icon: FileCheck2,
    title: "Keep the evidence.",
    description:
      "Check the provider again after the action. Keep the result, the approval, and the unresolved scope together.",
  },
];
const reportFields = [
  {
    label: "The person",
    detail: "A confirmed account and stable provider ID.",
  },
  {
    label: "The permission",
    detail: "The organization, access type, and checked scope.",
  },
  {
    label: "The decision",
    detail: "The exact correction and who authorized it.",
  },
  {
    label: "The operation",
    detail: "What was requested and what the provider returned.",
  },
  {
    label: "The fresh check",
    detail: "What a separate scan found after the action.",
  },
  {
    label: "The unresolved",
    detail: "Everything unavailable, unchecked, or still accessible.",
  },
];
const primaryAction =
  "inline-flex min-h-13 items-center justify-center gap-6 rounded-lg border border-brand bg-brand px-6 text-sm font-medium text-ink shadow-[0_3px_0_0_#11152f] transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand motion-reduce:transform-none";

export default function HomePage() {
  return (
    <>
      <header className="border-b border-white/10 bg-background">
        <div className="mx-auto flex h-22 max-w-7xl items-center justify-between gap-5 px-5 sm:px-8">
          <Brand />
          <nav
            aria-label="Main navigation"
            className="hidden items-center gap-8 text-sm text-muted-foreground md:flex"
          >
            <a
              href="#workflow"
              className="hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
            >
              How it works
            </a>
            <a
              href="#evidence"
              className="hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
            >
              The evidence
            </a>
            <a
              href="#github"
              className="hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
            >
              GitHub
            </a>
          </nav>
          <Link
            href="/overview"
            className="inline-flex min-h-11 items-center gap-3 rounded-lg border border-white/20 bg-foreground px-4 text-sm font-medium text-ink shadow-[0_3px_0_0_#05070d] transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand motion-reduce:transform-none"
          >
            Open workspace{" "}
            <ArrowUpRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
      </header>
      <main id="main-content">
        <section className="border-b border-white/10 bg-hero bg-[radial-gradient(#b4b6ff12_1px,transparent_1px)] bg-size-[12px_12px]">
          <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 py-18 sm:px-8 sm:py-24 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:py-28">
            <div>
              <p className="mb-7 inline-flex items-center gap-2 rounded-full border border-brand/25 bg-background/35 px-3.5 py-2 text-xs font-medium text-brand">
                <span className="size-1.5 rounded-full bg-brand" /> A clear
                exit. A verifiable outcome.
              </p>
              <h1 className="max-w-2xl text-5xl leading-[1.06] font-medium tracking-[-0.045em] text-white sm:text-6xl lg:text-[4.25rem]">
                <span className="text-brand">People move on.</span>
                <br />
                Their access
                <br className="hidden lg:block" /> should, too.
              </h1>
              <p className="mt-7 max-w-lg text-base leading-8 text-indigo-100/80 sm:text-lg">
                Find forgotten access. Review the decision with your team. Know
                what was removed—and what still needs attention.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link href="/overview" className={primaryAction}>
                  Open Offboard{" "}
                  <ArrowRight aria-hidden="true" className="size-5" />
                </Link>
                <a
                  href="#workflow"
                  className="inline-flex min-h-13 items-center rounded-lg border border-white/20 bg-white/5 px-6 text-sm font-medium text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
                >
                  See how it works
                </a>
              </div>
              <p className="mt-6 flex items-center gap-2 text-xs leading-5 text-indigo-100/75">
                <LockKeyhole aria-hidden="true" className="size-3.5" />{" "}
                Human-approved actions. Independently checked results.
              </p>
            </div>
            <WorkflowIllustration />
          </div>
        </section>
        <section
          id="workflow"
          className="mx-auto max-w-7xl px-5 py-18 sm:px-8 sm:py-24"
          aria-labelledby="workflow-title"
        >
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="text-sm font-medium text-brand">
                One case. A shared understanding.
              </p>
              <h2
                id="workflow-title"
                className="mt-4 max-w-2xl text-3xl leading-tight font-medium tracking-tight sm:text-4xl"
              >
                Less chasing checklists.
                <br />
                <span className="text-muted-foreground">
                  More knowing where things stand.
                </span>
              </h2>
            </div>
            <p className="max-w-xs text-sm leading-7 text-muted-foreground">
              Offboarding brings people, permissions, and decisions together.
              The evidence should stay together, too.
            </p>
          </div>
          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {workflow.map(({ icon: Icon, title, description }) => (
              <article key={title} className="border-t border-border pt-7">
                <div className="mb-7 flex size-15 items-center justify-center rounded-xl border border-brand/15 bg-brand/8">
                  <Icon
                    aria-hidden="true"
                    className="size-8 text-brand"
                    strokeWidth={1.4}
                  />
                </div>
                <h3 className="text-lg font-medium tracking-tight sm:text-xl">
                  {title}
                </h3>
                <p className="mt-3 max-w-sm text-sm leading-7 text-muted-foreground">
                  {description}
                </p>
              </article>
            ))}
          </div>
        </section>
        <section
          id="evidence"
          className="border-y border-border bg-surface/60"
          aria-labelledby="evidence-title"
        >
          <div className="mx-auto grid max-w-7xl gap-12 px-5 py-18 sm:px-8 sm:py-24 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
            <div>
              <p className="text-sm font-medium text-brand">
                The record behind the result
              </p>
              <h2
                id="evidence-title"
                className="mt-4 max-w-md text-3xl leading-tight font-medium tracking-tight sm:text-4xl"
              >
                “Done” deserves
                <br />a little more detail.
              </h2>
              <p className="mt-6 max-w-sm text-sm leading-8 text-muted-foreground">
                A successful API response is a starting point. A verification
                report should explain the action, the fresh check, and the
                limits of what was verified.
              </p>
              <p className="mt-7 max-w-sm border-l-2 border-brand/50 pl-4 text-sm leading-7">
                One verified permission never means every company account is
                cleared.
              </p>
            </div>
            <dl className="divide-y divide-border border-y border-border">
              {reportFields.map(({ label, detail }) => (
                <div
                  key={label}
                  className="grid gap-2 py-5 sm:grid-cols-[135px_1fr] sm:gap-6"
                >
                  <dt className="text-sm font-medium">{label}</dt>
                  <dd className="text-sm leading-7 text-muted-foreground">
                    {detail}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
        <section
          className="mx-auto grid max-w-7xl gap-10 px-5 py-18 sm:px-8 sm:py-24 lg:grid-cols-2 lg:gap-20"
          aria-labelledby="control-title"
        >
          <div>
            <p className="text-sm font-medium text-brand">
              Deliberate by design
            </p>
            <h2
              id="control-title"
              className="mt-4 max-w-md text-3xl leading-tight font-medium tracking-tight sm:text-4xl"
            >
              Keep the conversation open.
              <br />
              <span className="text-muted-foreground">
                Keep the authority clear.
              </span>
            </h2>
          </div>
          <div className="space-y-7">
            <div>
              <h3 className="text-base font-medium">
                A conversation can start an investigation.
              </h3>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">
                Switch gives your team a shared place to ask questions and
                review findings. A room message alone cannot authorize a
                removal.
              </p>
            </div>
            <div className="border-t border-border pt-6">
              <h3 className="text-base font-medium">
                Approval belongs to an administrator.
              </h3>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">
                Review one account, one permission, and one action in the
                authenticated workspace. Each approval expires and can be used
                once.
              </p>
            </div>
            <div className="border-t border-border pt-6">
              <h3 className="text-base font-medium">
                Uncertainty stays visible.
              </h3>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">
                If access remains or a provider cannot be checked, the case
                keeps that unresolved scope. A failed check never becomes a
                green status.
              </p>
            </div>
          </div>
        </section>
        <section
          id="github"
          className="border-y border-border bg-surface/60"
          aria-labelledby="github-title"
        >
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-14 sm:px-8 sm:py-18 lg:grid-cols-[1fr_0.8fr]">
            <div className="flex items-start gap-5">
              <div className="flex size-15 shrink-0 items-center justify-center rounded-xl border border-border bg-background">
                <GitBranch
                  className="size-8 text-brand"
                  strokeWidth={1.4}
                  aria-hidden="true"
                />
              </div>
              <div>
                <p className="text-xs font-medium text-brand">
                  Start with GitHub
                </p>
                <h2
                  id="github-title"
                  className="mt-3 text-2xl font-medium tracking-tight"
                >
                  The access you can actually inspect.
                </h2>
                <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground">
                  Connect an organization you administer. Investigate membership
                  and outside-collaborator access using real provider records,
                  with owners and protected accounts kept out of removal
                  targets.
                </p>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-background px-6 py-5">
              <p className="text-sm font-medium">
                A clear boundary for every check.
              </p>
              <p className="mt-2 text-xs leading-7 text-muted-foreground">
                The organization, account, permission sources, and check time
                belong in the report. Other providers and unchecked access
                remain outside that result.
              </p>
            </div>
          </div>
        </section>
        <section className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-8 px-5 py-18 sm:px-8 sm:py-24">
          <div>
            <p className="text-sm text-brand">Bring clarity to the last day.</p>
            <h2 className="mt-4 max-w-xl text-3xl font-medium tracking-tight sm:text-4xl">
              Start with a person.
              <br />
              Finish with a record.
            </h2>
          </div>
          <Link href="/overview" className={primaryAction}>
            Open your workspace{" "}
            <ArrowRight className="size-5" aria-hidden="true" />
          </Link>
        </section>
      </main>
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-5 px-5 py-8 sm:px-8">
          <Brand compact />
          <p className="text-xs text-muted-foreground">
            When someone leaves, prove their access is gone.
          </p>
          <a
            href="#workflow"
            className="text-xs text-muted-foreground hover:text-brand focus-visible:outline-2 focus-visible:outline-brand"
          >
            Back to the workflow ↑
          </a>
        </div>
      </footer>
    </>
  );
}

function WorkflowIllustration() {
  return (
    <div className="relative">
      <div className="absolute -top-3 left-5 z-10 inline-flex items-center gap-2 rounded-full border-2 border-ink bg-foreground px-3 py-1.5 text-xs font-medium text-ink">
        <span className="size-1.5 rounded-full bg-hero" /> Workflow overview
      </div>
      <div className="rounded-2xl border border-white/25 bg-background p-5 shadow-[0_10px_0_0_#151a37] sm:p-7">
        <div className="flex items-center justify-between gap-3 border-b border-border pb-5">
          <Brand compact />
          <span className="text-xs text-muted-foreground">
            Conversation → evidence
          </span>
        </div>
        <div className="mt-6 flex items-center gap-4 rounded-xl border border-brand/25 bg-brand/8 p-5">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-brand/20 bg-brand/10">
            <MessagesSquare
              aria-hidden="true"
              className="size-6 text-brand"
              strokeWidth={1.5}
            />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">
              A shared Switch room
            </p>
            <p className="mt-1 text-sm font-medium">
              The investigation starts here.
            </p>
          </div>
        </div>
        <div className="ml-11 h-7 border-l border-dashed border-brand/40" />
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-border bg-surface p-4">
            <ScanLine
              aria-hidden="true"
              className="mb-4 size-7 text-brand"
              strokeWidth={1.5}
            />
            <p className="text-sm font-medium">Inspect the access</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Provider permissions
            </p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4">
            <UserRoundCheck
              aria-hidden="true"
              className="mb-4 size-7 text-brand"
              strokeWidth={1.5}
            />
            <p className="text-sm font-medium">Review the action</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Administrator approval
            </p>
          </div>
        </div>
        <div className="ml-11 h-7 border-l border-dashed border-brand/40" />
        <div className="flex items-center gap-4 rounded-xl border border-border bg-surface p-5">
          <FileCheck2
            aria-hidden="true"
            className="size-8 shrink-0 text-brand"
            strokeWidth={1.5}
          />
          <div>
            <p className="text-sm font-medium">Recheck. Record. Resolve.</p>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">
              The outcome and everything still open.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
