# Offboard film

Remotion project for the Offboard demo (Flip the Switch, Best Business Workflow). Isolated from the app: its own dependencies, nothing imported from `src/`.

- `TREATMENT.md` — direction, reference notes, storyboard.
- `SCRIPT.md` — the founder's narration as recorded, plus words to confirm by ear.
- `SOURCES.md` — every decisive shot mapped to its original evidence and run.

## Requirements

Node 22+, pnpm, ffmpeg/ffprobe, Python 3. The local evidence archive (`../../.local/demo-evidence/`), the founder's recordings (`../voiceovers/`) and the authorised beat (`/Users/mac/work/web3/sui/parius/marketing/audio/beat.mp3`) must be present.

## Prepare, preview, render

```sh
pnpm install
pnpm assets          # verify evidence hashes; write reviewed crops + fonts to public/ (ignored)
pnpm audio           # cut/normalise the voice at measured pauses; splice the music bed
pnpm studio          # preview in Remotion Studio

pnpm render:animatic # out/offboard-animatic.mp4 (captions burned in, "animatic" tag)
pnpm captions        # out/offboard-captions.srt
pnpm thumbnail       # out/thumbnail.png
pnpm contact-sheet   # out/contact-sheet.png (one frame every 5 s)
pnpm typecheck
```

`pnpm render` produces `out/offboard-demo.mp4` without the animatic tag. Use it once the screen recordings listed below replace the stand-in stills — or if the owner decides the current cut is the submission.

Props (`--props='{…}'`): `captions` (burn captions in), `animatic` (show the small animatic tag), `music` (include the bed). Renders are mastered by `scripts/master.sh` to about −14 LUFS, true peak ≤ −1.5 dBTP, AAC 256 kbps.

`pnpm stills <dir> <seconds…>` renders full-resolution review frames from one bundle.

## Editing

- Timing lives in `src/data/timeline.ts`: scene windows, voice piece placement, phrase captions (measured pauses) and music ducking.
- Footage and on-screen run labels live in `src/data/footage.ts`; crops and redactions in `scripts/prepare-assets.sh`.
- Scenes are in `src/scenes/`; shared primitives (evidence `Shot` with camera keys and selection marks, run labels, line, wordmark) in `src/primitives/`.

## Still needed for the final film

The cut uses genuine captures, but several are stills where a continuous screen recording should go. Record at 1080p or higher, notifications hidden, a few seconds of stillness around each decisive action, into the ignored `.local/demo-evidence/recordings/`:

1. `01-case-and-switch.mp4` — the departure case page, the human room request, the agent's live investigation and findings. Replaces the dashboard crop and the thread stills (16–57.5 s).
2. `02-email-decision.mp4` — the proposal email, the private review page (URL token and recipient hidden), identity confirmation and approval. Replaces the earlier-run stills (57.5–86 s). Needs a fresh controlled grant and a new human decision by the operator.
3. `03-verification-and-room.mp4` — provider outcome, independent check, saved report page and the agent's reply in the room (86–126 s). There is no capture yet of the saved report page itself.
4. `04-controls.mp4` — protected-account refusal and unchecked-provider status (126–139 s).

Upload to YouTube or Loom (public or unlisted) is done by the owner.
