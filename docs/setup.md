# Offboard setup

[Back to Offboard](../README.md)

This guide covers the application, provider worker, and Switch agent. Use an organization you administer and a separate controlled account for any removal test.

## Local setup

Use Node.js 24 LTS and npm:

```sh
nvm use
npm ci
cp .env.example .env
```

Fill in `.env` locally. Existing configured files should be kept; do not overwrite them with the example. Real environment files, `privates-notes/`, `.local/`, and build output are ignored by Git.

| Variable                               | Where it runs / purpose                                                                                                                                              |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | App: Supabase project URL.                                                                                                                                           |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | App: public API key; RLS still governs database access.                                                                                                              |
| `SUPABASE_SECRET_KEY`                  | App server and setup scripts only: privileged key, never a browser or agent credential.                                                                              |
| `SUPABASE_DB_URL`                      | Migration/tests only: PostgreSQL connection URL. Use the session pooler when the direct hostname is unreachable. Percent-encode reserved characters in the password. |
| `OFFBOARD_ADMIN_EMAIL`                 | Server: confirmed Auth email permitted to bootstrap as administrator.                                                                                                |
| `OFFBOARD_APP_URL`                     | Worker: `http://127.0.0.1:3000` locally; HTTPS application origin when hosted.                                                                                       |
| `OFFBOARD_WORKER_TOKEN`                | App server + worker: shared random bearer secret of at least 32 characters. Generate with `openssl rand -hex 32`. Never give it to the agent.                        |
| `GITHUB_ACCESS_TOKEN`                  | Local worker only: authorized GitHub user token, or omit when using `--github-cli-auth`.                                                                             |
| `GITHUB_ORGANIZATION`                  | Worker: the single authorized organization allowlist.                                                                                                                |
| `GITHUB_TEST_USERNAME`                 | Explicit read-only CLI/live-test target. Does not confirm a removal identity.                                                                                        |
| `GITHUB_PROTECTED_USER_IDS`            | Worker: comma-separated stable IDs protected in addition to owners and the integration identity.                                                                     |
| `RESEND_API_KEY`                       | App server only: Resend send-email API key. Never expose it to the worker, agent, or browser.                                                                        |
| `APPROVAL_EMAIL_FROM`                  | App server: `Offboard <notifications@paayee.org>`; the domain must be verified in Resend.                                                                            |
| `GITHUB_REMOVAL_TEST_USER_IDS`         | Worker: stable IDs of explicitly authorized disposable test accounts. Empty means every removal is refused.                                                          |

