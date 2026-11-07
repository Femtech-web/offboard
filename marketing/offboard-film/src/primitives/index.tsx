import React, {createContext, useContext} from 'react';
import {Easing, Img, interpolate, staticFile} from 'remotion';
import {color, FONT, SAFE, toneColor, type Tone} from '../brand';
import type {Source} from '../data/footage';

// ---------------------------------------------------------------------------
// Time. Scenes receive a local clock (seconds from their own start; negative during
// the incoming wipe). Everything below is driven by it — no CSS transitions.
// ---------------------------------------------------------------------------
export const TimeContext = createContext(0);
export const useT = () => useContext(TimeContext);

export const ease = Easing.bezier(0.65, 0, 0.35, 1);
export const easeOut = Easing.bezier(0.22, 1, 0.36, 1);

/** 0→1 between a and b (seconds), eased and clamped. */
export const ramp = (t: number, a: number, b: number, e = ease) =>
  interpolate(t, [a, b], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: e});

/** Visible window with short fades: 0 before `a`, 1 inside, 0 after `b`. */
export const windowed = (t: number, a: number, b: number, fade = 0.25) =>
  Math.min(ramp(t, a, a + fade, easeOut), Number.isFinite(b) ? 1 - ramp(t, b - fade, b, ease) : 1);

export const Fill: React.FC<{children?: React.ReactNode; style?: React.CSSProperties}> = ({children, style}) => (
  <div style={{position: 'absolute', inset: 0, ...style}}>{children}</div>
);

// ---------------------------------------------------------------------------
// Evidence shot: a window onto a real capture, with a motivated camera and
// selection marks drawn in screen space (so line weights stay constant).
// ---------------------------------------------------------------------------
export type Box = {x: number; y: number; w: number; h: number};
/** Camera key: source-pixel left/top and width; height follows the box aspect. */
export type Cam = {at: number; x: number; y: number; w: number};
export type Mark = {
  /** Source-pixel rectangle around the phrase. */
  x: number;
  y: number;
  w: number;
  h: number;
  from: number;
  to?: number;
  tone?: Tone;
  /** 'select' = outlined wash; 'under' = line under the phrase. */
  kind?: 'select' | 'under';
};

const camAt = (cams: Cam[], t: number): Cam => {
  if (t <= cams[0].at) return cams[0];
  for (let i = 1; i < cams.length; i++) {
    const a = cams[i - 1];
    const b = cams[i];
    if (t <= b.at) {
      const p = ramp(t, a.at, b.at);
      return {at: t, x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p, w: a.w + (b.w - a.w) * p};
    }
  }
  return cams[cams.length - 1];
};

export const Shot: React.FC<{
  src: Source;
  box: Box;
  cams: Cam[];
  marks?: Mark[];
  panel?: boolean;
  /** Local time the shot appears; used for a short fade-in. */
  enter?: number;
  dim?: number;
}> = ({src, box, cams, marks = [], panel = false, enter, dim = 0}) => {
  const t = useT();
  const cam = camAt(cams, t);
  const s = box.w / cam.w;
  const opacity = enter === undefined ? 1 : ramp(t, enter, enter + 0.3, easeOut);
  return (
    <div
      style={{
        position: 'absolute',
        left: box.x,
        top: box.y,
        width: box.w,
        height: box.h,
        overflow: 'hidden',
        opacity,
        borderRadius: panel ? 18 : 0,
        border: panel ? `1px solid ${color.border}` : undefined,
        boxShadow: panel ? '0 40px 90px rgba(0,0,0,0.5)' : undefined,
        background: color.bg,
      }}
    >
      <Img
        src={staticFile(src.file)}
        style={{position: 'absolute', left: -cam.x * s, top: -cam.y * s, width: src.w * s, height: src.h * s, maxWidth: 'none'}}
      />
      {dim > 0 ? <Fill style={{background: color.bg, opacity: dim}} /> : null}
      {marks.map((m, i) => (
        <MarkView key={i} m={m} t={t} toScreen={(x, y) => [(x - cam.x) * s, (y - cam.y) * s]} s={s} />
      ))}
      {/* Full-bleed crops get a top scrim so run labels never sit on cut-off UI. */}
      {panel ? null : (
        <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: 210, background: `linear-gradient(${color.bg}F2 0%, ${color.bg}C0 45%, ${color.bg}00 100%)`}} />
      )}
    </div>
  );
};

