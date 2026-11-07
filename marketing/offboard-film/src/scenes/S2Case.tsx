import React from 'react';
import {color, SAFE} from '../brand';
import {RUN, SRC} from '../data/footage';
import {easeOut, Fill, Kicker, ramp, Reveal, RunLabel, Shot, text, useT} from '../primitives';

// 16–25 s. One departure case. The dashboard row is real; the facts beside it are a
// typographic summary of the saved case record (person, date, account, organization).

const FACTS: {label: string; value: string; tracked?: boolean}[] = [
  {label: 'Person', value: 'Controlled removal test — Oluwafemi'},
  {label: 'Departure', value: '7 November 2026'},
  {label: 'GitHub account', value: 'oluwafemi-akolade', tracked: true},
  {label: 'Organization', value: 'Optimus-pro-orgs'},
];

export const S2Case: React.FC = () => {
  const t = useT();
  return (
    <Fill style={{background: color.bg}}>
      <div style={{position: 'absolute', left: SAFE + 24, top: 150, width: 640}}>
        <Reveal at={0.2}>
          <Kicker>One departure</Kicker>
        </Reveal>
        <Reveal at={0.4}>
          <div style={text(64, 500, {marginTop: 20})}>One case brings it together.</div>
        </Reveal>
        <div style={{marginTop: 54}}>
          {FACTS.map((f, i) => {
            const at = 1.6 + i * 0.45;
            const p = ramp(t, at, at + 0.45, easeOut);
            const line = f.tracked ? ramp(t, 2.7, 3.5, easeOut) : 0;
            return (
              <div key={f.label} style={{opacity: p, transform: `translateY(${(1 - p) * 12}px)`, marginBottom: 26, position: 'relative'}}>
                <div style={text(22, 500, {color: color.muted})}>{f.label}</div>
                <div style={text(36, 500, {marginTop: 4, color: f.tracked ? color.lavender : color.text})}>{f.value}</div>
                {f.tracked ? (
                  <div style={{position: 'absolute', left: 0, top: 86, width: 330 * line, height: 3, borderRadius: 2, background: color.lavender}} />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <Shot
        src={SRC.overview}
        box={{x: 860, y: 190, w: 964, h: 660}}
        panel
        enter={0.5}
        cams={[
          {at: 0.9, x: 10, y: 0, w: 1480},
          {at: 3.6, x: 10, y: 600, w: 1000},
        ]}
        marks={[{x: 30, y: 800, w: 950, h: 112, from: 4.15}]}
      />
      <RunLabel label={RUN.dashboard} x={860} y={120} at={0.8} />
    </Fill>
  );
};
