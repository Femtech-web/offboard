# Editing source list

Every decisive shot, the evidence it comes from, and the run it belongs to. Originals live in the ignored `.local/demo-evidence/` archive and are never modified; `scripts/prepare-assets.sh` checks their manifest SHA-256 before deriving the reviewed copies in `public/footage/` (also ignored).

Runs on 7 November 2026 (UTC):

- **Controlled run** — case `Controlled removal test — Oluwafemi`, account `oluwafemi-akolade`, organization `Optimus-pro-orgs`. Scan 14:21:42; approval 14:23:44 (email); GitHub 204 at 14:23:48; immediate check `access_remains` 14:23:50; follow-up `verified_removed` 14:23:58; agent read-back in the same thread at ~14:25.
- **Earlier controlled run** — same account, organization and permission, ~13:26–13:40. Its proposal email, private review page and "Approval recorded" screen are the only email-decision captures that exist. Labelled on screen as an earlier run.
- **Separate hosted check** — read-only investigation of the protected owner `Femtech-web` through the hosted app, 14:50:58. Labelled on screen as separate and read-only.

| Film time | Shot | Source (original) | Run | Notes |
| --- | --- | --- | --- | --- |
| 0–16 s | Founder's experience; find → remove → verify | Brand typography | — | Founder's own account; no employer, no logos, no invented incident. |
| 16–24.5 s | Case facts + dashboard "Cases to follow" | `originals/2026-11-07-1617-overview-cleaned-desktop.png` | Controlled (dashboard captured 16:17 Lagos) | Crop excludes the sidebar admin email and the row's status badge. Facts beside it are a typographic summary of the saved case. |
| 24.5–27.7 s | Room establishing | `recordings/2026-11-07-switch-read-only/frames/frame-00060…66.png` | Controlled | Completed-session walkthrough frames at their recorded cadence (`capture.json`). Captioned "completed test". |
| 27.7–36.1 s | Human request `@offboard investigate …` | `frame-00063.png` | Controlled | Genuine room request; highlight on "the human will review the exact proposal separately". |
| 36.1–40 s | Agent tool activity (`inspect_case`, `request_scan`, `get_job`) | `frame-00085.png` | Controlled | "Worked for 57s" shown as a still; labelled as recorded activity. |
| 40–52 s | Scan result and the discovered grant | `frame-00063.png` | Controlled | 14:21:42 UTC, `access_detected`; the film's tracked grant. |
| 52–57.5 s | Whole thread | `frame-00063.png` | Controlled | Same thread, full window. |
| 57.5–65.5 s | Proposal email | `originals/2026-11-07-143344-original-approval-email-later.png` | Earlier controlled run | Crop stops above the private review URL; no inbox, labels or browser chrome. |
| 65.5–70.2 s | Review page: target fields | `originals/2026-11-07-143152-email-review-stale-controls.png` | Earlier controlled run | Crop stops above "Authorized recipient" (address excluded). |
| 70.2–78.1 s | Identity confirmation + approval checkbox | same file | Earlier controlled run | Captured while the page showed a "stale finding" warning (between the two crops, not shown); a genuine refresh followed before approval. |
| 78.1–86 s | "Approval recorded" | `originals/2026-11-07-143445-email-approval-recorded.png` | Earlier controlled run | Address bar (with the used link) excluded. |
| 86–92.2 s | Evidence table: human authorization | `originals/2026-11-07-1525-switch-controlled-removal-summary.png` (2× Lanczos) | Controlled | Agent's same-thread read-back of saved records. |
| 92.2–106.5 s | Provider 204 → immediate `access_remains` → follow-up `verified_removed` | `originals/2026-11-07-1525-switch-controlled-removal-confirmation.png` (2×) | Controlled | Both results shown in order. |
| 106.5–116.5 s | Timeline graphic of the four recorded times | Brand diagram from the saved records above | Controlled | Labelled "Summary of saved records". Not product UI. |
| 116.5–121.1 s | Agent's reply back in the room | `frame-00056.png` | Controlled | Same thread, later human request to read saved results. |
| 121.1–126.1 s | Agent summary sentence | `…-1525-switch-controlled-removal-summary.png` | Controlled | `verified_removed`, `partially_verified`; immediate report kept. |
| 126.1–132.5 s | Remaining coverage; "approved or executed nothing" | `…-1525-switch-controlled-removal-confirmation.png` | Controlled | On-screen callout (not narrated). |
| 132.5–139 s | Protected owner, no proposal sent | `docs/images/switch-hosted-investigation.png` (2×) | Separate hosted check | On-screen callout and amber "separate" label. |
| 139–148 s | Planned integrations | Brand graphic | — | Vercel, Jira, Trello, custom sites — planned, no dates. |
| 148–154.5 s | Wordmark, line, live URL | Brand | — | URL on screen for ~6 s. |

Not used: the failed fresh read-only attempt (`recordings/2026-11-07-switch-read-only/frames/frame-00000…00038`, usage limit and revoked sign-in), the GitHub removal notification and verification receipt emails (earlier run, supporting only), submission-form screenshots and setup-history captures.

## Audio

- Voice: `marketing/voiceovers/Off-1.m4a … Off-6.m4a`, the founder's own recordings. Cut only at measured pauses; no stretching or pitch change. One comma pause in clip 3 ("…a real GitHub check, ‖ reads the saved findings…") is lengthened by ~0.85 s so the tool list can be read.
- Music: `beat.mp3` from the Parius marketing folder, authorised by the owner for this film on 7 November 2026. Spliced once (78.289 s → 22.475 s, 60 ms crossfade) to cover the runtime; ducked under the voice.
- No synthetic voice and no sound effects.
