import React from 'react';
import {color, SAFE} from '../brand';
import {RUN, SRC} from '../data/footage';
import {Fill, Kicker, Reveal, RunLabel, Shot, text, useT} from '../primitives';

// 62–94 s. The human decision. Footage: the proposal email, private review page and
// recorded approval from the earlier controlled run on 7 November (same account,
// organization and permission). Crops exclude the private review URL, recipient
// address and inbox details. Labelled on screen as an earlier run.

const PANEL_X = 720;
const PANEL_W = 1104;

const Copy: React.FC<{at: number; until: number; kicker: string; lines: React.ReactNode[]; delays?: number[]}> = ({at, until, kicker, lines, delays}) => (
  <div style={{position: 'absolute', left: SAFE + 24, top: 330, width: 580}}>
    <Reveal at={at} until={until}>
      <Kicker>{kicker}</Kicker>
    </Reveal>
    {lines.map((l, i) => (
      <Reveal key={i} at={at + (delays ? delays[i] : 0.25 + i * 0.9)} until={until}>
        <div style={text(54, 500, {marginTop: i === 0 ? 22 : 6, color: i === 1 ? color.lavender : color.text})}>{l}</div>
      </Reveal>
    ))}
  </div>
);

export const S4Decision: React.FC = () => {
  const t = useT();
  return (
    <Fill style={{background: color.bg}}>
      <Copy at={0.3} until={8.0} kicker="Human decision" lines={['The proposal', 'arrives by email.']} />
      <Copy at={8.2} until={12.7} kicker="Review" lines={['The exact', 'account and access.']} />
      <Copy at={12.9} until={20.6} kicker="Confirm, then decide" lines={['Identity first.', 'Then the removal.']} delays={[0.25, 2.0]} />
      <Copy at={20.8} until={29} kicker="Approval" lines={['The agent investigates.', 'The human approves.']} delays={[0.3, 3.5]} />

      {t < 8.0 ? (
        <Shot
          src={SRC.email}
          panel
          enter={0.4}
          box={{x: PANEL_X, y: 250, w: PANEL_W, h: 600}}
          cams={[{at: 0, x: 80, y: 6, w: 920}]}
          marks={[{x: 108, y: 334, w: 640, h: 112, from: 1.9}]}
        />
      ) : null}

      {t >= 8.0 && t < 12.7 ? (
        <Shot
          src={SRC.reviewTarget}
          panel
          box={{x: PANEL_X, y: 230, w: PANEL_W, h: 600}}
          cams={[
            {at: 8.0, x: 0, y: 0, w: 1180},
            {at: 10.6, x: 30, y: 60, w: 940},
          ]}
          marks={[
            {x: 58, y: 270, w: 440, h: 92, from: 9.4},
            {x: 58, y: 398, w: 440, h: 92, from: 10.1},
          ]}
        />
      ) : null}

      {t >= 12.7 && t < 20.6 ? (
        <Shot
          src={SRC.reviewControls}
          panel
          box={{x: PANEL_X, y: 300, w: PANEL_W, h: 420}}
          cams={[{at: 12.7, x: 30, y: 0, w: 1180}]}
          marks={[
            {x: 60, y: 42, w: 1110, h: 104, from: 13.2},
            {x: 60, y: 205, w: 890, h: 54, from: 15.2},
          ]}
        />
      ) : null}

      {t >= 20.6 ? (
        <Shot
          src={SRC.approved}
          panel
          box={{x: PANEL_X, y: 220, w: PANEL_W, h: 640}}
          cams={[{at: 20.6, x: 0, y: 30, w: 1340}]}
          marks={[
            {x: 84, y: 420, w: 300, h: 48, from: 21.1},
            {x: 350, y: 565, w: 690, h: 38, from: 22.9, kind: 'under'},
          ]}
        />
      ) : null}

      <RunLabel label={RUN.earlierRun} x={PANEL_X} y={130} at={0.6} />
    </Fill>
  );
};
