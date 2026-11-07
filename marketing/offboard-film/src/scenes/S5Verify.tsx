import React from 'react';
import {color, toneColor, W, H, type Tone} from '../brand';
import {RUN, SRC} from '../data/footage';
import {easeOut, Fill, Kicker, ramp, Reveal, RunLabel, Shot, text, useT} from '../primitives';

// 94–130 s. Remove and recheck. Footage: the agent's same-thread read-back of the
// controlled run's saved records (14:23 UTC). The first check still found access;
// the separate follow-up verified removal. Both are shown, in order.

const FULL = {x: 0, y: 0, w: W, h: H};

const NODES: {x: number; time: string; title: string; detail: string; tone: Tone; at: number}[] = [
  {x: 300, time: '14:23:44', title: 'Human approved', detail: 'Administrator, by email', tone: 'lavender', at: 21.1},
  {x: 740, time: '14:23:48', title: 'GitHub accepted', detail: 'Removal request returned 204', tone: 'lavender', at: 21.8},
  {x: 1180, time: '14:23:50', title: 'First check', detail: 'Access remains', tone: 'attention', at: 22.5},
  {x: 1620, time: '14:23:58', title: 'Follow-up check', detail: 'Verified removed', tone: 'success', at: 23.2},
];

const Timeline: React.FC = () => {
  const t = useT();
  const y = 560;
  const line = ramp(t, 20.9, 23.6, easeOut);
  return (
    <Fill style={{background: color.bg}}>
      <div style={{position: 'absolute', left: 120, top: 170}}>
        <Reveal at={20.6}>
          <Kicker>One report, both results</Kicker>
        </Reveal>
        <Reveal at={20.8}>
          <div style={text(64, 500, {marginTop: 18})}>The first check is kept, not overwritten.</div>
        </Reveal>
      </div>
      <div style={{position: 'absolute', left: 300, top: y - 1, width: 1320 * line, height: 2, background: color.lavender}} />
      {NODES.map((n) => {
        const p = ramp(t, n.at, n.at + 0.45, easeOut);
        const c = toneColor[n.tone];
        return (
          <React.Fragment key={n.time}>
            <div style={{position: 'absolute', left: n.x - 200, width: 400, top: y - 96, textAlign: 'center', opacity: p, ...text(38, 500, {fontVariantNumeric: 'tabular-nums'})}}>
              {n.time}
            </div>
            <div
              style={{
                position: 'absolute',
                left: n.x - 14,
                top: y - 14,
                width: 28,
                height: 28,
                borderRadius: 28,
                background: color.bg,
                border: `2px solid ${c}`,
                opacity: p,
                transform: `scale(${0.4 + 0.6 * p})`,
              }}
            >
              <div style={{position: 'absolute', inset: 6, borderRadius: 20, background: c}} />
            </div>
            <div style={{position: 'absolute', left: n.x - 200, width: 400, top: y + 44, textAlign: 'center', opacity: p, transform: `translateY(${(1 - p) * 12}px)`}}>
              <div style={text(32, 500)}>{n.title}</div>
              <div style={text(26, 500, {color: c, marginTop: 8})}>{n.detail}</div>
            </div>
          </React.Fragment>
        );
      })}
      <Reveal at={24.6}>
        <div style={{position: 'absolute', left: 120, top: 790, width: 1300, ...text(30, 400, {color: color.muted, lineHeight: 1.4})}}>
          The report records the approver, the provider response, the immediate check and the follow-up. The original access-remains report stays unchanged.
        </div>
      </Reveal>
    </Fill>
  );
};

export const S5Verify: React.FC = () => {
  const t = useT();
  return (
    <Fill style={{background: color.bg}}>
      {t < 6.2 ? (
        <Shot
          src={SRC.summary}
          box={FULL}
          cams={[{at: 0, x: 1230, y: 300, w: 1560}]}
          marks={[{x: 1304, y: 612, w: 1416, h: 184, from: 1.0}]}
        />
      ) : null}

      {t >= 6.2 && t < 20.5 ? (
        <Shot
          src={SRC.confirmation}
          box={FULL}
          cams={[
            {at: 6.2, x: 1250, y: 330, w: 1500},
            {at: 9.5, x: 1250, y: 330, w: 1500},
            {at: 10.2, x: 1250, y: 470, w: 1500},
            {at: 13.9, x: 1250, y: 470, w: 1500},
            {at: 14.6, x: 1250, y: 560, w: 1500},
          ]}
          marks={[
            {x: 1304, y: 528, w: 1416, h: 186, from: 8.1, to: 10.0},
            {x: 1304, y: 714, w: 1416, h: 106, from: 10.3, to: 14.2, tone: 'attention'},
            {x: 1304, y: 820, w: 1416, h: 226, from: 15.0, tone: 'success'},
          ]}
        />
      ) : null}

      {t >= 20.5 ? <Timeline /> : null}

      <RunLabel label={RUN.records} at={0.3} until={20.5} />
      <RunLabel label={RUN.diagram} at={20.9} />
    </Fill>
  );
};
