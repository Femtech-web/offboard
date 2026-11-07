# Claude Code production prompt — Offboard

Read this file from the Offboard repository. It is a production brief, not narration.

## Assignment

Act as a product film director, motion designer, and Remotion engineer. Make a clear, polished demonstration of **Offboard** for the **Best Business Workflow** track of Flip the Switch.

The audience should understand one practical story: someone leaves, a Codex agent investigates with the human in Switch, the human approves a precise GitHub access removal, and Offboard independently verifies the result. Make the shared conversation and the human decision the centre of the film.

The founder has firsthand experience: after leaving a team, their GitHub, Apple, and Vercel access remained active, and they could still see new code updates. Use this anonymous account as the opening motivation. Explain the practical risk of internal code and company information remaining accessible after a role ends. Offboard helps teams find and remove that access, then verify the outcome. Keep the employer unnamed and use no employer material. Do not add an invented breach, misuse, or financial loss. Apple and Vercel are part of the founder's experience; the working demonstration uses GitHub.

**Target 165 seconds. The entire export must be under 180 seconds, including the end card.** Deliver 1920×1080, 30 fps, H.264 MP4, yuv420p, AAC audio, plus captions. The final video must be uploaded by the owner to YouTube or Loom as public or unlisted.

App: https://offboard-mu.vercel.app

Repository: https://github.com/Femtech-web/offboard

Workspace: `/Users/mac/work/web3/we-make-dev/offboard`

## Inspect first

Read `README.md`, `docs/blog/offboard-with-switch.md`, `docs/setup.md`, the app’s font and color configuration, and the existing assets in `docs/images/`. The README cover is a brand illustration; the Switch screenshot is a genuine investigation capture.

Learn from the Parius brief at `/Users/mac/work/web3/sui/parius/marketing/CLAUDE_VIDEO_BRIEF.md`. Its useful principles are a recognisable problem, real product interactions, motivated transitions, readable evidence, and narration that sounds like a founder explaining a working product.

If available, inspect the reference films in `/Users/mac/work/web3/sui/parius/marketing/sample-videos/`: `motel.MP4`, `tender.MP4`, `gloam.MP4`, and `vano.MP4`. Use their pacing, hierarchy, and changes of scale as references. Do not reuse their artwork, soundtracks, branding, or copy. Use ffprobe and contact sheets if direct video inspection is unavailable.

Inventory footage before building scenes. The ignored `.local/demo-evidence/evidence-manifest.json` indexes original screenshots and the actual completed workflow. Originals may contain private email review links and unrelated inbox details. Keep those originals unchanged; use reviewed crops for the film. Do not read `.env*`, authentication caches, or credential files.

## Creative direction

**Follow one access grant from discovery to verification.** Carry a restrained lavender line or selection accent from the human’s room request to the discovered permission, the review decision, and the final verification. The line is an editing device, not a product feature.

Use Offboard’s existing identity: Neue Montreal Regular, Medium, and Bold from `src/assets/fonts/`; near-black `#0D1017`; indigo `#252B52`; surfaces `#151923`; warm white `#F0F1FA`; lavender `#B4B6FF`. Reuse the exit-mark wordmark. Keep typography confident, layouts spacious, and detail shots readable.

Most of the runtime should show actual chat and application footage. Use full-screen context to establish location, then deliberate close crops for the finding, approval, and result. Hold useful evidence long enough to read. Avoid tiny dashboards inside decorative laptop mockups, stock robots, glowing brains, numbered feature tours, constant zooming, and word-by-word animation.

The voice and on-screen copy should explain the person’s task. Keep worker names, bearer tokens, internal IDs, configuration, and implementation notes out of the narration and overlays. The real report may contain technical evidence; focus the crop on the useful result. Keep the visible coverage outcome legible.

Include a short closing roadmap beat: **planned integrations for organizations and teams — Vercel, Jira, Trello, and custom sites**. Present these names under “Planned integrations” in a simple brand graphic. Keep the working GitHub journey as the main story; this closing beat does not need connected-provider screens or a launch date.

## Storyboard

