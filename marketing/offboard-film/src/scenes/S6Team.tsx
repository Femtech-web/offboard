import React from 'react';
import {color, SAFE, W, H} from '../brand';
import {RUN, SRC} from '../data/footage';
import {Fill, Kicker, Reveal, RunLabel, Shot, text, useT} from '../primitives';

// 116.5–139 s. Evidence back to the team: the agent's genuine same-thread
// confirmation, the remaining coverage, and — from a separate, clearly labelled
// hosted read-only check — a protected owner account that is never proposed.
// Only the first line is narrated; the two evidence beats carry short callouts.

const FULL = {x: 0, y: 0, w: W, h: H};

const Callout: React.FC<{at: number; until: number; kicker: string; children: React.ReactNode}> = ({at, until, kicker, children}) => (
  <div style={{position: 'absolute', left: SAFE, bottom: SAFE}}>
    <Reveal at={at} until={until} lift={12}>
      <div
        style={{
          padding: '22px 30px 26px',
          borderRadius: 18,
          background: 'rgba(13,16,23,0.95)',
          border: `1px solid ${color.border}`,
          boxShadow: '0 30px 70px rgba(0,0,0,0.45)',
          maxWidth: 1100,
        }}
      >
        <Kicker style={{fontSize: 22}}>{kicker}</Kicker>
        <div style={text(42, 500, {marginTop: 8})}>{children}</div>
      </div>
    </Reveal>
  </div>
);

export const S6Team: React.FC = () => {
  const t = useT();
  return (
    <Fill style={{background: color.bg}}>
      {t < 4.6 ? (
        <Shot
          src={SRC.readBack}
          box={FULL}
          cams={[
            {at: 0.2, x: 1150, y: 600, w: 1640},
            {at: 2.4, x: 1150, y: 870, w: 1640},
          ]}
          marks={[{x: 1304, y: 1440, w: 1400, h: 72, from: 2.3}]}
        />
      ) : null}

      {t >= 4.6 && t < 9.6 ? (
        <Shot
          src={SRC.summary}
          box={FULL}
          cams={[{at: 4.6, x: 1250, y: 250, w: 1500}]}
          marks={[
            {x: 1304, y: 322, w: 1380, h: 40, from: 5.0},
            {x: 1304, y: 360, w: 1380, h: 40, from: 6.6, kind: 'under'},
          ]}
        />
      ) : null}

      {t >= 9.6 && t < 16.0 ? (
        <Shot
          src={SRC.confirmation}
          box={FULL}
          cams={[{at: 9.6, x: 1250, y: 960, w: 1500}]}
          marks={[
            {x: 1304, y: 1252, w: 1420, h: 36, from: 10.1, kind: 'under'},
            {x: 1304, y: 1290, w: 1060, h: 36, from: 10.4, kind: 'under'},
            {x: 1304, y: 1350, w: 1420, h: 40, from: 12.4},
          ]}
        />
      ) : null}

      {t >= 16.0 ? (
        <Shot
          src={SRC.hosted}
          box={FULL}
          cams={[{at: 16.0, x: 1100, y: 700, w: 1700}]}
          marks={[
            {x: 1304, y: 900, w: 1400, h: 40, from: 16.7},
            {x: 1304, y: 1384, w: 760, h: 32, from: 18.4, kind: 'under'},
          ]}
        />
      ) : null}

      <Callout at={10.6} until={16.0} kicker="Coverage stays honest">
        Unchecked systems stay on the record. The agent approves nothing.
      </Callout>
      <Callout at={17.2} until={22.6} kicker="Protected accounts">
        The organization owner is never proposed for removal.
      </Callout>

      <RunLabel label="Same thread · completed test, 7 November" at={0.3} until={4.6} />
      <RunLabel label={RUN.records} at={4.8} until={16.0} />
      <RunLabel label={RUN.hosted} at={16.2} tone="attention" />
    </Fill>
  );
};
