// Writes phrase-level captions (SRT) from the same cues the film renders.
// Usage: pnpm exec tsx scripts/make-srt.ts [out/offboard-captions.srt]
import {mkdirSync, writeFileSync} from 'node:fs';
import {dirname} from 'node:path';
import {CUES} from '../src/data/timeline';

const ts = (sec: number) => {
  const ms = Math.max(0, Math.round(sec * 1000));
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
};

const target = process.argv[2] ?? 'out/offboard-captions.srt';
mkdirSync(dirname(target), {recursive: true});
writeFileSync(target, CUES.map((c, i) => `${i + 1}\n${ts(c.start - 0.1)} --> ${ts(c.end + 0.15)}\n${c.text}\n`).join('\n'));
console.log(`${CUES.length} cues → ${target}`);
