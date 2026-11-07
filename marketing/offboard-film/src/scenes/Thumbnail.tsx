import React from 'react';
import {AbsoluteFill} from 'remotion';
import {color, SAFE} from '../brand';
import {SRC} from '../data/footage';
import {Shot, text, TimeContext, Wordmark} from '../primitives';

// Thumbnail: the promise beside the real discovered grant from the Switch thread.
export const Thumbnail: React.FC = () => (
  <TimeContext.Provider value={10}>
    <AbsoluteFill style={{background: color.bg}}>
      <div style={{position: 'absolute', left: SAFE + 24, top: 120}}>
        <Wordmark scale={1.1} />
      </div>
      <div style={{position: 'absolute', left: SAFE + 24, top: 300, width: 900}}>
        <div style={text(104, 500)}>
          When someone leaves, <span style={{color: color.lavender}}>prove their access is gone.</span>
        </div>
        <div style={text(34, 400, {color: color.muted, marginTop: 40})}>Investigate in Switch · Human approval · Independent verification</div>
      </div>
      <Shot
        src={SRC.request}
        panel
        box={{x: 1080, y: 250, w: 760, h: 580}}
        cams={[{at: 0, x: 1250, y: 860, w: 1460}]}
        marks={[{x: 1304, y: 1137, w: 1390, h: 42, from: 0}]}
      />
    </AbsoluteFill>
  </TimeContext.Provider>
);
