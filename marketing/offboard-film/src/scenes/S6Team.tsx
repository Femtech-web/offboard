import React from 'react';
import {color, W, H} from '../brand';
import {RUN, SRC} from '../data/footage';
import {Fill, RunLabel, Shot, useT} from '../primitives';

// 130–152.5 s. Evidence back to the team: the agent's genuine same-thread
// confirmation, the remaining coverage, and — from a separate, clearly labelled
// hosted read-only check — a protected owner account that is never proposed.

const FULL = {x: 0, y: 0, w: W, h: H};

export const S6Team: React.FC = () => {
  const t = useT();
  return (
    <Fill style={{background: color.bg}}>
      {t < 4.2 ? (
        <Shot
          src={SRC.readBack}
          box={FULL}
          cams={[{at: 0, x: 1150, y: 600, w: 1640}]}
          marks={[{x: 1304, y: 1440, w: 1400, h: 72, from: 1.4}]}
        />
      ) : null}

      {t >= 4.2 && t < 9.5 ? (
        <Shot
          src={SRC.summary}
          box={FULL}
          cams={[{at: 4.2, x: 1250, y: 250, w: 1500}]}
          marks={[
            {x: 1304, y: 322, w: 1380, h: 40, from: 4.8},
            {x: 1304, y: 360, w: 1380, h: 40, from: 6.2, kind: 'under'},
          ]}
        />
      ) : null}

      {t >= 9.5 && t < 16.0 ? (
        <Shot
          src={SRC.confirmation}
          box={FULL}
          cams={[{at: 9.5, x: 1250, y: 960, w: 1500}]}
          marks={[
            {x: 1304, y: 1252, w: 1420, h: 36, from: 10.0, kind: 'under'},
            {x: 1304, y: 1290, w: 1060, h: 36, from: 10.3, kind: 'under'},
            {x: 1304, y: 1350, w: 1420, h: 40, from: 12.6},
          ]}
        />
      ) : null}

      {t >= 16.0 ? (
        <Shot
          src={SRC.hosted}
          box={FULL}
          cams={[{at: 16.0, x: 1230, y: 640, w: 1560}]}
          marks={[
            {x: 1304, y: 900, w: 1400, h: 40, from: 16.8},
            {x: 1304, y: 1384, w: 760, h: 32, from: 18.8, kind: 'under'},
          ]}
        />
      ) : null}

      <RunLabel label="Same thread · completed test, 7 November" at={0.3} until={4.2} />
      <RunLabel label={RUN.records} at={4.4} until={16.0} />
      <RunLabel label={RUN.hosted} at={16.2} tone="attention" />
    </Fill>
  );
};
