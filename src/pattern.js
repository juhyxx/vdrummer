import { INSTRUMENTS, KITS } from './kits.js?v=78c12be';

// Grid resolutions: steps per quarter-note beat.
export const DIVISIONS = [
  { div: 1, label: '1/4' },
  { div: 2, label: '1/8' },
  { div: 3, label: '1/8T' },
  { div: 4, label: '1/16' },
  { div: 6, label: '1/16T' },
];
export const BEATS = [2, 3, 4, 5, 6, 7];
export const MAX_BARS = 16;
export const TEMPO = { min: 40, max: 260 };

/**
 * A pattern: `notes[instrument id]` holds one hit level per step for the whole loop
 * (0 off, 1 ghost, 2 normal, 3 accent); a bar has `beats × div` steps.
 */
export function emptyPattern() {
  const p = { name: 'Untitled', kit: 'rock', tempo: 100, beats: 4, div: 4, swing: 0, bars: 1, notes: {} };
  for (const { id } of INSTRUMENTS) p.notes[id] = new Array(totalSteps(p)).fill(0);
  return p;
}

export const stepsPerBar = (p) => p.beats * p.div;
export const totalSteps = (p) => p.bars * stepsPerBar(p);

/** Changes the resolution, moving each hit to the nearest new step (coarser grids may merge or drop hits). */
export function setDivision(p, div) {
  const from = stepsPerBar(p);
  const to = p.beats * div;
  for (const { id } of INSTRUMENTS) {
    const out = new Array(p.bars * to).fill(0);
    p.notes[id].forEach((v, i) => {
      if (!v) return;
      const s = Math.round(((i % from) * to) / from);
      if (s >= to) return; // would fall on the next bar's downbeat
      const j = Math.floor(i / from) * to + s;
      out[j] = Math.max(out[j], v);
    });
    p.notes[id] = out;
  }
  p.div = div;
}

/** Changes the number of beats in a bar, cutting or padding each bar at its end. */
export function setBeats(p, beats) {
  const from = stepsPerBar(p);
  const to = beats * p.div;
  for (const { id } of INSTRUMENTS) {
    const src = p.notes[id];
    p.notes[id] = Array.from({ length: p.bars * to }, (_, j) => {
      const s = j % to;
      return s < from ? src[Math.floor(j / to) * from + s] : 0;
    });
  }
  p.beats = beats;
}

/** Changes the number of bars: fewer cuts the loop at its end, more repeat the loop into the new bars. */
export function setBars(p, bars) {
  const len = bars * stepsPerBar(p);
  for (const { id } of INSTRUMENTS) {
    const src = p.notes[id];
    p.notes[id] = Array.from({ length: len }, (_, i) => src[i % src.length]);
  }
  p.bars = bars;
}

export function clearBar(p, bar) {
  const spb = stepsPerBar(p);
  for (const { id } of INSTRUMENTS) p.notes[id].fill(0, bar * spb, (bar + 1) * spb);
}

// ---------------------------------------------------------------- presets and storage

const SYMBOLS = { '-': 0, g: 1, x: 2, X: 3 };

/**
 * Builds a pattern from a preset written as text: one string per instrument, one character
 * per step ('-' rest, 'g' ghost, 'x' hit, 'X' accent); spaces and '|' are ignored. A row shorter
 * than the loop repeats, so a one-bar row fills every bar.
 */
export function fromPreset(preset) {
  const p = {
    name: preset.name,
    kit: preset.kit,
    tempo: preset.tempo,
    beats: preset.beats ?? 4,
    div: preset.div,
    swing: preset.swing ?? 0,
    bars: preset.bars ?? 1,
    notes: {},
  };
  const total = totalSteps(p);
  for (const { id } of INSTRUMENTS) {
    const cells = [...(preset.rows[id] ?? '').replace(/[\s|]/g, '')].map((c) => SYMBOLS[c] ?? 0);
    p.notes[id] = Array.from({ length: total }, (_, i) => (cells.length ? cells[i % cells.length] : 0));
  }
  return p;
}

/** Plain-object form for localStorage: each row becomes a string of digits. */
export function serialize(p) {
  const notes = {};
  for (const { id } of INSTRUMENTS) notes[id] = p.notes[id].join('');
  return { name: p.name, kit: p.kit, tempo: p.tempo, beats: p.beats, div: p.div, swing: p.swing, bars: p.bars, notes };
}

/** The inverse of serialize(), forgiving anything malformed in storage. */
export function deserialize(o) {
  const int = (v, min, max, fallback) => (Number.isFinite(+v) ? Math.min(max, Math.max(min, Math.round(+v))) : fallback);
  const p = {
    name: String(o?.name ?? 'Untitled').slice(0, 40),
    kit: KITS[o?.kit] ? o.kit : 'rock',
    tempo: int(o?.tempo, TEMPO.min, TEMPO.max, 100),
    beats: BEATS.includes(+o?.beats) ? +o.beats : 4,
    div: DIVISIONS.some((d) => d.div === +o?.div) ? +o.div : 4,
    swing: int(o?.swing, 0, 100, 0),
    bars: int(o?.bars, 1, MAX_BARS, 1),
    notes: {},
  };
  const total = totalSteps(p);
  for (const { id } of INSTRUMENTS) {
    const s = String(o?.notes?.[id] ?? '');
    p.notes[id] = Array.from({ length: total }, (_, i) => Math.min(3, Number(s[i]) || 0));
  }
  return p;
}
