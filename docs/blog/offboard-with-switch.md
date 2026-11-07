# Offboard: investigating access in Switch, with human approval and verification

_Build article draft · 7 November 2026 · Not published. The complete Switch-led removal run and final video are still pending; update the verification status before publication._

When a contractor leaves, deleting an account from a checklist does not establish which permissions remain. Someone still needs to inspect the connected systems, decide which changes are appropriate, and check what happened afterward.

We built Offboard for founders, engineering leads, and IT/security administrators who need that evidence. Its first connector checks GitHub organization membership and outside-collaborator access. A Codex agent investigates with the human in a real Switch-connected Mattermost room. The human retains approval, and a restricted worker performs and independently verifies the exact correction.

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

The most instructive live result came from a controlled ordinary-member account we were explicitly authorized to remove from our test organization, `Optimus-pro-orgs`. The owner/integration account remained protected.

The human received the proposal, confirmed the identity, and approved the exact membership removal. GitHub accepted the operation with HTTP 204. The immediate independent check still reported access.

Offboard saved **access remains**. It did not turn the accepted response into a security success.

A later read-only verification confirmed that the membership was absent. A new report recorded **verified removed**, while the original report remained unchanged. The follow-up did not repeat the deletion. Provider propagation delay is a possible explanation for the difference, but the evidence alone does not establish its cause.

| Actual event                          | Recorded time, UTC |
| ------------------------------------- | ------------------ |
| Human email approval                  | 13:34:37           |
| GitHub accepted the removal           | 13:34:40           |
| Immediate check still reported access | 13:34:42           |
| Separate follow-up confirmed absence  | 13:40:37           |

The user also received GitHub's own organization-removal notification. Our redesigned verification receipt rendered in Gmail but reached Spam; the earlier approval email reached the inbox. We checked the verified Resend sender configuration and retained that delivery limitation rather than claiming guaranteed inbox placement.

These emails support the saved rescan. They do not replace it.

## Keeping evidence and coverage honest

The Next.js application uses Supabase Auth and PostgreSQL. Provider credentials remain with the local TypeScript worker, which polls authenticated application endpoints. Switch, Mattermost, and Codex also run locally for the current development setup.

Approval binds an immutable target and expires. Execution rechecks the exact identity, organization, permission, protection rules, and single-use approval before changing provider access. An uncertain destructive operation is not automatically repeated.

Reports preserve the person, permission, human decision, provider response, independent check, and remaining scope. A verified GitHub membership removal leaves overall coverage **partially verified**. Vercel is not implemented; other organizations, systems, and unexamined permissions remain unchecked.

The current checks include 70 offline tests and 107 transactional PostgreSQL safety checks, with all database fixtures rolled back. Live unauthorized worker requests and attempted approval through the investigation bridge were refused. Those tests complement the provider evidence; they do not establish an untested integration.

## What worked, and what we would improve

Switch let us use an existing Codex agent inside a shared conversation. Local Mattermost meant we could test genuine team-chat collaboration without a company Slack workspace. The agent's real read-only investigation produced the same findings and report links the human could inspect in Offboard.

Our setup also exposed friction. Auto mode and project trust affected whether the reviewed tools loaded. An expired provider sign-in had a stale local session copy, and a later investigation stopped on an account usage limit. Clearer tool-loading explanations, sign-in recovery, and agent capacity indicators would help distinguish a running process from an agent that can accept work.

These observations come from our tested Switch Console 0.40.1 setup. They are not claims about every version.

## What is verified today

Two genuine journeys have passed: a Switch-led read-only investigation with an agent reply in Mattermost, and a dashboard-origin investigation followed by human email approval, real GitHub removal, and independent verification.

The combined room-to-removal-to-room-confirmation journey is still pending because the controlled-account Switch request stopped on quota. We will not present those separate runs as one completed sequence. Production deployment and the final running-workflow video also remain outstanding. Automatic proposal emails work; the verification receipt described above was sent once for the saved result, rather than by an automatic result-mail feature.

The next step is to capture the complete shared workflow against a newly accepted controlled test grant, then publish the repository and a demo under three minutes. Setup, environment boundaries, migration commands, worker configuration, and the actual Switch room/tool setup are documented in the [README](../../README.md).

Additional providers and administrator invitations can follow. First, the team needs one access change it can explain, authorize, and independently verify.