const MarkView: React.FC<{m: Mark; t: number; s: number; toScreen: (x: number, y: number) => [number, number]}> = ({m, t, s, toScreen}) => {
  const draw = ramp(t, m.from, m.from + 0.55, easeOut);
  const out = m.to === undefined ? 0 : ramp(t, m.to, m.to + 0.3);
  if (draw <= 0 || out >= 1) return null;
  const [x, y] = toScreen(m.x, m.y);
  const w = m.w * s;
  const h = m.h * s;
  const c = toneColor[m.tone ?? 'lavender'];
  const pad = 8;
  const alpha = 1 - out;
  if (m.kind === 'under') {
    return (
      <div
        style={{position: 'absolute', left: x, top: y + h + 4, width: w * draw, height: 3, background: c, borderRadius: 2, opacity: alpha}}
      />
    );
  }
  return (
    <div
      style={{
        position: 'absolute',
        left: x - pad,
        top: y - pad,
        width: w + pad * 2,
        height: h + pad * 2,
        clipPath: `inset(0 ${(1 - draw) * 100}% 0 0)`,
        opacity: alpha,
      }}
    >
      <div style={{position: 'absolute', inset: 0, background: `${c}1F`, border: `2px solid ${c}`, borderRadius: 8}} />
      <div style={{position: 'absolute', left: -2, top: 6, bottom: 6, width: 4, background: c, borderRadius: 2}} />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Typography and labels.
// ---------------------------------------------------------------------------
export const text = (size: number, weight = 400, extra: React.CSSProperties = {}): React.CSSProperties => ({
  fontFamily: FONT,
  fontSize: size,
  fontWeight: weight,
  color: color.text,
  letterSpacing: size >= 56 ? '-0.025em' : size >= 32 ? '-0.012em' : '0',
  lineHeight: size >= 56 ? 1.04 : 1.25,
  ...extra,
});

/** Run/source label: always names which run the footage belongs to. */
export const RunLabel: React.FC<{label: string; at?: number; until?: number; x?: number; y?: number; tone?: Tone; right?: boolean}> = ({
  label,
  at = 0,
  until = Infinity,
  x = SAFE,
  y = 64,
  tone = 'lavender',
  right = false,
}) => {
  const t = useT();
  const o = windowed(t, at, until, 0.3);
  if (o <= 0) return null;
  return (
    <div
      style={{
        position: 'absolute',
        ...(right ? {right: x} : {left: x}),
        top: y,
        opacity: o,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 18px 10px 14px',
        borderRadius: 999,
        background: 'rgba(13,16,23,0.88)',
        border: `1px solid ${color.border}`,
        ...text(22, 500, {color: color.muted}),
      }}
    >
      <span style={{width: 9, height: 9, borderRadius: 9, background: toneColor[tone]}} />
      {label}
    </div>
  );
};

export const Kicker: React.FC<{children: React.ReactNode; style?: React.CSSProperties}> = ({children, style}) => (
  <div style={text(26, 500, {color: color.lavender, ...style})}>{children}</div>
);

/** Fades and lifts a block in at `at` (local seconds) and out at `until`. */
export const Reveal: React.FC<{at: number; until?: number; children: React.ReactNode; style?: React.CSSProperties; lift?: number}> = ({
  at,
  until = Infinity,
  children,
  style,
  lift = 18,
}) => {
  const t = useT();
  const i = ramp(t, at, at + 0.5, easeOut);
  const o = until === Infinity ? 0 : ramp(t, until - 0.3, until);
  return <div style={{opacity: i * (1 - o), transform: `translateY(${(1 - i) * lift}px)`, ...style}}>{children}</div>;
};

// ---------------------------------------------------------------------------
// Brand.
// ---------------------------------------------------------------------------
/** lucide "log-out" — the exit mark used by the app's Brand component. */
export const ExitMark: React.FC<{size: number; stroke?: string; strokeWidth?: number}> = ({size, stroke = color.lavender, strokeWidth = 1.6}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d="m16 17 5-5-5-5" />
    <path d="M21 12H9" />
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
  </svg>
);

export const Wordmark: React.FC<{scale?: number}> = ({scale = 1}) => (
  <div style={{display: 'inline-flex', alignItems: 'center', gap: 18 * scale}}>
    <span
      style={{
        width: 64 * scale,
        height: 64 * scale,
        borderRadius: 16 * scale,
        border: '1px solid rgba(255,255,255,0.15)',
        background: 'rgba(255,255,255,0.07)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <ExitMark size={36 * scale} />
    </span>
    <span style={text(52 * scale, 500, {letterSpacing: '-0.03em', lineHeight: 1})}>
      Offboard<span style={{color: color.lavender}}>.</span>
    </span>
  </div>
);

/** A thin lavender rule that draws left→right; the film's recurring line. */
export const Rule: React.FC<{x: number; y: number; w: number; at: number; dur?: number; tone?: Tone; thickness?: number}> = ({
  x,
  y,
  w,
  at,
  dur = 0.8,
  tone = 'lavender',
  thickness = 2,
}) => {
  const t = useT();
  const p = ramp(t, at, at + dur, easeOut);
  return <div style={{position: 'absolute', left: x, top: y, width: w * p, height: thickness, background: toneColor[tone], borderRadius: thickness}} />;
};
