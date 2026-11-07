import React from 'react';
import {color, LIVE_URL} from '../brand';
import {Fill, Reveal, text, Wordmark} from '../primitives';

// 160.5–166 s. Wordmark, the line, and the live URL held for more than four seconds.

export const S8Close: React.FC = () => (
  <Fill style={{background: color.bg}}>
    <div style={{position: 'absolute', left: 0, right: 0, top: 250, display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
      <Reveal at={0.1}>
        <Wordmark scale={1.5} />
      </Reveal>
      <Reveal at={0.6}>
        <div style={text(76, 500, {marginTop: 70, textAlign: 'center'})}>
          When someone leaves,
          <br />
          <span style={{color: color.lavender}}>prove their access is gone.</span>
        </div>
      </Reveal>
      <Reveal at={0.4}>
        <div
          style={{
            marginTop: 64,
            padding: '16px 30px',
            borderRadius: 999,
            border: `1px solid ${color.border}`,
            background: color.surface,
            ...text(34, 500),
          }}
        >
          {LIVE_URL}
        </div>
      </Reveal>
      <Reveal at={0.6}>
        <div style={text(24, 400, {color: color.muted, marginTop: 22})}>github.com/Femtech-web/offboard</div>
      </Reveal>
    </div>
  </Fill>
);
