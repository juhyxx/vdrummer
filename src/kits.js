// The grid rows, top to bottom. `pan` places each piece where the drummer hears it
// (−1 left, +1 right), for a right-handed kit: hi-hat on the left, floor tom on the right.
export const INSTRUMENTS = [
  { id: 'crash', name: 'Crash', pan: -0.5 },
  { id: 'ride', name: 'Ride', pan: 0.5 },
  { id: 'hho', name: 'Open hat', pan: -0.4 },
  { id: 'hhc', name: 'Closed hat', pan: -0.4 },
  { id: 'tom1', name: 'High tom', pan: -0.15 },
  { id: 'tom2', name: 'Mid tom', pan: 0.15 },
  { id: 'tom3', name: 'Floor tom', pan: 0.45 },
  { id: 'snare', name: 'Snare', pan: -0.12 },
  { id: 'rim', name: 'Side stick', pan: -0.12 },
  { id: 'kick', name: 'Kick', pan: 0.05 },
  { id: 'kick2', name: 'Kick 2', pan: -0.05 }, // left foot: a second bass drum, or a double pedal
  { id: 'hhp', name: 'Hat pedal', pan: -0.4 },
];

/**
 * Sound sets, recorded drums (see samples/CREDITS.md). Each kit has samples/<kit>/<instrument>.wav,
 * made by tools/build_samples.py; instruments listed in `soft` also have a softly played hit
 * (<instrument>-soft.wav) for ghost notes. `kicks` is the number of bass drums: with one,
 * Kick 2 is a double pedal on the same drum (`alias` plays another instrument's samples).
 * `labels` renames rows whose sound differs, and `room` is a light reverb: its length and
 * how much of each hit is sent to it.
 */
const ACOUSTIC_SOFT = ['kick', 'snare', 'tom1', 'tom2', 'tom3', 'hhc'];
const DOUBLE_PEDAL = { kick2: 'kick' };

export const KITS = {
  metal: {
    name: 'Metal',
    source: 'The Aasimonster (DrumGizmo)',
    kicks: 2,
    labels: { rim: 'Rimshot' },
    soft: [...ACOUSTIC_SOFT, 'kick2'],
    room: { seconds: 0.6, send: 0.04 },
  },
  rock: {
    name: 'Rock',
    source: 'AVL Red Zeppelin',
    kicks: 1,
    alias: DOUBLE_PEDAL,
    soft: ACOUSTIC_SOFT,
    room: { seconds: 1, send: 0.08 },
  },
  jazz: {
    name: 'Jazz',
    source: 'AVL Blonde Bop, brushed snare from Kingsley\'s Drum Kit',
    kicks: 1,
    alias: DOUBLE_PEDAL,
    labels: { snare: 'Snare brush' },
    soft: ACOUSTIC_SOFT,
    room: { seconds: 1.2, send: 0.1 },
  },
  electronic: {
    name: 'Electro',
    source: 'Roland TR-808',
    kicks: 1,
    alias: DOUBLE_PEDAL,
    labels: { rim: 'Clap' },
    soft: [],
    room: { seconds: 1.4, send: 0.1 },
  },
};

export const KIT_IDS = Object.keys(KITS);

export function instrumentLabel(kitId, inst) {
  return KITS[kitId]?.labels?.[inst.id] ?? inst.name;
}
