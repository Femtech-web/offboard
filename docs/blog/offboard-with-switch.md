# Offboard: investigating access in Switch, with human approval and verification

_Build notes · 7 November 2026 · [Try Offboard](https://offboard-mu.vercel.app)._

I have experienced the problem firsthand. After leaving a team, I still had access to its GitHub, Apple, and Vercel accounts. I could still see new code updates after my work there had ended.

A missed offboarding step can leave internal code and company information accessible to someone who no longer needs it. Teams need to find those permissions, remove the right access, and check that the change took effect.

That is why we built Offboard for founders, engineering leads, and IT/security administrators. Its first connector checks GitHub organization membership and outside-collaborator access. A Codex agent investigates with the human in a real Switch-connected Mattermost room. The human approves the exact removal, and Offboard carries it out and independently verifies the result.

Our goal for [Flip the Switch's Best Business Workflow track](https://www.wemakedevs.org/hackathons/switch) is one reproducible collaboration: a person asks about a departure, the agent discovers a real access grant, the person approves its removal, and the team receives a saved result with its limitations intact.

## Where Switch fits

The investigation starts in `security-offboarding`, a Mattermost room connected through Switch Console. The human names an Offboard case:

```text
@offboard investigate <case UUID>
```

The agent reads the shared room context and has three application tools: `inspect_case`, `request_scan`, and `get_job`. It can inspect a case, queue a read-only investigation, and discuss the saved findings and report links with the human.

The adapter checks the actual room context, configured human sender, and explicitly allowed case before requesting work. The model receives neither the GitHub credential nor database, worker, or email secrets. It has no approval or removal tool. In our local configuration, shell access, unrelated connectors, and permission bypass are disabled.

Switch gives the team a shared place to investigate and coordinate. The dashboard presents the same persisted records and the human decision. Sending a chat message cannot authorize a provider mutation.

## The human decision

A real scan resolves the GitHub account and saves the permissions it actually discovered. Eligible findings automatically produce a private review email for the confirmed administrator. The recipient can review the person, GitHub username, organization, and exact proposed change without another dashboard sign-in.

Opening the email or its link makes no access change. An unconfirmed account requires a separate explicit identity acknowledgement, followed by the removal decision. The link expires after 15 minutes and allows one decision. The server checks the recipient's current administrator role, the target, and the finding's freshness again.

That convenience has a clear boundary: the private link grants this narrow decision to its holder, so forwarding it delegates that capability. We store its hash, keep it out of agent results, and distinguish email submission from human approval. Owners, the integration's own account, and protected identities cannot be removed through this workflow.

## An accepted response was not enough

The complete live journey used a controlled ordinary-member account we were explicitly authorized to remove from our test organization, `Optimus-pro-orgs`. The owner/integration account remained protected. A real human room request led to a Codex scan through Switch; the resulting proposal email was sent automatically.

The human received the proposal, confirmed the identity, and approved the exact membership removal. GitHub accepted the operation with HTTP 204. The immediate independent check still reported access.

Offboard saved **access remains**. It did not turn the accepted response into a security success.

A later read-only verification confirmed that the membership was absent. A new report recorded **verified removed**, while the original report remained unchanged. The follow-up did not repeat the deletion. Provider propagation delay is a possible explanation for the difference, but the evidence alone does not establish its cause.

| Actual event                          | Recorded time, UTC |
| ------------------------------------- | ------------------ |
| Human email approval                  | 14:23:44           |
| GitHub accepted the removal           | 14:23:48           |
| Immediate check still reported access | 14:23:50           |
| Separate follow-up confirmed absence  | 14:23:58           |

In an earlier controlled test, the user also received GitHub's own organization-removal notification. Our redesigned verification receipt rendered in Gmail but reached Spam; the earlier approval email reached the inbox. We checked the verified Resend sender configuration and retained that delivery limitation rather than claiming guaranteed inbox placement.

These emails support the saved rescan. They do not replace it.

## Keeping evidence and coverage honest

The Next.js application uses Supabase Auth and PostgreSQL. Provider credentials remain with the local TypeScript worker, which polls authenticated application endpoints. Switch, Mattermost, and Codex also run locally for the current development setup.

Approval binds an immutable target and expires. Execution rechecks the exact identity, organization, permission, protection rules, and single-use approval before changing provider access. An uncertain destructive operation is not automatically repeated.

Reports preserve the person, permission, human decision, provider response, independent check, and remaining scope. A verified GitHub membership removal leaves overall coverage **partially verified**. Vercel is not implemented; other organizations, systems, and unexamined permissions remain unchecked.

The current checks include 70 offline tests and 110 transactional PostgreSQL safety checks, with all database fixtures rolled back. Live unauthorized worker requests and attempted approval through the investigation bridge were refused. Those tests complement the provider evidence; they do not establish an untested integration.

## What worked, and what we would improve

Switch let us use an existing Codex agent inside a shared conversation. Local Mattermost meant we could test genuine team-chat collaboration without a company Slack workspace. The agent's real read-only investigation produced the same findings and report links the human could inspect in Offboard.

Our setup also exposed friction. Auto mode and project trust affected whether the reviewed tools loaded. An expired provider sign-in had a stale local session copy, and a later investigation stopped on an account usage limit. Clearer tool-loading explanations, sign-in recovery, and agent capacity indicators would help distinguish a running process from an agent that can accept work.

These observations come from our tested Switch Console 0.40.1 setup. They are not claims about every version.

## What is verified today

The complete controlled journey passed: human request in Mattermost, real Codex investigation through Switch, genuine GitHub access discovery, automatic proposal email, explicit human approval, actual provider removal, independent rescan, persisted report and the agent's confirmation in the original thread.

The scan completed at 14:21:42 UTC, the human approved at 14:23:44, and the independent follow-up confirmed absence at 14:23:58. At 14:25 the real agent read the saved approval, operation and reports and explained the result back in the room. It preserved the immediate access-remains result and the partial coverage. An additional direct GitHub check confirmed the account absent while the protected owner remained active.

The agent also noticed that a rediscovered grant still carried the finding's earlier verification date. We fixed that state transition: a new positive scan clears the old date, while historical verification reports stay intact. The regression is covered by the database checks.

The web app is deployed on Vercel with Supabase. A fresh human room request also passed through the hosted app, local worker, real GitHub enumeration, saved report and Codex's reply with an HTTPS report link. This was a protected-account read-only check; the controlled removal described above happened before hosting.

Automatic proposal emails work; the earlier verification receipt described above was sent once for its saved result, rather than by an automatic result-mail feature. Setup, environment boundaries, migrations, worker configuration, and the actual Switch room/tool setup are documented in the [README](../../README.md). Hosting the application on Vercel does not add a Vercel access connector.

Additional providers and administrator invitations can follow. The core result is a shared investigation and a human-controlled access correction the team can independently verify.
