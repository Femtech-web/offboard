"""Prepare the founder's voice and the authorised music bed for the Offboard film.

Voice: the six recordings in marketing/voiceovers/ are cut only at measured pauses
(ffmpeg silencedetect, -38 dB, >=0.28 s), high-passed, lightly compressed and
two-pass loudness-normalised. No time-stretching, pitch change or word edits.

Music: marketing/audio/beat.mp3 from the Parius project, used with the owner's
permission (7 Nov 2026). The track is 101 s; the film needs ~155 s, so it plays
once to 78.289 s and continues from 22.475 s (a 55.814 s, envelope-matched,
bar-aligned jump), joined with a 60 ms equal-power crossfade just before a kick.

Run from marketing/offboard-film:  python3 -I scripts/prepare-audio.py
Writes public/audio/ (Git-ignored) and src/data/audio.json.
"""
import json
import pathlib
import re
import subprocess

FILM = pathlib.Path(__file__).resolve().parents[1]
VO_SRC = FILM.parent / "voiceovers"
BEAT = pathlib.Path("/Users/mac/work/web3/sui/parius/marketing/audio/beat.mp3")
OUT = FILM / "public/audio"
(OUT / "vo").mkdir(parents=True, exist_ok=True)

# piece id: (source file, trim start s, trim end s). Every edge sits inside a
# measured pause; 03b/03c split one sentence at its comma pause (10.99–11.67 s).
PIECES = {
    "01": ("Off-1.m4a", 0.70, 16.30),
    "02": ("off-2.m4a", 0.45, 7.30),
    "03a": ("Off-3.m4a", 0.10, 8.78),
    "03b": ("Off-3.m4a", 8.78, 11.33),
    "03c": ("Off-3.m4a", 11.33, 15.20),
    "03d": ("Off-3.m4a", 15.20, 18.60),
    "04a": ("Off-4.m4a", 0.40, 3.34),
    "04b": ("Off-4.m4a", 3.34, 9.58),
    "04c": ("Off-4.m4a", 9.58, 15.40),
    "05a": ("Off-5.m4a", 0.60, 5.56),
    "05b": ("Off-5.m4a", 5.56, 11.38),
    "05c": ("Off-5.m4a", 11.38, 14.79),
    "05d": ("Off-5.m4a", 14.79, 19.30),
    "06a": ("Off-6.m4a", 0.30, 3.74),
    "06b": ("Off-6.m4a", 3.74, 11.59),
    "06c": ("Off-6.m4a", 11.59, 15.10),
}

MUSIC_SPLICE = {"playTo": 78.2889, "resumeFrom": 22.4750, "crossfade": 0.06, "naturalEnd": 98.73}

VOICE_I, VOICE_TP, VOICE_LRA = -16.0, -2.0, 7.0
CHAIN = "highpass=f=75,acompressor=threshold=-24dB:ratio=2.2:attack=10:release=180:makeup=1"


def run(args):
    return subprocess.run(args, check=True, capture_output=True, text=True)


def duration(p):
    return float(run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)]).stdout)


def voice(src, dst, start, end):
    dur = end - start
    fade = f"afade=t=in:d=0.015,afade=t=out:st={dur - 0.12:.3f}:d=0.12"
    pre = ["ffmpeg", "-v", "info", "-y", "-ss", f"{start}", "-to", f"{end}", "-i", str(src)]
    measure = run(pre + ["-af", f"{CHAIN},{fade},loudnorm=I={VOICE_I}:TP={VOICE_TP}:LRA={VOICE_LRA}:print_format=json", "-f", "null", "-"]).stderr
    m = json.loads(re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", measure, re.S).group(0))
    norm = (
        f"loudnorm=I={VOICE_I}:TP={VOICE_TP}:LRA={VOICE_LRA}:measured_I={m['input_i']}:measured_TP={m['input_tp']}"
        f":measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true"
    )
    run(pre + ["-af", f"{CHAIN},{fade},{norm}", "-ar", "48000", "-ac", "1", "-c:a", "pcm_s24le", str(dst)])


def music(dst):
    s = MUSIC_SPLICE
    h = s["crossfade"] / 2
    flt = (
        f"[0:a]atrim=0:{s['playTo'] + h:.4f},asetpts=PTS-STARTPTS[a];"
        f"[0:a]atrim={s['resumeFrom'] - h:.4f},asetpts=PTS-STARTPTS[b];"
        f"[a][b]acrossfade=d={s['crossfade']}:c1=qsin:c2=qsin,aresample=48000[m]"
    )
    run(["ffmpeg", "-v", "error", "-y", "-i", str(BEAT), "-filter_complex", flt, "-map", "[m]", "-c:a", "pcm_s16le", str(dst)])


manifest = {"vo": {}, "music": {}}
for pid, (src, a, b) in PIECES.items():
    dst = OUT / "vo" / f"{pid}.wav"
    voice(VO_SRC / src, dst, a, b)
    manifest["vo"][pid] = {"file": f"audio/vo/{pid}.wav", "source": f"marketing/voiceovers/{src}", "trim": [a, b], "seconds": round(duration(dst), 3)}

music(OUT / "music.wav")
s = MUSIC_SPLICE
manifest["music"] = {
    "file": "audio/music.wav",
    "source": "Parius marketing/audio/beat.mp3 (owner-authorised for this film, 7 Nov 2026)",
    "splice": s,
    "seconds": round(duration(OUT / "music.wav"), 3),
    # Where the track's natural ending decays, in the spliced file's time.
    "endsAt": round(s["playTo"] + (s["naturalEnd"] - s["resumeFrom"]), 3),
}

(FILM / "src/data/audio.json").write_text(json.dumps(manifest, indent=1) + "\n")
for k, v in manifest["vo"].items():
    print(f"{k:4s} {v['seconds']:6.2f}s  {v['source']} {v['trim']}")
print("music", manifest["music"]["seconds"], "s; natural end at", manifest["music"]["endsAt"])