Find the Supabase URL and API keys in [project settings](https://supabase.com/docs/guides/getting-started/api-keys). Obtain the database URL from **Connect**; see [connection methods](https://supabase.com/docs/guides/database/connecting-to-postgres). Neither database passwords nor Auth passwords belong in chat or the repository.

```sh
npm run env:check
npm run db:migrate
npm run dev
```

The migration runner applies checksummed SQL files in one transaction with an advisory lock. Never edit an applied migration; add a subsequent migration. If a database connection is unavailable, the migration files can be reviewed and applied in order in Supabase SQL Editor; keep migration history consistent before switching back to the runner.

In **Supabase → Authentication → Users**, create a confirmed user whose email matches `OFFBOARD_ADMIN_EMAIL`. Use that user’s password at [the local sign-in page](http://127.0.0.1:3000/sign-in). On successful validated sign-in, only that allowlisted email can bootstrap an administrator profile. User metadata cannot grant roles. There is no public signup or browser-side role editing.

Neue Montreal Regular, Medium, and Bold are loaded locally through `next/font/local`. All page and component appearance uses Tailwind. The global stylesheet contains only Tailwind imports and theme declarations.

## Provider worker

Run the web app and worker in separate terminals:

```sh
# Reuse an existing authorized GitHub CLI sign-in; token stays in memory.
npm run worker:run -- --github-cli-auth
```

Omit the flag when using `GITHUB_ACCESS_TOKEN`. The CLI reads the existing credential with a fixed `gh auth token --hostname github.com` command. Agent input is never converted into shell commands.

In **Integrations**, add the configured GitHub organization. The record stays unverified until the worker completes a real check. In **People & Offboarding**, create a case and request a scan. A successful scan resolves the stable user ID; an administrator must separately confirm that identity before approving a removal.

Standalone, read-only diagnostics remain available:

```sh
npm run worker:doctor -- --github-cli-auth
npm run worker:scan -- --github-cli-auth
```

The worker supports GitHub user tokens with active administrator membership. GitHub App authentication is not implemented. Read checks require permissions for organization member and outside-collaborator enumeration; removal requires the corresponding write/admin permission and any required SSO authorization. A successful connection check does not prove write capability. Consult the [organization members](https://docs.github.com/en/rest/orgs/members) and [outside collaborators](https://docs.github.com/en/rest/orgs/outside-collaborators) APIs.

Requests use a fixed GitHub API origin, reject redirects, validate responses, and constrain pagination to the requested scope. Errors are sanitized; raw tokens, headers, and response bodies are not stored.

## Authorization, jobs, and evidence

```mermaid
flowchart LR
  Human --> Room[Switch + Mattermost room]
  Room <--> Agent[Real Codex agent]
  Agent <--> Adapter[Restricted MCP adapter]
  Adapter -->|Verify saved room context| Room
  Adapter <-->|Scoped authenticated investigation calls| App
  Human[Authenticated administrator] --> App[Next.js application]
  App --> DB[(Supabase Auth + PostgreSQL)]
  Worker[Local worker] -->|Authenticated HTTPS polling| App
  Worker --> GitHub[GitHub API]
  GitHub --> Worker
  Worker -->|Findings and verification evidence| App
  DB --> Reports[Four dashboard views]
```

Authenticated users read under administrator RLS. Mutations use narrow server-authorized database functions. Worker functions are executable only with the server’s service role, behind bearer-authenticated application endpoints. The local worker receives scoped jobs rather than a Supabase secret key. Agent transport and human approval are separate trust boundaries.

Approvals bind an immutable snapshot of the stable account ID, organization ID, username, exact grant, and action. They expire after 15 minutes. Execution requires a currently authorized approver, confirmed matching identity, fresh provider preflight, no protection flags, a valid job lease, and successful transactional single-use consumption. The worker additionally requires the target’s ID in `GITHUB_REMOVAL_TEST_USER_IDS`. Owners, the integration identity, privileged accounts, and configured protected IDs are refused.

### Automatic private email review

A completed real scan automatically queues eligible, unprotected findings for its requesting administrator’s confirmed email. Delivery runs on the application server after authenticated worker polling; the agent and worker receive neither Resend credentials nor private review tokens. There is no manual send step in the normal flow. **Email me this proposal** remains available to request a fresh link. Manual requests can only address the signed-in administrator’s own confirmed Supabase email; callers cannot supply an arbitrary recipient. Configure `RESEND_API_KEY` and `APPROVAL_EMAIL_FROM`. No Gmail OAuth or inbox access is needed: Resend sends the message to the administrator’s mailbox.

The HTML email uses React Email and Tailwind with a plain-text fallback. Both show the person, GitHub username, organization, proposed change, expiry, and a clear review action. Technical resource identifiers and execution details stay in the authenticated evidence report. The private review uses concise decision-focused copy. Email clients use a safe font fallback when Neue Montreal is unavailable.

The URL has a random 256-bit capability in its fragment, which is removed from the address bar on page load. Only its SHA-256 hash is stored. It is not a dashboard session and grants no other permissions. The review API accepts same-origin JSON POST only; opening the page/email does not approve anything. The recipient must explicitly review and approve or reject. If the provider identity is still unconfirmed, approval also requires a separate identity checkbox; the server records that exact identity association atomically with the decision. Opening or previewing the link never confirms identity. Tokens are kept only in browser memory, never local storage; review pages prohibit framing, referrer transmission, and indexing.

Each link lasts 15 minutes and allows one decision. Its finding must also remain fresh. When an eligible pending review becomes stale, the app can queue one genuine read-only refresh; approval stays unavailable until the result is fresh and the target still matches. **Refresh check** reloads the saved review state. The server rechecks the recipient’s confirmed email/current administrator role, immutable target, account protection, provider identity match, explicit identity acknowledgement when needed, and finding freshness. A changed target, expired/used link, ambiguous email submission, or newer dashboard decision fails closed. Requests are limited to one per minute per administrator. The durable queue deduplicates recent proposals. A crashed sender becomes uncertain and is never automatically retried; provider rejection or changed/ineligible targets remain explicit failures or skips. Mail submission cannot change a scan or removal result. Link possession authenticates this narrow decision: forwarding it grants the holder that capability, so keep it private. Agents receive neither the link secret nor any approval tool.

Both email and dashboard decisions use the same transactional approval rules. Reports record the administrator and authorization channel. The worker still checks and consumes the approval once, performs a fresh provider preflight, and independently rescans. Resend acceptance, the human decision, provider execution, and verified removal are separate persisted states. **Resend acceptance is not proof of inbox delivery.** Timeouts or unsaved acceptance leave the link unusable; the app never automatically resends an uncertain submission. After fixing the cause, request a fresh link.

For deployment set `OFFBOARD_APP_URL` to the public HTTPS origin before sending email. The local test link works only on a device that can reach the development app. Disable email click tracking for approval messages to preserve private review URLs. See the official [Resend send-email API](https://resend.com/docs/api-reference/emails/send-email) and [domain verification guide](https://resend.com/docs/dashboard/domains/introduction).

Claims use row locks and `SKIP LOCKED`; one approval can create only one execution job and one operation. A worker issues DELETE only after a positive approval-consumption acknowledgement. It never automatically retries DELETE. A lost response or expired destructive lease stays uncertain. Read-only jobs have bounded lease retries. Repeated completion submissions cannot create duplicate evidence.

After a provider operation, a separate scan checks the exact permission. If an accepted removal's immediate check still reports access, one persisted read-only follow-up is queued; it never repeats DELETE. The new report preserves the original approval and operation evidence alongside the fresh check, and the original report remains unchanged. Reports distinguish **verified removed**, **access remains**, **verification failed**, **partially verified**, and **not checked**. Missing or incomplete coverage cannot establish absence. Even a verified GitHub removal leaves the case partially verified: enterprise permissions, pending invitations, other organizations, Vercel, and other services remain outside this connector’s coverage. GitHub’s username-addressed mutation API cannot make preflight and deletion one atomic provider transaction; keep test grants explicitly controlled.

For an uncertain job, inspect its report and perform a new read-only investigation before proposing another correction. There is no automatic destructive recovery or global “all access cleared” status. Reports and audit records are not editable through the application; a database administrator remains privileged.

Pending-job views refresh saved records automatically while queued or leased work exists. Case-form validation identifies the invalid field and preserves the entered values. Native controls use Tailwind’s dark color-scheme utility.

Worker availability is based on a recent saved heartbeat. It says nothing about whether the separate Codex agent is online. The interface does not claim continuous agent availability.

## Switch and Mattermost

Install the official [Switch Console](https://docs.switchagents.ai/switch-rooms/getting-started/install-switch-console), with Docker running. Select **On this computer**, then [configure the Codex provider](https://docs.switchagents.ai/switch-rooms/getting-started/set-up-agent-providers), [onboard an agent](https://docs.switchagents.ai/switch-rooms/getting-started/onboard-agents), and [create a room](https://docs.switchagents.ai/switch-rooms/getting-started/create-a-room).

The tested local setup used Console 0.40.1, Switch server 0.31.0, Codex CLI 0.167.0, and Mattermost. Agent `offboard` has a dedicated ignored directory `.local/switch-agent`. Auto mode is on with the user’s explicit approval; Bypass permissions and agent management remain off. Its audience is owner-only. The project configuration disables shell tools, app connectors, and unrelated inherited MCP servers. It has no GitHub credential, Supabase secret, worker token, or approval tool.

Room `security-offboarding` is a genuine Mattermost-backed room. The local setup selected `http://localhost:52426/switch/channels/security-offboarding`; ports may change after recreating the server. A real role/connectivity response and a later complete read-only investigation were received. The later agent used `inspect_case`, `request_scan`, and `get_job`; its findings matched the saved GitHub report.

Room/agent instructions must require: investigate only through restricted application tools; discuss saved findings; never fabricate evidence; never approve an action; use authenticated dashboard or private email review for human decisions; preserve unchecked and failed coverage; never disclose credentials. The adapter re-reads room details and conversation history from the authenticated Switch API before each application call. It requires a real message from the configured human sender, an explicit case UUID, the configured Mattermost room/agent, and an allowlisted case. A notification relay alone is insufficient.

### Restricted investigation tools

Copy `.env.switch.example` to `.env.switch` and set its permissions to `600`. This file is read only by the local MCP subprocess; do not load the web app’s `.env` into the agent. It contains the app URL, a separate `OFFBOARD_SWITCH_TOKEN`, the existing agent credential-file path, one room ID, one agent ID, the authorized human’s exact Switch transport sender ID, and explicit case UUIDs. The web server’s `.env` must contain the same token/scope values plus `OFFBOARD_SWITCH_INTEGRATION_ID`. Its existing `OFFBOARD_ADMIN_EMAIL` must identify a current administrator profile. Keep the worker token different.

Find IDs through the authenticated Switch `list_rooms`, `get_room_detail`, and `read_context` operations, using the installed version’s [agent protocol](https://docs.switchagents.ai/switch-rooms/internals/agent-protocol). Match the actual sender ID in saved context; names supplied by an LLM are insufficient. Console-managed agent credentials in the tested release live under `~/Library/Application Support/switchdash/agent-controller/servers/<server ID>/agents/<agent ID>/credentials.json`. Some Console agent types use `.switch/agents/<name>.json` in their working directory. Point to the existing agent-specific file; do not paste its contents into chat. No new Switch registration or broad provider credential is required.

Create `.local/switch-agent/.codex/config.toml`, replacing paths with your installation’s absolute paths:

```toml
web_search = "disabled"
[features]
shell_tool = false
apps = false
multi_agent = false
[mcp_servers.offboard]
command = "/absolute/path/to/node-24"
args = ["--import", "tsx", "/absolute/path/to/offboard/agent/src/server.ts"]
cwd = "/absolute/path/to/offboard/.local/switch-agent"
enabled_tools = ["inspect_case", "request_scan", "get_job"]
[mcp_servers.switch]
enabled_tools = ["read_context", "list_rooms", "get_room_detail", "list_participants", "post_message", "send_targeted_message", "connect_to_room"]
```

Disable every unrelated inherited MCP server in this project config with its own `[mcp_servers.<name>]` and `enabled = false`. Review the effective tool catalog before using real cases. Mark only the dedicated directory trusted in the Codex user configuration. In Switch Console 0.40.1, Auto mode off forces that directory untrusted and suppresses project MCP configuration; use Auto mode with explicit operator approval, keep Bypass off, then restart the agent. [Agent settings](https://docs.switchagents.ai/switch-rooms/getting-started/agent-settings) and [Codex MCP configuration](https://learn.chatgpt.com/docs/extend/mcp) describe these controls. The application’s removal authorization remains independent of that provider permission mode.

The local subprocess has exactly three application tools. It exposes no shell, identity-confirmation, approval, provider mutation, or arbitrary HTTP tool. `request_scan` requires a room request no older than 15 minutes; saved-result reads accept that source for 24 hours. Every call rechecks Switch context and the app validates a fresh adapter attestation, configured scope, and current administrator mapping. A unique database key makes one room/message reuse its original scan job. Pending work and unavailable services remain pending or failed.

The bridge bearer credential is a trusted local service credential, not a signed message from Switch. Its holder can attest room context, so protect `.env.switch`, the adapter code, and the host. The model sees tool results, not that credential. Running processes under the same OS user is not strong host isolation; a future multi-user deployment needs a separately controlled service identity/runtime. Only explicitly allowlisted synthetic/test cases are enabled in the tested setup.

Run the app and provider worker, keep Switch/agent running, then send `@offboard investigate <case UUID>` in the configured Mattermost room. The agent reads saved context, inspects the case, requests one scan, reads its job/report, and discusses the actual evidence and dashboard links. Case pages identify Switch-origin jobs; reports retain the verified source-message context. A subsequent explicit human dashboard or private-email approval is still required for any correction.

If Codex sign-in expires, renew the existing login with `codex login`. Console may retain a stale session authentication copy; the tested release copies sign-in into `~/.local/state/switch/sdk-sessions/<session hash>/provider-home/<session hash>/`. Stop the affected agent before refreshing that cache, preserve old files privately, and restart. Never paste authentication contents into logs or chat.

## Validation

```sh
npm run check
npm run build

# Opt-in: real database functions and roles, all fixture records rolled back.
npm run db:test

# Opt-in: real Auth, app endpoints, GitHub scan, and persisted evidence; no DELETE.
# Requires the local app running and a confirmed configured administrator.
npm run test:live:read-only -- --github-cli-auth
```

Offline tests use synthetic provider fixtures strictly inside tests. The live read-only check generates and consumes an in-memory administrator Auth link without sending email or changing a password, bootstraps only the configured confirmed administrator, records a clearly named protected-account test case, queues genuine provider checks, and inspects the saved report. It does not test browser rendering or substitute for a live removal demonstration. Stop other worker processes while running this diagnostic. It refuses active mutation jobs, supplies no removal adapter, and requires a report for the exact scan job created by that run.

The test suite covers approval, protection, state transitions and failure recovery. The separately invoked database checks roll back their fixtures. Live provider checks require your own authorized test resources.

Production uses the supported Webpack build option because this environment restricted Turbopack’s internal PostCSS port. TypeScript is pinned to 6.0 while the lint parser adds TypeScript 7 support. Narrow minimatch overrides patch [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249); remove them when upstream dependencies resolve to patched versions. Some nested Next.js lint plugins emit ESLint 10 peer-range warnings.

## Deploy to Vercel

To reproduce deployment:

1. Link a Vercel project, select the Next.js preset and Node.js 24, and use `npm run build`. The `.vercelignore` allowlist uploads web source and build configuration; private notes, original evidence, environment files, and local agent credentials are excluded.
2. Add the two public Supabase settings, `OFFBOARD_ADMIN_EMAIL`, and the configured `OFFBOARD_SWITCH_*` scope. Store `SUPABASE_SECRET_KEY`, `OFFBOARD_WORKER_TOKEN`, `OFFBOARD_SWITCH_TOKEN`, and `RESEND_API_KEY` as sensitive server secrets. Set `APPROVAL_EMAIL_FROM` for a verified sender and `OFFBOARD_APP_URL` to the production HTTPS origin. Do not upload `GITHUB_ACCESS_TOKEN` or `SUPABASE_DB_URL`.
3. Deploy production. Stop the old polling worker, update `OFFBOARD_APP_URL` in the local worker environment and `.env.switch`, and restart one worker with matching separate worker/bridge credentials. Running local sessions must remain online for investigations to progress. The hosted app never calls a laptop's localhost; the adapter verifies Switch context locally and calls the hosted app.
4. Sign in with the confirmed administrator, check saved records and access guards, and run a real read-only room investigation before attempting another controlled removal. Password sign-in is the implemented Auth flow; if enabling email/OAuth redirects later, configure the production Site URL and redirect allowlist in Supabase as well.

No new hosted removal or hosted approval-email delivery has been tested yet. Existing local review links are historical; new messages use the configured HTTPS origin. A successful web deployment does not implement a Vercel access connector.

For the hackathon, Switch, Mattermost, Codex, and the worker can remain local. Future hosting needs a deployment compatible with Switch/Mattermost’s services, persistent storage, and agent lifecycle. An existing Cloudflare subscription alone does not establish that this stack can run there; no cloud runtime has been provisioned or validated.

## Troubleshooting

- **Checks stay pending:** confirm the worker is running against the same app origin and has the matching worker token.
- **Agent tools do not load:** review the dedicated project directory, Auto mode and effective tool catalog; keep Bypass off.
- **Email review is expired or stale:** request a fresh link or use the review page’s access recheck. Opening a link never approves it.
- **Email is not in the inbox:** check Spam and the saved email status. Resend acceptance does not guarantee inbox placement.
- **GitHub removal is accepted but access remains:** keep the original report. Offboard performs one separate read-only follow-up without repeating the deletion.
