// Renders selected film moments as full-resolution stills from one bundle.
// Usage: pnpm exec tsx scripts/stills.ts <outDir> <seconds...>
import {mkdirSync} from 'node:fs';
import path from 'node:path';
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';

const [outDir, ...secs] = process.argv.slice(2);
if (!outDir || secs.length === 0) throw new Error('usage: stills.ts <outDir> <seconds...>');
mkdirSync(outDir, {recursive: true});
const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts'), publicDir: path.resolve('public')});
const inputProps = {captions: true, animatic: true, music: false};
const composition = await selectComposition({serveUrl, id: 'OffboardFilm', inputProps});
for (const s of secs) {
  const frame = Math.round(Number(s) * composition.fps);
  const output = path.join(outDir, `t${String(s).padStart(6, '0')}.png`);
  try {
    await renderStill({serveUrl, composition, frame, output, inputProps});
    console.log(output);
  } catch (e) {
    console.error(`frame ${frame} (${s}s) failed: ${(e as Error).message.split('\n')[0]}`);
  }
}
