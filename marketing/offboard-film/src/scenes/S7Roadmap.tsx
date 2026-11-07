import React from 'react';
import {color, SAFE} from '../brand';
import {easeOut, Fill, Kicker, ramp, Reveal, Rule, text, useT} from '../primitives';

// 152.5–160.5 s. A simple brand graphic for the roadmap. Planned, not available:
// no provider screens and no launch date.

const PLANNED = [
  {name: 'Vercel', at: 4.1},
  {name: 'Jira', at: 4.7},
  {name: 'Trello', at: 5.3},
  {name: 'Custom sites', at: 6.0},
];

export const S7Roadmap: React.FC = () => {
  const t = useT();
  const tileW = 380;
  const gap = 28;
  const left = SAFE + 24;
  const top = 560;
  return (
    <Fill style={{background: color.bg}}>
      <div style={{position: 'absolute', left, top: 200}}>
        <Reveal at={0.3}>
          <Kicker>Planned integrations</Kicker>
        </Reveal>
        <Reveal at={0.5}>
          <div style={text(68, 500, {marginTop: 20, width: 1400})}>For the tools your organization and team rely on.</div>
        </Reveal>
        <Reveal at={1.2}>
          <div style={{display: 'inline-flex', alignItems: 'center', gap: 12, marginTop: 34, ...text(26, 500, {color: color.muted})}}>
            <span style={{width: 10, height: 10, borderRadius: 10, background: color.success}} />
            Working today: GitHub organization access
          </div>
        </Reveal>
      </div>
      <Rule x={left} y={top - 34} w={4 * tileW + 3 * gap} at={3.6} dur={1.0} />
      {PLANNED.map((p, i) => {
        const v = ramp(t, p.at, p.at + 0.45, easeOut);
        return (
          <div
            key={p.name}
            style={{
              position: 'absolute',
              left: left + i * (tileW + gap),
              top,
              width: tileW,
              height: 200,
              boxSizing: 'border-box',
              padding: '34px 34px',
              borderRadius: 20,
              border: `1px solid ${color.border}`,
              background: color.surface,
              opacity: v,
              transform: `translateY(${(1 - v) * 18}px)`,
            }}
          >
            <div style={text(22, 500, {color: color.lavender})}>Planned</div>
            <div style={text(48, 500, {marginTop: 26})}>{p.name}</div>
          </div>
        );
      })}
    </Fill>
  );
};
