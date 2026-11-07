import React from 'react';
import {Composition, continueRender, delayRender, Still} from 'remotion';
import {FPS, H, W} from './brand';
import {DURATION} from './data/timeline';
import {Film, filmSchema} from './Film';
import {fontsReady} from './fonts';
import {Thumbnail} from './scenes/Thumbnail';

const handle = delayRender('Loading Neue Montreal');
fontsReady.then(() => continueRender(handle));

export const Root: React.FC = () => (
  <>
    <Composition
      id="OffboardFilm"
      component={Film}
      schema={filmSchema}
      durationInFrames={Math.round(DURATION * FPS)}
      fps={FPS}
      width={W}
      height={H}
      defaultProps={{captions: true, animatic: true, music: true}}
    />
    <Still id="Thumbnail" component={Thumbnail} width={W} height={H} />
  </>
);
