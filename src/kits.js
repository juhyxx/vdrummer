// The grid rows, top to bottom. `pan` places each piece in the stereo mix (−1 left, +1
// right) where it is in a standard drum mix, from the drummer's seat as in the kit view:
// kick and snare in the middle, hi-hat and crash to the left, toms sweeping from left to
// the floor tom on the right, ride and Crash R on the right.
export const INSTRUMENTS = [
  { id: 'tamb', name: 'Tambourine', pan: -0.55 }, // on the hi-hat stand
  { id: 'crash', name: 'Crash L', pan: -0.6 },
  { id: 'crash2', name: 'Crash R', pan: 0.45 },
  { id: 'ride', name: 'Ride', pan: 0.6 },
  { id: 'hho', name: 'Open hat', pan: -0.5 },
  { id: 'hhc', name: 'Closed hat', pan: -0.5 },
  { id: 'tom1', name: 'High tom', pan: -0.3 },
  { id: 'tom2', name: 'Mid tom', pan: 0.1 },
  { id: 'tom3', name: 'Floor tom', pan: 0.55 },
  { id: 'snare', name: 'Snare', pan: 0 },
  { id: 'rim', name: 'Side stick', pan: 0 },
  { id: 'kick', name: 'Kick', pan: 0 },
  { id: 'kick2', name: 'Kick 2', pan: 0 }, // left foot: a double pedal on the kick, or (metal) a second bass drum
  { id: 'hhp', name: 'Hat pedal', pan: -0.5 },
];

/**
 * Sound sets, recorded drums (see samples/CREDITS.md). Each kit has samples/<kit>/<instrument>.wav,
 * made by tools/build_samples.py; instruments listed in `soft` also have a softly played hit
 * (<instrument>-soft.wav) for ghost notes. `kicks` is the number of bass drums: with one,
 * Kick 2 is a double pedal on the same drum (`alias` plays another instrument's samples);
 * with two they stand side by side, so `pan` moves them apart.
 * `labels` renames rows whose sound differs, and `room` is the size of the room the reverb
 * puts the kit in: how long its tail rings.
 */
const ACOUSTIC_SOFT = ['kick', 'snare', 'tom1', 'tom2', 'tom3', 'hhc', 'tamb'];
const DOUBLE_PEDAL = { kick2: 'kick' };

export const KITS = {
  metal: {
    name: 'Metal',
    source: 'The Aasimonster (DrumGizmo), tambourine from AVL Black Pearl',
    kicks: 2,
    pan: { kick: 0.1, kick2: -0.1 }, // right foot's drum on the right
    labels: { rim: 'Rimshot' },
    soft: [...ACOUSTIC_SOFT, 'kick2'],
    room: { seconds: 0.8 },
  },
  rock: {
    name: 'Rock',
    source: 'AVL Red Zeppelin',
    kicks: 1,
    alias: DOUBLE_PEDAL,
    soft: ACOUSTIC_SOFT,
    room: { seconds: 1.3 },
  },
  jazz: {
    name: 'Jazz',
    source: 'AVL Blonde Bop; brushed snare from Freesound (Heigh-hoo, skaiware)',
    kicks: 1,
    alias: DOUBLE_PEDAL,
    labels: { snare: 'Snare brush' }, // ghost notes sweep, hits tap
    soft: ACOUSTIC_SOFT,
    room: { seconds: 1.6 },
  },
  electronic: {
    name: 'Electro',
    source: 'Roland TR-808',
    kicks: 1,
    alias: DOUBLE_PEDAL,
    labels: { rim: 'Clap', tamb: 'Maracas' },
    soft: [],
    room: { seconds: 1.8 },
  },
};

export const KIT_IDS = Object.keys(KITS);

export function instrumentLabel(kitId, inst) {
  return KITS[kitId]?.labels?.[inst.id] ?? inst.name;
}
