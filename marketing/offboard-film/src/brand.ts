// Offboard identity, taken from src/app/globals.css and the app's Brand component.
export const FPS = 30;
export const W = 1920;
export const H = 1080;
/** Approximate safe margin for important text. */
export const SAFE = 96;

export const FONT = 'Neue Montreal';

export const color = {
  bg: '#0D1017',
  surface: '#151923',
  surfaceMuted: '#202637',
  indigo: '#252B52',
  ink: '#10121B',
  text: '#F0F1FA',
  muted: '#A5AEC2',
  border: '#303748',
  lavender: '#B4B6FF',
  attention: '#E8C48B',
  success: '#90D4B1',
  critical: '#FF9A9A',
} as const;

export type Tone = 'lavender' | 'attention' | 'success';
export const toneColor: Record<Tone, string> = {
  lavender: color.lavender,
  attention: color.attention,
  success: color.success,
};

export const LIVE_URL = 'offboard-mu.vercel.app';
