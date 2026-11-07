import {loadFont} from '@remotion/fonts';
import {staticFile} from 'remotion';
import {FONT} from './brand';

// PP Neue Montreal Regular, Medium and Bold, copied from the app's src/assets/fonts
// by scripts/prepare-assets.sh. display: 'block' keeps the first frame from rendering
// a fallback face.
const faces = [
  {file: 'PPNeueMontreal-Regular.woff2', weight: '400'},
  {file: 'PPNeueMontreal-Medium.woff2', weight: '500'},
  {file: 'PPNeueMontreal-Bold.woff2', weight: '700'},
];

export const fontsReady = Promise.all(
  faces.map((f) =>
    loadFont({family: FONT, url: staticFile(`fonts/${f.file}`), weight: f.weight, style: 'normal', display: 'block'}),
  ),
);
