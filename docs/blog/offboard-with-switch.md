---
title: "Building Offboard: removing access left behind when someone leaves"
published: false
description: "How I built a Switch workflow where Codex investigates GitHub access, a human approves removal, and a separate check verifies the result."
tags: security, ai, webdev, opensource
ai_disclosure_level: some_ai
---

After leaving a team, I still had access to its GitHub, Apple, and Vercel accounts. I could still see new code updates after my work there had ended.

No one had to break in. The access was already there because someone had forgotten to remove it.

That experience stayed with me. A departure can be complete in a team's calendar while the person's accounts still work. For a founder or engineering lead, finding those permissions often means checking several services, asking who owns each account, and trying to establish whether a requested removal actually happened.

I built **Offboard** to connect those steps: discover the remaining access, let a human approve the exact change, remove it, and independently check the result. The conversation, decision, and evidence should tell the same story.

For [Flip the Switch](https://www.wemakedevs.org/hackathons/switch), I connected a real Codex agent to a shared team room through Switch. GitHub is the first working provider.

## Follow one departure from discovery to removal

The controlled test used a separate GitHub account I own, `oluwafemi-akolade`, as an ordinary member of `Optimus-pro-orgs`. The organization owner and integration account, `Femtech-web`, stayed protected.

I created a departure record with the person's name, departure date, and GitHub username. Offboard then had a specific case to investigate, rather than an ambiguous request to remove someone with a similar name.

The dashboard has four views: Overview, People & Offboarding, Integrations, and Verification Reports. They show the saved case, actual findings, human decisions, and provider checks. The investigation itself begins in the team conversation.

## Bring the agent into the team's conversation

I used **Switch Console**, a **Codex agent named `offboard`**, and a Mattermost room called `security-offboarding`. The human request names the case:

```text
@offboard investigate <case UUID>
```

The agent reads the shared conversation, inspects the case, and requests a real GitHub check. Its three application tools are deliberately small:

| Tool           | Purpose                                                  |
| -------------- | -------------------------------------------------------- |
| `inspect_case` | Read the person, account, findings, and saved decisions. |
| `request_scan` | Request a read-only investigation for the named case.    |
| `get_job`      | Check its progress and read the resulting report.        |

The connection checks the actual room, human sender, and permitted case before accepting an investigation request. The agent receives no GitHub credential and has no approval or removal tool.

In the completed run, the scan found the controlled account's organization membership and saved the finding. Codex explained that result in the room, including which permissions had been checked. The dashboard displayed the same records.

This is where Switch matters: the human and agent investigate together in shared context. The agent can do useful work and discuss its findings without gaining the authority to make the removal decision.

## Make approval convenient without making it automatic

An investigation should not leave the administrator searching through another screen just to discover that a decision is waiting.

After an eligible scan, Offboard automatically sends a private review email. It shows the person, GitHub account, organization, and proposed change. The recipient can review and decide without another dashboard sign-in; there is no need to connect their Gmail inbox.

Opening the email or link changes nothing. The person still confirms the account association and explicitly approves or rejects the exact removal. The link expires after 15 minutes and permits one decision. The server checks the recipient's current authority and whether the target is still eligible.

The link is private because possession grants that narrow decision. It must not be forwarded, and the agent never receives it. Owners, the integration account, and configured protected accounts cannot be removed through this workflow.

During the test, I approved the new membership proposal through this email review. A chat message did not substitute for that approval.

## Check what happened after GitHub said yes

The most useful moment in the test came after the approval.

GitHub accepted the removal request with **HTTP 204**, but the immediate independent check still detected the membership. Offboard recorded **access remains**.

A separate read-only follow-up then confirmed that the membership was absent. Offboard saved a new **verified removed** report and retained the first report. The follow-up did not repeat the deletion.

| Event on 7 November 2026             | Recorded time, UTC |
| ------------------------------------ | ------------------ |
| Investigation found the membership   | 14:21:42           |
| Human approved the email proposal    | 14:23:44           |
| GitHub accepted the removal          | 14:23:48           |
| Immediate check still found access   | 14:23:50           |
| Separate follow-up confirmed absence | 14:23:58           |

The evidence establishes those observations. It does not establish why the two checks differed.

Afterward, the human asked Codex to review the saved outcome in the original thread. The agent read the authorization, provider operation, and both reports, then explained the result back to the room. It kept the first access-remains result visible and identified what was still unchecked.

The [step-by-step GitHub walkthrough](https://github.com/Femtech-web/offboard/blob/main/docs/github-run.md) includes the genuine Switch screenshots and record references. It can be read without an app login.

## Keep the decision and the evidence connected

Offboard's Next.js application runs on Vercel, with Supabase for authentication and PostgreSQL records. Resend sends the review emails. The interface and email templates use Tailwind; Neue Montreal is the application typeface.

A separate local service holds the GitHub credential and polls the application for authorized work. Switch, Mattermost, and Codex also run locally for this demonstration. The hosted dashboard can show saved evidence while those sessions are offline; new investigations require them to be available.

Each approval binds one provider account, organization, permission, and action. Before making the change, Offboard checks the current target and consumes the approval once. It saves the provider response separately from the independent verification.

That separation makes a report useful. It answers who was leaving, what was found, who approved the correction, what GitHub returned, and what a fresh check observed. It also records what remains unresolved.

For this run, GitHub membership removal was verified, while overall case coverage remained **partially verified**. Enterprise access, pending invitations, other organizations, and other services were outside the checked scope. Deploying the application to Vercel does not implement a Vercel access connector.

The latest completed checks passed **80 offline tests** and **132 transactional PostgreSQL safety checks**, with database fixtures rolled back. Unauthorized approval and removal requests were refused in live checks. The completed provider journey was tested separately against the controlled accounts.

The controlled removal happened before deployment; the hosted dashboard now shows those same saved records. A later read-only investigation also passed through the hosted app and returned its report link in Switch. It was a separate check, rather than another removal.

## Set up the same workflow

Start with Node.js 24, a Supabase project, an organization you administer, and a separate ordinary-member account for the test. Resend is needed for email review. Install [Switch Console](https://docs.switchagents.ai/switch-rooms/getting-started/install-switch-console) with Docker running and configure its Codex provider.

After cloning the repository, install the application and create the local configuration file:

```sh
nvm use
npm ci
cp .env.example .env
```

Fill in your own values and create a confirmed Supabase administrator as described in the [setup guide](https://github.com/Femtech-web/offboard/blob/main/docs/setup.md). Then check the configuration, apply the migrations, and start the app:

```sh
npm run env:check
npm run db:migrate
npm run dev
```

In a second terminal, start the provider service. This example uses an existing authorized GitHub CLI sign-in:

```sh
npm run worker:run -- --github-cli-auth
```

In Switch Console, create the `offboard` agent and add it to the Mattermost room `security-offboarding`. Configure the three-tool MCP adapter with the matching room, human sender, and case scope. Keep permission bypass off and review the tools that actually loaded. The [Switch setup section](https://github.com/Femtech-web/offboard/blob/main/docs/setup.md#switch-and-mattermost) contains the exact configuration and room instructions.

Connect the authorized organization in Offboard, create the case, and send the investigation request in the room. Read the findings, review the email proposal, and make the human decision. After execution, inspect both the provider response and verification report, then ask the agent to explain the saved result in the same thread.

## What I learned while building with Switch

Switch let me bring an existing Codex agent into a real shared conversation. Mattermost provided a local team-chat environment without requiring a company Slack workspace. The useful part was being able to discuss a case and have the agent investigate the same records that appeared in the application.

Tool configuration needed careful checking. In the tested Switch Console 0.40.1 setup, Auto mode and project trust affected whether the reviewed tools loaded. An expired provider sign-in also required recovery, and a later request stopped on an account usage limit. A running agent process did not necessarily mean it could accept work.

For another builder, I would start by getting one room request and one restricted tool call working before adding more actions. Verify the effective tools, confirm that a real source message reaches the application, and keep the human approval boundary outside the model. Clearer tool-loading feedback, sign-in recovery, and capacity indicators would make this setup easier.

The agent also noticed a real state bug: rediscovered access still carried an earlier verification date. I fixed the transition so a fresh positive scan clears that old date while preserving historical reports. That was a useful reminder that evidence needs to describe a particular observation, rather than become a permanent success label attached to an account.

## What comes next

The next provider work is Vercel, followed by Jira, Trello, and custom site integrations for organizations and teams. Those are planned; GitHub is the working connector in this build. As providers are added, one person's departure should collect their confirmed accounts in one case, with each permission checked and verified separately.

I also want to add administrator invitations, make recovery easier when local services are unavailable, and automate verification receipt emails. Proposal emails already send automatically. A redesigned result receipt was tested separately and rendered correctly in Gmail, but reached Spam, so inbox placement still needs attention.

The problem that started Offboard was simple: my work had ended, but my access had not. The goal is to help teams close that gap and leave a record they can inspect afterward.

You can [try Offboard](https://offboard-mu.vercel.app), [inspect the actual GitHub run](https://github.com/Femtech-web/offboard/blob/main/docs/github-run.md), or [read the repository and setup instructions](https://github.com/Femtech-web/offboard).
