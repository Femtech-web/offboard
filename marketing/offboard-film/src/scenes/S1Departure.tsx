import React from 'react';
import {color, SAFE} from '../brand';
import {ease, easeOut, Fill, Kicker, ramp, Reveal, Rule, text, useT, Wordmark} from '../primitives';

// 0–16 s. The founder's own account, told typographically (no employer, no logos),
// then Offboard's find → remove → verify, carried by the lavender line.

const ACCESS = ['GitHub', 'Apple', 'Vercel'];

const AccessRow: React.FC<{name: string; at: number; y: number}> = ({name, at, y}) => {
  const t = useT();
  const p = ramp(t, at, at + 0.5, easeOut);
  return (
    <div
      style={{
        position: 'absolute',
        left: 1060,
        top: y,
        width: 764,
        height: 112,
        opacity: p,
        transform: `translateX(${(1 - p) * 30}px)`,
        borderRadius: 18,
        border: `1px solid ${color.border}`,
        background: color.surface,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 36px',
        boxSizing: 'border-box',
      }}
    >
      <div>
        <div style={text(20, 500, {color: color.muted})}>Account access</div>
        <div style={text(40, 500)}>{name}</div>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 18px',
          borderRadius: 999,
          border: `1px solid ${color.attention}55`,
          background: `${color.attention}14`,
          ...text(24, 500, {color: color.attention}),
        }}
      >
        <span style={{width: 10, height: 10, borderRadius: 10, background: color.attention}} />
        Still active
      </div>
    </div>
  );
};

const STEPS = [
  {x: 420, title: 'Find', detail: 'forgotten access', at: 10.0},
  {x: 960, title: 'Remove', detail: 'with human approval', at: 12.5},
  {x: 1500, title: 'Verify', detail: 'the result', at: 14.3},
];

export const S1Departure: React.FC = () => {
  const t = useT();
  const partOne = 1 - ramp(t, 9.0, 9.5);
  const lineY = 640;
  return (
    <Fill style={{background: color.bg}}>
      {/* Part one: the founder's experience */}
      <Fill style={{opacity: partOne}}>
        <div style={{position: 'absolute', left: SAFE + 24, top: 300, width: 860}}>
          <Reveal at={0.2}>
            <Kicker>After I left a team</Kicker>
          </Reveal>
          <Reveal at={0.5}>
            <div style={text(96, 500, {marginTop: 26})}>My work ended.</div>
          </Reveal>
          <Reveal at={1.3}>
            <div style={text(96, 500, {color: color.lavender})}>My access didn’t.</div>
          </Reveal>
          <Reveal at={6.0}>
            <div style={text(34, 400, {color: color.muted, marginTop: 48, lineHeight: 1.35, width: 760})}>
              New code updates kept arriving. Internal code and company information stayed open after the role ended.
            </div>
          </Reveal>
        </div>
        {ACCESS.map((name, i) => (
          <AccessRow key={name} name={name} at={1.9 + i * 0.6} y={300 + i * 136} />
        ))}
      </Fill>

      {/* Part two: what Offboard does */}
      <Fill style={{opacity: ramp(t, 9.4, 9.9)}}>
        <div style={{position: 'absolute', left: 0, right: 0, top: 300, display: 'flex', justifyContent: 'center'}}>
          <Reveal at={9.5}>
            <Wordmark scale={1.35} />
          </Reveal>
        </div>
        <Rule x={260} y={lineY} w={1400} at={9.9} dur={1.2} />
        {/* The line continues off the right edge into the next chapter's wipe. */}
        <Rule x={1660} y={lineY} w={260} at={15.2} dur={0.6} />
        {STEPS.map((s) => {
          const p = ramp(t, s.at, s.at + 0.45, easeOut);
          return (
            <React.Fragment key={s.title}>
              <div
                style={{
                  position: 'absolute',
                  left: s.x - 13,
                  top: lineY - 12,
                  width: 26,
                  height: 26,
                  borderRadius: 26,
                  background: color.bg,
                  border: `2px solid ${color.lavender}`,
                  transform: `scale(${0.4 + 0.6 * p})`,
                  opacity: p,
                }}
              >
                <div style={{position: 'absolute', inset: 5, borderRadius: 20, background: color.lavender, opacity: ramp(t, s.at + 0.2, s.at + 0.6, ease)}} />
              </div>
              <div style={{position: 'absolute', left: s.x - 260, width: 520, top: lineY + 50, textAlign: 'center', opacity: p, transform: `translateY(${(1 - p) * 14}px)`}}>
                <div style={text(56, 500)}>{s.title}</div>
                <div style={text(30, 400, {color: color.muted, marginTop: 8})}>{s.detail}</div>
              </div>
            </React.Fragment>
          );
        })}
      </Fill>
    </Fill>
  );
};