| Time      | Scene                     | Essential footage                                                                                                                                                      |
| --------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0–16 s    | The departure             | The founder's experience: their work ended while GitHub, Apple, and Vercel access remained. Introduce the risk and Offboard's find, remove, verify workflow.           |
| 16–25 s   | One case                  | The person, departure date, and GitHub account in the real case. Establish the exact organization and permission.                                                      |
| 25–62 s   | Investigate in Switch     | The human’s actual Mattermost request, Codex participation, real scan progress, and the agent’s saved findings and report link. Show the team conversation clearly.    |
| 62–94 s   | The human decides         | The proposal email, the exact account and organization, separate identity confirmation where needed, and the human’s approval. Keep the decision visible.              |
| 94–130 s  | Remove and recheck        | The actual approved change, provider result, and separate verification. If the first check still finds access, show that result before the later successful check.     |
| 130–153 s | Evidence back to the team | The saved report and the agent’s actual same-thread confirmation. Include the protected-account refusal and the report’s remaining coverage in a brief, readable shot. |
| 153–161 s | More tools ahead          | Show “Planned integrations” with Vercel, Jira, Trello, and custom sites, framed as future support for organizations and teams.                                         |
| 161–165 s | Close                     | Return to the Offboard wordmark. Hold the live URL for at least four seconds. End on “When someone leaves, prove their access is gone.”                                |

Adjust individual scene boundaries to the actual narration and footage. Preserve the under-three-minute total. Label shortened waits where they could otherwise imply instant processing.

## Proposed founder narration

Use six connected clips. Refine the wording to match the actual edit and the roadmap below. Leave room for the viewer to read the human decision and verification.

**01 — Problem**

“After I left a team, my GitHub, Apple, and Vercel access stayed active. I could still see code updates. Offboard helps teams find forgotten access, remove it with human approval, and verify the result.”

**02 — Case**

“We start with the person leaving and their GitHub account. Their case brings the access and decisions together.”

**03 — Switch**

“In our team’s Mattermost room, I ask Offboard to investigate. Switch connects our Codex agent to the conversation. The agent requests a real GitHub check, reads the saved findings, and explains the access it found. The team can follow that investigation in the same thread.”

**04 — Human decision**

“Offboard sends the proposed removal to my email. I review the account, organization, and exact permission, then make the decision myself. The agent can investigate and help us understand the result. Approval stays with the human.”

**05 — Verification**

“After approval, Offboard removes that permission and checks GitHub again. In our test, GitHub accepted the change, but the first check still found access. A separate follow-up confirmed the membership was gone. The report keeps both results, together with who approved the change.”

**06 — Team result, roadmap, and close**

“The agent brings the saved result back to the room. Next, we plan to support more of your organization’s tools: Vercel, Jira, Trello, and custom sites. When someone leaves, prove their access is gone.”

Prefer a natural founder recording. Ask for the six clips together if voice recordings are missing; WAV or M4A is suitable, and a continuous take is fine. Do not clone a voice or add synthetic narration unless requested. An initial silent animatic can proceed with temporary captions and measured scene timings.

## Footage and source records

The complete controlled removal already happened. It used `oluwafemi-akolade` in `Optimus-pro-orgs`, with the organization owner protected throughout:

| Event                           | Record for the editor to match                                                                                         |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Human room request              | `/switch/pl/r9jnxn68pbbbbcqkysgrjgqmkc`                                                                                |
| Real investigation              | Job `4c6ddc4d-8de7-4922-9ea1-f0f4dad32976`; completed 14:21:42 UTC, 7 November 2026                                    |
| Human email decision            | Approval `1f66cba7-02f3-456f-badb-059b0ea85ae1`; recorded 14:23:44 UTC                                                 |
| GitHub operation                | Operation `ee903325-db40-4b79-add2-7d6b265d2136`; HTTP 204 at 14:23:48 UTC                                             |
| Immediate check                 | Report `04442243-5752-49b8-94cd-1dc211a8764b`; access remained                                                         |
| Independent follow-up           | Report `5ed69f67-52e5-44a5-a7f5-b362e995b169`; verified removed at 14:23:58 UTC                                        |
| Actual agent confirmation       | `/switch/pl/fbc36mamgf8kjqyak845kj1y7w`                                                                                |
| Separate hosted read-only check | Report `ab78d48a-abf6-4c49-8e04-5c06e5c89b90`; 14:50:58 UTC; captured in `docs/images/switch-hosted-investigation.png` |

