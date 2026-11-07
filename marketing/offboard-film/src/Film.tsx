import React from 'react';
import {AbsoluteFill, Sequence, staticFile, useCurrentFrame} from 'remotion';
import {Audio} from '@remotion/media';
import {z} from 'zod';
import {color, FPS, H, SAFE, W} from './brand';
import audio from './data/audio.json';
import {CUES, MUSIC_AT, musicGain, SCENES, VOICE, WIPE_HALF, sceneOf, type SceneId} from './data/timeline';
import {ease, ramp, text, TimeContext, windowed} from './primitives';
import {S1Departure} from './scenes/S1Departure';
import {S2Case} from './scenes/S2Case';
import {S3Switch} from './scenes/S3Switch';
import {S4Decision} from './scenes/S4Decision';
import {S5Verify} from './scenes/S5Verify';
import {S6Team} from './scenes/S6Team';
import {S7Roadmap} from './scenes/S7Roadmap';
import {S8Close} from './scenes/S8Close';

export const filmSchema = z.object({
  /** Burn phrase captions into the picture (the SRT is always produced separately). */
  captions: z.boolean(),
  /** Show the small "animatic" tag while essential live footage is missing. */
  animatic: z.boolean(),
  /** Include the authorised music bed (off = voice only). */
  music: z.boolean(),
});
export type FilmProps = z.infer<typeof filmSchema>;

const VIEW: Record<SceneId, React.FC> = {
  departure: S1Departure,
  case: S2Case,
  switch: S3Switch,
  decision: S4Decision,
  verify: S5Verify,
  team: S6Team,
  roadmap: S7Roadmap,
  close: S8Close,
};

/** Incoming scene is revealed behind a lavender line travelling left → right. */
const wipeProgress = (abs: number, boundary: number) => ramp(abs, boundary - WIPE_HALF, boundary + WIPE_HALF, ease);

const SceneLayer: React.FC<{abs: number; i: number}> = ({abs, i}) => {
  const me = SCENES[i];
  const next = SCENES[i + 1];
  const pre = me.entry === 'line' ? WIPE_HALF : 0;
  const post = next && next.entry === 'line' ? WIPE_HALF : 0;
  if (abs < me.start - pre || abs >= me.end + post) return null;
  const View = VIEW[me.id];
  const p = me.entry === 'line' ? wipeProgress(abs, me.start) : 1;
  const style: React.CSSProperties = {position: 'absolute', inset: 0};
  if (p < 1) style.clipPath = `inset(0 ${(1 - p) * W}px 0 0)`;
  return (
    <TimeContext.Provider value={abs - me.start}>
      <div style={style}>
        <View />
      </div>
    </TimeContext.Provider>
  );
};

const WipeLines: React.FC<{abs: number}> = ({abs}) => (
  <>
    {SCENES.filter((s) => s.entry === 'line').map((s) => {
      const p = wipeProgress(abs, s.start);
      if (p <= 0 || p >= 1) return null;
      const x = p * W;
      return (
        <React.Fragment key={s.id}>
          <div style={{position: 'absolute', left: x - 160, top: 0, width: 160, height: H, background: `linear-gradient(90deg, transparent, ${color.lavender}26)`}} />
          <div style={{position: 'absolute', left: x - 1, top: 0, width: 2, height: H, background: color.lavender}} />
        </React.Fragment>
      );
    })}
  </>
);

const Captions: React.FC<{abs: number}> = ({abs}) => {
  const closeStart = sceneOf('close').start;
  const cue = CUES.find((c) => abs >= c.start - 0.1 && abs < c.end + 0.15);
  // The closing line is already on screen as the headline; don't print it twice.
  if (!cue || cue.start >= closeStart) return null;
  const o = windowed(abs, cue.start - 0.1, cue.end + 0.15, 0.12);
  return (
    <div style={{position: 'absolute', left: 0, right: 0, bottom: 84, display: 'flex', justifyContent: 'center', opacity: o}}>
      <div
        style={{
          maxWidth: 1400,
          padding: '14px 28px 16px',
          borderRadius: 14,
          background: 'rgba(13,16,23,0.95)',
          border: `1px solid ${color.border}`,
          textAlign: 'center',
          ...text(40, 400, {lineHeight: 1.28}),
        }}
      >
        {cue.text}
      </div>
    </div>
  );
};

const AnimaticTag: React.FC = () => (
  <div style={{position: 'absolute', right: SAFE, top: 72, ...text(18, 500, {color: color.muted, opacity: 0.75, letterSpacing: '0.02em'})}}>
    Animatic · stills stand in for pending screen recordings
  </div>
);

export const Film: React.FC<FilmProps> = ({captions, animatic, music}) => {
  const frame = useCurrentFrame();
  const abs = frame / FPS;
  return (
    <AbsoluteFill style={{background: color.bg}}>
      {SCENES.map((s, i) => (
        <SceneLayer key={s.id} abs={abs} i={i} />
      ))}
      <WipeLines abs={abs} />
      {captions ? <Captions abs={abs} /> : null}
      {animatic ? <AnimaticTag /> : null}

      {VOICE.map((v) => (
        <Sequence key={v.id} from={Math.round(v.at * FPS)} layout="none">
          <Audio src={staticFile(audio.vo[v.id].file)} />
        </Sequence>
      ))}
      {music ? (
        <Audio
          src={staticFile(audio.music.file)}
          trimBefore={Math.max(0, Math.round(-MUSIC_AT * FPS))}
          volume={(f) => musicGain(Math.max(0, MUSIC_AT) + f / FPS)}
        />
      ) : null}
    </AbsoluteFill>
  );
};
