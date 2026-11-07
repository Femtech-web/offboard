import React from 'react';
import {color, W, H} from '../brand';
import {RUN, SRC} from '../data/footage';
import {Fill, RunLabel, Shot, useT} from '../primitives';
import {ThreadClip} from '../primitives/thread';

// 24.5–57.5 s. The shared conversation is the centre of the film. All footage is the
// genuine controlled-run thread in the Switch-connected Mattermost room
// (walkthrough frames captured 7 Nov). The camera establishes, then holds close
// crops long enough to read the request, the agent's tools and the discovered grant.
// Local times follow the founder's clip 03 (see data/timeline.ts).

const FULL = {x: 0, y: 0, w: W, h: H};
/** Wide shots sit in an inset window, leaving room for the run label. */
const WINDOW = {x: 160, y: 150, w: 1600, h: 900};

export const S3Switch: React.FC = () => {
  const t = useT();
  return (
    <Fill style={{background: color.bg}}>
      {/* 0–3.2: establish the room (recorded walkthrough frames, real cadence) */}
      {t < 3.2 ? (
        <ThreadClip
          from={60}
          to={66}
          at={0}
          box={WINDOW}
          panel
          cams={[
            {at: 0.2, x: 0, y: 0, w: 2800},
            {at: 3.1, x: 1000, y: 110, w: 1800},
          ]}
        />
      ) : null}

      {/* 3.2–11.6: the human's request ("I ask Offboard to investigate") */}
      {t >= 3.2 && t < 11.6 ? (
        <Shot
          src={SRC.request}
          box={FULL}
          cams={[
            {at: 3.2, x: 1230, y: 130, w: 1560},
            {at: 11.4, x: 1250, y: 140, w: 1500},
          ]}
          marks={[
            {x: 1304, y: 292, w: 288, h: 46, from: 3.6},
            {x: 1696, y: 459, w: 1020, h: 36, from: 8.4, kind: 'under'},
            {x: 1304, y: 499, w: 392, h: 36, from: 8.8, kind: 'under'},
          ]}
        />
      ) : null}

      {/* 11.6–15.5: the agent's recorded tool activity for that request */}
      {t >= 11.6 && t < 15.5 ? (
        <Shot
          src={SRC.activity}
          box={FULL}
          cams={[{at: 11.6, x: 1230, y: 145, w: 1560}]}
          marks={[
            {x: 1304, y: 512, w: 360, h: 162, from: 12.3},
            {x: 1672, y: 796, w: 820, h: 34, from: 13.9, kind: 'under'},
          ]}
        />
      ) : null}

      {/* 15.5–27.5: the saved findings — the grant this film follows */}
      {t >= 15.5 && t < 27.5 ? (
        <Shot
          src={SRC.request}
          box={FULL}
          cams={[
            {at: 15.5, x: 1230, y: 560, w: 1560},
            {at: 19.2, x: 1230, y: 560, w: 1560},
            {at: 22.6, x: 1270, y: 840, w: 1440},
          ]}
          marks={[
            {x: 1304, y: 1087, w: 356, h: 32, from: 15.8, kind: 'under'},
            {x: 1304, y: 1137, w: 1390, h: 42, from: 17.3},
          ]}
        />
      ) : null}

      {/* 27.5–33: the whole thread — the team sees the same investigation */}
      {t >= 27.5 ? (
        <Shot
          src={SRC.request}
          box={WINDOW}
          panel
          enter={27.5}
          cams={[{at: 27.5, x: 0, y: 0, w: 2800}]}
          marks={[{x: 1170, y: 200, w: 1590, h: 1320, from: 28.2}]}
        />
      ) : null}

      <RunLabel label={RUN.completedTest} at={0.3} until={11.6} />
      <RunLabel label="The agent worked for 57 s · recorded activity" at={11.8} until={15.5} />
      <RunLabel label="Scan completed 14:21:42 UTC · completed test, 7 November" at={15.7} until={27.5} />
      <RunLabel label={RUN.thread} at={27.7} />
    </Fill>
  );
};
