import audio from './audio.json';

// Absolute film timeline in seconds, built around the founder's measured voice
// (marketing/voiceovers, prepared by scripts/prepare-audio.py). Scenes read their
// own window; voice, captions and music gain are absolute. Edit here.

export type SceneId = 'departure' | 'case' | 'switch' | 'decision' | 'verify' | 'team' | 'roadmap' | 'close';
/** 'line' = the lavender line wipe used at chapter turns; 'cut' = straight cut. */
export type Entry = 'cut' | 'line';

export const SCENES: {id: SceneId; start: number; end: number; entry: Entry}[] = [
  {id: 'departure', start: 0, end: 16.0, entry: 'cut'},
  {id: 'case', start: 16.0, end: 24.5, entry: 'line'},
  {id: 'switch', start: 24.5, end: 57.5, entry: 'line'},
  {id: 'decision', start: 57.5, end: 86.0, entry: 'line'},
  {id: 'verify', start: 86.0, end: 116.5, entry: 'line'},
  {id: 'team', start: 116.5, end: 139.0, entry: 'line'},
  {id: 'roadmap', start: 139.0, end: 148.0, entry: 'line'},
  {id: 'close', start: 148.0, end: 154.5, entry: 'line'},
];

export const DURATION = SCENES[SCENES.length - 1].end;
/** Half-length of the line wipe, centred on each 'line' boundary. */
export const WIPE_HALF = 0.4;

export const sceneOf = (id: SceneId) => SCENES.find((s) => s.id === id)!;

export type PieceId = keyof typeof audio.vo;

/** Where each trimmed voice piece starts on the film timeline. */
export const VOICE: {id: PieceId; at: number}[] = [
  {id: '01', at: 0.25},
  {id: '02', at: 16.3},
  {id: '03a', at: 24.8},
  {id: '03b', at: 36.4},
  {id: '03c', at: 39.8}, // the sentence's comma pause is lengthened by ~0.85 s to read the tool list
  {id: '03d', at: 52.2},
  {id: '04a', at: 58.0},
  {id: '04b', at: 65.8},
  {id: '04c', at: 78.2},
  {id: '05a', at: 86.6},
  {id: '05b', at: 92.6},
  {id: '05c', at: 100.6},
  {id: '05d', at: 107.0},
  {id: '06a', at: 117.0},
  {id: '06b', at: 139.4},
  {id: '06c', at: 148.4},
];

// Phrase captions. Wording is the script the founder read, checked against a local
// whisper.cpp transcript; phrase start/end are measured pauses in the ORIGINAL clip
// (ffmpeg silencedetect, -38 dB). No word-level alignment is invented.
const PHRASES: Record<PieceId, [number, number, string][]> = {
  '01': [
    [0.94, 5.93, 'After I left a team, my GitHub, Apple, and Vercel access stayed active.'],
    [6.75, 8.27, 'I could still see code updates.'],
    [9.07, 11.48, 'Offboard helps teams find forgotten access,'],
    [12.09, 15.57, 'remove it with human approval, and verify the result.'],
  ],
  '02': [
    [0.65, 3.53, 'We start with the person leaving and their GitHub account.'],
    [4.3, 6.87, 'Their case brings the access and decisions together.'],
  ],
  '03a': [
    [0.3, 2.39, 'In our team’s Mattermost room,'],
    [3.13, 4.79, 'I ask Offboard to investigate.'],
    [5.64, 8.48, 'Switch connects our Codex agent to the conversation.'],
  ],
  '03b': [[9.07, 10.99, 'The agent requests a real GitHub check,']],
  '03c': [
    [11.67, 12.96, 'reads the saved findings,'],
    [13.39, 14.88, 'and explains the access it found.'],
  ],
  '03d': [[15.5, 18.08, 'The team can follow that investigation in the same thread.']],
  '04a': [[0.63, 2.93, 'Offboard sends the proposed removal to my email.']],
  '04b': [
    [3.75, 7.59, 'I review the account, organization, and exact permission,'],
    [7.88, 9.35, 'then make the decision myself.'],
  ],
  '04c': [
    [9.82, 12.74, 'The agent can investigate and help us understand the result.'],
    [13.25, 14.82, 'Approval stays with the human.'],
  ],
  '05a': [[0.86, 5.19, 'After approval, Offboard removes that permission and checks GitHub again.']],
  '05b': [
    [5.94, 8.59, 'In our test, GitHub accepted the change,'],
    [9.21, 11.06, 'but the first check still found access.'],
  ],
  '05c': [[11.71, 14.48, 'A separate follow-up confirmed the membership was gone.']],
  '05d': [
    [15.1, 16.87, 'The report keeps both results,'],
    [17.27, 18.82, 'together with who approved the change.'],
  ],
  '06a': [[0.49, 3.37, 'The agent brings the saved result back to the room.']],
  '06b': [
    [4.11, 7.45, 'Next, we plan to support more of your organization’s tools:'],
    [8.13, 11.27, 'Vercel, Jira, Trello, and custom sites.'],
  ],
  '06c': [[11.91, 14.58, 'When someone leaves, prove their access is gone.']],
};

export type Cue = {start: number; end: number; text: string};

export const CUES: Cue[] = VOICE.flatMap(({id, at}) => {
  const trimStart = audio.vo[id].trim[0];
  return PHRASES[id].map(([a, b, text]) => ({start: at + (a - trimStart), end: at + (b - trimStart), text}));
});

/** Absolute speech intervals, used for music ducking. */
const SPEECH: [number, number][] = CUES.map((c) => [c.start, c.end]);

// Music: the authorised beat, placed so its natural ending lands on the end card.
export const MUSIC_AT = DURATION - audio.music.endsAt;
const BED = 0.34;
const DUCK = 0.16;
const FINALE = 0.42;

export const musicGain = (abs: number) => {
  const t = abs - Math.max(0, MUSIC_AT);
  if (t < 0) return 0;
  const fadeIn = Math.min(1, t / 2.0);
  let g = BED;
  for (const [a, b] of SPEECH) {
    const down = Math.min(1, Math.max(0, (abs - (a - 0.35)) / 0.35));
    const up = Math.min(1, Math.max(0, (abs - b) / 0.7));
    g = Math.min(g, BED - (BED - DUCK) * down * (1 - up));
  }
  const lastSpeech = SPEECH[SPEECH.length - 1][1];
  if (abs > lastSpeech) g = g + (FINALE - g) * Math.min(1, (abs - lastSpeech) / 0.8);
  return g * fadeIn;
};