These are editing references, not on-screen text. Local chat permalinks require the demonstration runtime. The controlled removal happened before deployment; the hosted check is a separate read-only investigation. If using both, make the change of run clear in the edit.

A native UI walkthrough of the completed controlled session is available at `.local/demo-evidence/recordings/2026-11-07-completed-session-walkthrough/offboard-completed-session-walkthrough.mp4`. It shows the real room request, replies, saved evidence, and actual tool activity from that run. The adjacent `capture.json` preserves source-frame timestamps and hashes; `outcome.json` describes the capture. Frames were sampled at approximately 2 fps, with two idle navigation gaps cut for the preview. Use it as a completed-session cutaway with a short “Completed test · 7 November” caption. It is not a capture of fresh agent execution or the full removal flow.

The attempted fresh read-only recording at about 16:37–16:38 Africa/Lagos failed: the real Codex session reported a usage limit with a 19:11 retry time, then a revoked sign-in. No new scan completion was observed. That attempt is archived separately at `.local/demo-evidence/recordings/2026-11-07-switch-read-only/`; do not use it as successful workflow footage. Check agent availability before requesting another live recording.

There is no continuous removal recording yet. Keep raw footage under the ignored `.local/demo-evidence/recordings/` directory and ask for essential captures together:

- `01-case-and-switch.mp4`: the real departure case, human room request, actual agent investigation and findings.
- `02-email-decision.mp4`: the real email, review page and human decision, with private URL tokens and unrelated inbox details hidden.
- `03-verification-and-room.mp4`: provider outcome, independent check, saved report and genuine agent reply.
- `04-controls.mp4`: protected-account refusal and unchecked-provider status.

Record at 1080p or higher, with notifications hidden and a few seconds of stillness around decisive actions. The operator prepares any new controlled membership and personally approves the removal. Do not create accounts, invitations, approvals, or provider changes yourself for filming. The currently tested membership is already absent; another removal recording needs a fresh controlled grant and a new human decision.

Use actual recordings as the final demo’s core. Screenshots can support an animatic or evidence cutaway; moving a cursor across a screenshot is not a recording of the workflow running. Do not recreate agent replies or approval results as if they were captured UI. A brand diagram can explain the sequence without pretending to be a product result.

## Build and delivery

Use **Remotion, React, and TypeScript**, the installed Remotion skill, and current official documentation. Claude Code is the coding agent; inspect the tools actually installed before selecting render commands. Keep the film project isolated at `marketing/offboard-film/` with its own dependencies. Do not change the application, root dependencies, original evidence, database, or running services.

Use frame-driven animation, matched package versions, local assets and fonts, restrained transitions, and approximately 96 px safe margins. Supply phrase-timed captions, no more than two lines, plus SRT. Make burned-in captions configurable. Use only music the owner supplies or explicitly authorizes; reference-film audio is not an available soundtrack. Keep film dependencies and render/audio outputs excluded from Git; retain the editable film source.

Deliver an editable project, preview/render instructions, `out/offboard-demo.mp4`, a thumbnail, captions, and a contact sheet. If voice or essential live footage is missing, export `out/offboard-animatic.mp4` and name the missing replacements. Keep a short editing source list inside the film folder so each decisive shot maps to its actual run.

Check the actual render at normal speed, including opening clarity, UI readability, typography, audio, captions, black frames and transitions. Use ffprobe to verify the final duration is below 180 seconds. Inspect representative exported frames. Report exactly what was checked. Do not upload, publish, push, or submit the video; the owner handles those steps.

Begin with the asset inventory, settle one creative direction, and build the first animatic while requesting only the genuinely missing footage and voice inputs.
