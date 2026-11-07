// Every image the film shows, with its run. Paths are reviewed derivatives written by
// scripts/prepare-assets.sh into public/footage (Git-ignored). SOURCES.md maps each
// shot to its original evidence file and records which run it belongs to.

export type Source = {file: string; w: number; h: number};

const thread = (n: number): Source => ({file: `footage/thread/f${String(n).padStart(2, '0')}.jpg`, w: 2800, h: 1800});

export const SRC = {
  /** Controlled run thread: human request, agent activity, scan result (walkthrough frame). */
  request: thread(63),
  /** Same thread: the agent's recorded tool activity for that request. */
  activity: thread(85),
  /** Same thread: the later request to read saved results, and the agent's replies. */
  readBack: thread(56),
  thread,
  /** Agent's same-thread confirmation, upper half (summary + evidence table). 2x Lanczos of 1400x900. */
  summary: {file: 'footage/switch-controlled-removal-summary.png', w: 2800, h: 1800},
  /** Agent's same-thread confirmation, lower half (table + coverage). */
  confirmation: {file: 'footage/switch-controlled-removal-confirmation.png', w: 2800, h: 1800},
  /** Separate hosted read-only check of the protected owner account (14:50 UTC). */
  hosted: {file: 'footage/hosted-investigation.png', w: 2800, h: 1800},
  /** Earlier controlled run, same account: proposal email (target lines only). */
  email: {file: 'footage/email-proposal.png', w: 2080, h: 500},
  /** Earlier controlled run: private review page target fields (recipient excluded). */
  reviewTarget: {file: 'footage/review-target.png', w: 1300, h: 640},
  /** Earlier controlled run: identity confirmation, approval checkbox, buttons. */
  reviewControls: {file: 'footage/review-controls.png', w: 1300, h: 440},
  /** Earlier controlled run: approval recorded on the private review page. */
  approved: {file: 'footage/approval-recorded.png', w: 1340, h: 800},
  /** Dashboard overview (content column, 1.5x Lanczos), captured 7 Nov 16:17 Lagos. */
  overview: {file: 'footage/overview.png', w: 1500, h: 1350},
} as const;

/** On-screen run labels. Short, readable, and honest about which run is shown. */
export const RUN = {
  completedTest: 'Switch · Mattermost room · completed test, 7 November',
  thread: 'One thread the whole team can follow · 7 November',
  earlierRun: 'Earlier controlled run · same account · 7 November',
  records: 'Controlled run, 14:23 UTC · saved records read back in the thread',
  hosted: 'Separate hosted check · read-only · 14:50 UTC',
  dashboard: 'Offboard dashboard · 7 November',
  diagram: 'Summary of saved records · 7 Nov 2026 · UTC',
} as const;
