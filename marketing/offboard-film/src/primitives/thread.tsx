import React from 'react';
import {SRC} from '../data/footage';
import {WALKTHROUGH} from '../data/walkthrough';
import {Shot, TimeContext, useT, type Box, type Cam, type Mark} from './index';

/**
 * Plays a range of the completed-session walkthrough frames at their recorded
 * display durations, starting at local time `at`, then holds the last frame.
 * Marks and camera keys use the scene's local clock.
 */
export const ThreadClip: React.FC<{from: number; to: number; at: number; box: Box; cams: Cam[]; marks?: Mark[]; enter?: number; panel?: boolean}> = ({
  from,
  to,
  at,
  box,
  cams,
  marks,
  enter,
  panel,
}) => {
  const t = useT();
  const rows = WALKTHROUGH.filter(([n]) => n >= from && n <= to);
  let elapsed = Math.max(0, t - at);
  let frame = rows[rows.length - 1][0];
  for (const [n, dur] of rows) {
    if (elapsed < dur) {
      frame = n;
      break;
    }
    elapsed -= dur;
  }
  return (
    <TimeContext.Provider value={t}>
      <Shot src={SRC.thread(frame)} box={box} cams={cams} marks={marks} enter={enter} panel={panel} />
    </TimeContext.Provider>
  );
};

/** Seconds the given frame range lasts at its recorded cadence. */
export const threadDuration = (from: number, to: number) =>
  WALKTHROUGH.filter(([n]) => n >= from && n <= to).reduce((s, [, d]) => s + d, 0);
