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
  { id: 'kick', name: 'Kick', pan: 0 },
  { id: 'hhp', name: 'Hat pedal', pan: -0.4 },
];

/**
 * Sound sets. Every kit has a voice for each instrument; `type` picks the synthesiser in
 * synth.js and the rest are its parameters (frequencies in Hz, times in seconds, `level` is
 * the peak the rendered sound is scaled to). `labels` renames rows whose sound differs, and
 * `room` is the reverb: its length and how much of each hit is sent to it.
 */
export const KITS = {
  metal: {
    name: 'Metal',
    room: { seconds: 0.6, send: 0.07 },
    voices: {
      kick: { type: 'kick', f0: 260, f1: 52, bend: 0.035, decay: 0.32, click: 1.2, clickFreq: 4500, thud: 0.2, drive: 3, level: 1 },
      snare: { type: 'snare', tones: [240, 400], tone: 0.8, toneDecay: 0.09, wires: 1, noiseDecay: 0.2, hp: 1800, lp: 11000, crack: 0.8, drive: 2, level: 0.95 },
      rim: { type: 'stick', freq: 520, click: 2000, level: 0.55 },
      tom1: { type: 'tom', freq: 210, bend: 1.4, decay: 0.38, attack: 0.5, overtone: 0.25, drive: 1.8, level: 0.85 },
      tom2: { type: 'tom', freq: 160, bend: 1.4, decay: 0.45, attack: 0.5, overtone: 0.25, drive: 1.8, level: 0.85 },
      tom3: { type: 'tom', freq: 100, bend: 1.4, decay: 0.6, attack: 0.5, overtone: 0.25, drive: 1.8, level: 0.9 },
      hhc: { type: 'hat', tune: 1.1, decay: 0.045, metal: 0.7, noise: 0.6, bp: 10000, hp: 7500, level: 0.42 },
      hho: { type: 'hat', tune: 1.1, decay: 0.45, metal: 0.7, noise: 0.6, bp: 10000, hp: 7500, level: 0.42 },
      hhp: { type: 'hat', tune: 1.1, decay: 0.05, metal: 0.5, noise: 0.6, bp: 8000, hp: 5000, level: 0.3 },
      ride: { type: 'cymbal', tune: 1.4, decay: 1.6, hp: 4000, metal: 0.8, noise: 0.5, ping: 0.15, pings: [2840, 4300, 5900], pingDecay: 0.8, level: 0.42 },
      crash: { type: 'cymbal', tune: 1.2, decay: 1.8, hp: 3500, metal: 0.5, noise: 1, burst: 0.8, level: 0.55 },
    },
  },
  rock: {
    name: 'Rock',
    room: { seconds: 1, send: 0.14 },
    voices: {
      kick: { type: 'kick', f0: 180, f1: 50, bend: 0.055, decay: 0.45, click: 0.6, clickFreq: 3000, thud: 0.4, drive: 2, level: 1 },
      snare: { type: 'snare', tones: [185, 330], tone: 0.9, toneDecay: 0.13, wires: 1, noiseDecay: 0.28, hp: 1200, lp: 9000, crack: 0.6, drive: 1.5, level: 0.95 },
      rim: { type: 'stick', freq: 460, click: 1700, level: 0.55 },
      tom1: { type: 'tom', freq: 175, bend: 1.25, decay: 0.5, attack: 0.35, overtone: 0.3, drive: 1.3, level: 0.85 },
      tom2: { type: 'tom', freq: 128, bend: 1.25, decay: 0.6, attack: 0.35, overtone: 0.3, drive: 1.3, level: 0.85 },
      tom3: { type: 'tom', freq: 88, bend: 1.25, decay: 0.8, attack: 0.35, overtone: 0.3, drive: 1.3, level: 0.9 },
      hhc: { type: 'hat', tune: 1, decay: 0.055, metal: 0.6, noise: 0.7, bp: 9000, hp: 6500, level: 0.42 },
      hho: { type: 'hat', tune: 1, decay: 0.6, metal: 0.6, noise: 0.7, bp: 9000, hp: 6500, level: 0.42 },
      hhp: { type: 'hat', tune: 1, decay: 0.06, metal: 0.5, noise: 0.6, bp: 7000, hp: 4500, level: 0.3 },
      ride: { type: 'cymbal', tune: 1.2, decay: 2.2, hp: 3200, metal: 0.7, noise: 0.6, ping: 0.2, pings: [2560, 3870, 5300], pingDecay: 1, level: 0.45 },
      crash: { type: 'cymbal', tune: 1, decay: 2.4, hp: 3000, metal: 0.5, noise: 1, burst: 0.7, level: 0.55 },
    },
  },
  jazz: {
    name: 'Jazz',
    room: { seconds: 1.4, send: 0.2 },
    voices: {
      kick: { type: 'kick', f0: 120, f1: 62, bend: 0.07, decay: 0.6, click: 0.15, clickFreq: 1500, thud: 0.5, drive: 1, level: 0.85 },
      snare: { type: 'snare', tones: [300, 500], tone: 1, toneDecay: 0.18, wires: 0.5, noiseDecay: 0.22, hp: 2500, lp: 8000, crack: 0.4, drive: 1, level: 0.85 },
      rim: { type: 'stick', freq: 600, click: 2200, level: 0.55 },
      tom1: { type: 'tom', freq: 250, bend: 1.08, decay: 0.7, attack: 0.15, overtone: 0.4, level: 0.8 },
      tom2: { type: 'tom', freq: 190, bend: 1.08, decay: 0.8, attack: 0.15, overtone: 0.4, level: 0.8 },
      tom3: { type: 'tom', freq: 140, bend: 1.08, decay: 1, attack: 0.15, overtone: 0.4, level: 0.85 },
      hhc: { type: 'hat', tune: 0.9, decay: 0.07, metal: 0.6, noise: 0.5, bp: 8000, hp: 5500, level: 0.4 },
      hho: { type: 'hat', tune: 0.9, decay: 0.8, metal: 0.6, noise: 0.5, bp: 8000, hp: 5500, level: 0.4 },
      hhp: { type: 'hat', tune: 0.9, decay: 0.08, metal: 0.5, noise: 0.6, bp: 6000, hp: 3500, level: 0.4 },
      ride: { type: 'cymbal', tune: 0.95, decay: 3.5, hp: 2500, metal: 0.8, noise: 0.5, ping: 0.3, pings: [2300, 3410, 4870], pingDecay: 1.4, level: 0.5 },
      crash: { type: 'cymbal', tune: 0.9, decay: 3, hp: 2500, metal: 0.6, noise: 0.9, burst: 0.5, level: 0.5 },
    },
  },
  electronic: {
    name: 'Electro',
    labels: { rim: 'Clap' },
    room: { seconds: 1.6, send: 0.1 },
    voices: {
      kick: { type: 'kick', f0: 210, f1: 46, bend: 0.05, decay: 0.8, click: 0.4, clickFreq: 3500, drive: 2.5, level: 1 },
      snare: { type: 'snare', tones: [180, 330], tone: 0.9, toneDecay: 0.1, wires: 1, noiseDecay: 0.2, hp: 3000, lp: 14000, crack: 0.2, drive: 1.3, level: 0.85 },
      rim: { type: 'clap', freq: 1150, decay: 0.18, level: 0.8 },
      tom1: { type: 'tom', freq: 200, bend: 1.35, bendTime: 0.12, decay: 0.35, level: 0.8 },
      tom2: { type: 'tom', freq: 150, bend: 1.35, bendTime: 0.12, decay: 0.4, level: 0.8 },
      tom3: { type: 'tom', freq: 105, bend: 1.35, bendTime: 0.12, decay: 0.5, level: 0.85 },
      hhc: { type: 'hat', tune: 1, decay: 0.04, metal: 1, noise: 0.1, bp: 10500, hp: 8000, level: 0.4 },
      hho: { type: 'hat', tune: 1, decay: 0.32, metal: 1, noise: 0.1, bp: 10500, hp: 8000, level: 0.4 },
      hhp: { type: 'hat', tune: 1, decay: 0.03, metal: 1, noise: 0.1, bp: 9000, hp: 6000, level: 0.3 },
      ride: { type: 'cymbal', tune: 1.5, decay: 1.2, hp: 5000, metal: 1, noise: 0.15, ping: 0.1, pings: [3150, 4720, 5960], pingDecay: 0.6, level: 0.4 },
      crash: { type: 'cymbal', tune: 1.3, decay: 1.5, hp: 4500, metal: 0.7, noise: 0.6, burst: 0.4, level: 0.5 },
    },
  },
};

export const KIT_IDS = Object.keys(KITS);

export function instrumentLabel(kitId, inst) {
  return KITS[kitId]?.labels?.[inst.id] ?? inst.name;
}
