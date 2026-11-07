<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Offboard workflow

When `privates-notes/` is present, read `product-brief.md`, `implementation-plan.md`, and `design-system.md` there before implementation. Follow the plan's active stage and update its status and next action after meaningful changes. These notes are local; the public README must stand alone when they are absent.

Use Tailwind utility classes for all interface styling. Keep `src/app/globals.css` limited to Tailwind imports and theme declarations. Neue Montreal is the intended font; track missing licensed assets honestly.

Provider operations and credentials belong in `worker/`. Keep scans, approvals, execution, and verification distinct; every success claim must have actual evidence. Run the checks documented in the README for the changed code.
