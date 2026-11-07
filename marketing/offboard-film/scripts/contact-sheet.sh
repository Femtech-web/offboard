#!/usr/bin/env bash
# Contact sheet of a render: one frame every 5 s, 6 columns.
# Usage: bash scripts/contact-sheet.sh [out/offboard-animatic.mp4] [out/contact-sheet.png]
set -euo pipefail
in="${1:-out/offboard-animatic.mp4}"; out="${2:-out/contact-sheet.png}"
dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$in")
n=$(python3 -I -c "import math; print(math.ceil($dur/5))")
rows=$(python3 -I -c "import math; print(math.ceil($n/6))")
ffmpeg -hide_banner -v error -y -i "$in" -vf "fps=1/5,scale=480:-1,tile=6x${rows}:padding=6:margin=6:color=0x0D1017" -frames:v 1 "$out"
echo "$out ($n frames, ${rows} rows)"
