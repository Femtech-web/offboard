#!/usr/bin/env bash
# Builds the film's reviewed footage from the repository's ignored local evidence.
# Originals are only read (their manifest SHA-256 is checked first); every output
# is a derived copy under public/, which Git ignores. Private regions (approval
# URLs, recipient address, inbox/browser chrome, admin email) are cropped out here,
# so the Remotion source never touches an unreviewed original.
set -euo pipefail

FILM="$(cd "$(dirname "$0")/.." && pwd)"
REPO="$(cd "$FILM/../.." && pwd)"
EVID="$REPO/.local/demo-evidence"
ORIG="$EVID/originals"
FRAMES="$EVID/recordings/2026-11-07-switch-read-only/frames"
WALK="$EVID/recordings/2026-11-07-completed-session-walkthrough"
OUT="$FILM/public/footage"

[ -d "$ORIG" ] || { echo "Missing $ORIG — the local evidence archive is required." >&2; exit 1; }
mkdir -p "$OUT/thread" "$FILM/public/fonts"

python3 -I "$FILM/scripts/verify-originals.py" "$EVID/evidence-manifest.json" "$REPO" "$WALK/capture.json"

ff() { ffmpeg -hide_banner -v error -y "$@"; }

# Brand fonts (already committed in the app; copied, not modified).
cp "$REPO"/src/assets/fonts/PPNeueMontreal-{Regular,Medium,Bold}.woff2 "$FILM/public/fonts/"

# 1. Completed-session walkthrough: native 2800x1800 Switch frames (JPEG data in .png
#    files). Bytes are copied unchanged under a .jpg name so the browser decodes them.
for n in $(seq 39 92); do
  src=$(printf "%s/frame-%05d.png" "$FRAMES" "$n")
  cp "$src" "$OUT/thread/$(printf "f%02d.jpg" "$n")"
done

# 2. 1400x900 native Switch captures, upscaled 2x (Lanczos) into the same
#    2800x1800 coordinate space as the walkthrough frames. No content change.
for name in switch-controlled-removal-summary switch-controlled-removal-confirmation switch-controlled-investigation; do
  ff -i "$ORIG/2026-11-07-1525-$name.png" -vf "scale=2800:1800:flags=lanczos" "$OUT/$name.png"
done
# Reviewed documentation copy of the separate hosted read-only check.
ff -i "$REPO/docs/images/switch-hosted-investigation.png" -vf "scale=2800:1800:flags=lanczos" "$OUT/hosted-investigation.png"

# 3. Email decision (earlier controlled run, same account). Source 3456x2024.
#    Proposal email: subject, sender and target lines only. The private review URL
#    (and everything below it), Gmail navigation, inbox counts, calendar and
#    browser tabs/address bar are outside the crop.
ff -i "$ORIG/2026-11-07-143344-original-approval-email-later.png" -vf "crop=2080:500:540:470" "$OUT/email-proposal.png"
#    Review page, part A: action title and target fields. Stops above
#    "Authorized recipient" so the recipient address is excluded.
ff -i "$ORIG/2026-11-07-143152-email-review-stale-controls.png" -vf "crop=1300:640:1080:250" "$OUT/review-target.png"
#    Review page, part B: the identity confirmation, approval checkbox and buttons.
ff -i "$ORIG/2026-11-07-143152-email-review-stale-controls.png" -vf "crop=1300:440:1080:1300" "$OUT/review-controls.png"
#    Approval recorded: page heading and result card; URL bar excluded.
ff -i "$ORIG/2026-11-07-143445-email-approval-recorded.png" -vf "crop=1340:800:1060:520" "$OUT/approval-recorded.png"

# 4. Dashboard overview: content column only (the sidebar's admin email is excluded),
#    upscaled 1.5x for the case close-up.
ff -i "$ORIG/2026-11-07-1617-overview-cleaned-desktop.png" -vf "crop=1000:900:270:0,scale=1500:1350:flags=lanczos" "$OUT/overview.png"

echo "Prepared reviewed footage in $OUT"
ls -1 "$OUT" | sed 's/^/  /'
