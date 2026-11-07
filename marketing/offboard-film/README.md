# Offboard film

Editable Remotion source for the [published Offboard demo](https://youtu.be/ozrkW6IDafw), a 2:34 walkthrough of the controlled GitHub workflow. This project has its own dependencies and is separate from the application.

The film combines the founder's narration, genuine Switch and application captures, and explanatory typography. [SOURCES.md](SOURCES.md) maps each decisive shot to its original evidence and run. The captures include completed tests and a separate hosted read-only check, identified in the edit.

## Requirements

Use Node.js 24, pnpm, ffmpeg/ffprobe, and Python 3. Preparing the original film also requires the private evidence archive (`../../.local/demo-evidence/`), the founder's recordings (`../voiceovers/`), and owner-authorized music. Original inbox captures, private review links, and music are not distributed with the project. These assets are not needed to run Offboard.

Place the authorized music at `../audio/beat.mp3`, or set `OFFBOARD_FILM_MUSIC` to its local path. Use your own licensed assets when adapting the film.

## Prepare, preview, render

```sh
pnpm install
pnpm assets          # verify evidence hashes; write reviewed crops + fonts to public/ (ignored)
pnpm audio           # cut/normalise the voice at measured pauses; splice the music bed
pnpm studio          # preview in Remotion Studio

pnpm render          # out/offboard-demo.mp4
pnpm captions        # out/offboard-captions.srt
pnpm thumbnail       # out/thumbnail.png
pnpm contact-sheet   # out/contact-sheet.png (one frame every 5 s)
pnpm typecheck
```

Optional props are `captions` (burn captions in), `animatic` (label a preview cut), and `music` (include the music bed). `pnpm render:animatic` exports a labeled preview. Renders are mastered by `scripts/master.sh` to about −14 LUFS, true peak ≤ −1.5 dBTP, AAC 256 kbps.

`pnpm stills <dir> <seconds…>` renders full-resolution review frames from one bundle.

## Editing

- Timing lives in `src/data/timeline.ts`: scene windows, voice piece placement, phrase captions (measured pauses) and music ducking.
- Footage and on-screen run labels live in `src/data/footage.ts`; crops and redactions in `scripts/prepare-assets.sh`.
- Scenes are in `src/scenes/`; shared primitives (evidence `Shot` with camera keys and selection marks, run labels, line, wordmark) in `src/primitives/`.

Keep original evidence unchanged. Review publication copies for private tokens and unrelated inbox content. Preserve each capture's run attribution and the distinction between a provider response and an independent verification result. Final exports, generated assets, and the private capture archive remain outside Git.
