import React from 'react';
import {color, W, H} from '../brand';
import {RUN, SRC} from '../data/footage';
import {Fill, RunLabel, Shot, useT} from '../primitives';
import {ThreadClip} from '../primitives/thread';

// 25–62 s. The shared conversation is the centre of the film. All footage is the
// genuine controlled-run thread in the Switch-connected Mattermost room
// (walkthrough frames captured 7 Nov). The camera establishes, then holds close
// crops long enough to read the request, the agent's tools and the discovered grant.

const FULL = {x: 0, y: 0, w: W, h: H};
/** Wide shots sit in an inset window, leaving room for the run label. */
const WINDOW = {x: 160, y: 150, w: 1600, h: 900};

export const S3Switch: React.FC = () => {
  const t = useT();
  return (
    <Fill style={{background: color.bg}}>
      {/* 0–4: establish the room (recorded walkthrough frames, real cadence) */}
      {t < 4.0 ? (
        <ThreadClip
          from={60}
          to={66}
          at={0}
          box={WINDOW}
          panel
          cams={[
            {at: 0.4, x: 0, y: 0, w: 2800},
            {at: 3.8, x: 1000, y: 110, w: 1800},
          ]}
        />
      ) : null}

      {/* 4–12: the human's request */}
      {t >= 4.0 && t < 12.0 ? (
        <Shot
          src={SRC.request}
          box={FULL}
          cams={[
            {at: 4.0, x: 1230, y: 130, w: 1560},
            {at: 11.8, x: 1250, y: 140, w: 1500},
          ]}
          marks={[
            {x: 1304, y: 292, w: 288, h: 46, from: 4.8},
            {x: 1696, y: 459, w: 1020, h: 36, from: 8.2, kind: 'under'},
            {x: 1304, y: 499, w: 392, h: 36, from: 8.6, kind: 'under'},
          ]}
        />
      ) : null}

      {/* 12–19.5: the agent's recorded tool activity for that request */}
      {t >= 12.0 && t < 19.5 ? (
        <Shot
          src={SRC.activity}
          box={FULL}
          cams={[{at: 12.0, x: 1230, y: 145, w: 1560}]}
          marks={[
            {x: 1304, y: 512, w: 360, h: 162, from: 13.0},
            {x: 1672, y: 796, w: 820, h: 34, from: 16.0, kind: 'under'},
          ]}
        />
      ) : null}

      {/* 19.5–30: the saved findings — the grant this film follows */}
      {t >= 19.5 && t < 30.0 ? (
        <Shot
          src={SRC.request}
          box={FULL}
          cams={[
            {at: 19.5, x: 1230, y: 560, w: 1560},
            {at: 23.5, x: 1270, y: 840, w: 1440},
          ]}
          marks={[
            {x: 1304, y: 1087, w: 356, h: 32, from: 20.4, kind: 'under'},
            {x: 1304, y: 1137, w: 1390, h: 42, from: 21.6},
          ]}
        />
      ) : null}

      {/* 30–37: the whole thread — the team sees the same investigation */}
      {t >= 30.0 ? (
        <Shot
          src={SRC.request}
          box={WINDOW}
          panel
          enter={30.0}
          cams={[{at: 30.0, x: 0, y: 0, w: 2800}]}
          marks={[{x: 1170, y: 200, w: 1590, h: 1320, from: 31.0}]}
        />
      ) : null}

      <RunLabel label={RUN.completedTest} at={0.3} until={12.0} />
      <RunLabel label="The agent worked for 57 s · recorded activity" at={12.2} until={19.5} />
      <RunLabel label="Scan saved 14:21:42 UTC · completed test, 7 November" at={19.7} until={30.0} />
      <RunLabel label={RUN.thread} at={30.2} />
    </Fill>
  );
};
