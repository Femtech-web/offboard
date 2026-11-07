"""Checks evidence originals against the local manifest before any derivative is made.

Usage: python3 -I verify-originals.py <evidence-manifest.json> <repo root> <capture.json>
Read-only: hashes files, never writes.
"""
import hashlib
import json
import sys
from pathlib import Path

USED = {
    ".local/demo-evidence/originals/2026-11-07-1525-switch-controlled-removal-summary.png",
    ".local/demo-evidence/originals/2026-11-07-1525-switch-controlled-removal-confirmation.png",
    ".local/demo-evidence/originals/2026-11-07-1525-switch-controlled-investigation.png",
    ".local/demo-evidence/originals/2026-11-07-1551-hosted-switch-investigation.png",
    ".local/demo-evidence/originals/2026-11-07-143344-original-approval-email-later.png",
    ".local/demo-evidence/originals/2026-11-07-143152-email-review-stale-controls.png",
    ".local/demo-evidence/originals/2026-11-07-143445-email-approval-recorded.png",
    ".local/demo-evidence/originals/2026-11-07-1617-overview-cleaned-desktop.png",
}


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> int:
    manifest = json.loads(Path(sys.argv[1]).read_text())
    repo = Path(sys.argv[2])
    capture = json.loads(Path(sys.argv[3]).read_text())
    known = {a["path"]: a["sha256"] for a in manifest["assets"]}
    bad = []
    for rel in sorted(USED):
        if rel not in known:
            bad.append(f"not in manifest: {rel}")
        elif sha(repo / rel) != known[rel]:
            bad.append(f"hash mismatch: {rel}")
    frames_root = repo / ".local/demo-evidence/recordings"
    for f in capture["frames"]:
        if sha(frames_root / f["sourceFile"]) != f["sha256"]:
            bad.append(f"frame hash mismatch: {f['sourceFile']}")
    if bad:
        print("\n".join(bad), file=sys.stderr)
        return 1
    print(f"Verified {len(USED)} originals and {len(capture['frames'])} walkthrough frames against their recorded SHA-256.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
