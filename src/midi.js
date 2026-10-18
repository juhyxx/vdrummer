import { INSTRUMENTS } from './kits.js';
import { totalSteps } from './pattern.js';
import { swingDelay } from './sequencer.js';

const PPQ = 480; // ticks per quarter note
// General MIDI percussion keys, played on channel 10.
const KEYS = { crash: 49, ride: 51, hho: 46, hhc: 42, tom1: 48, tom2: 45, tom3: 43, snare: 38, rim: 37, kick: 36, kick2: 35, hhp: 44 };
const RIM_KEYS = { metal: 40, electronic: 39 }; // there the side stick row is a rimshot / a clap
const VELOCITY = [0, 40, 90, 120]; // ghost, hit, accent

/** The pattern as a Standard MIDI File (format 0): one loop, with its tempo, meter and swing. */
export function toMidi(p) {
  const stepTicks = PPQ / p.div;
  const length = Math.round(totalSteps(p) * stepTicks);
  const noteTicks = Math.min(60, Math.floor(stepTicks / 2));
  const events = []; // [tick, order (offs first), bytes]
  for (const { id } of INSTRUMENTS) {
    const key = id === 'rim' ? (RIM_KEYS[p.kit] ?? KEYS.rim) : KEYS[id];
    p.notes[id].forEach((level, step) => {
      if (!level) return;
      const tick = Math.round(step * stepTicks + swingDelay(p, step, stepTicks));
      events.push([tick, 1, [0x99, key, VELOCITY[level]]], [tick + noteTicks, 0, [0x89, key, 0]]);
    });
  }
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);

  const name = new TextEncoder().encode(p.name);
  const usPerBeat = Math.round(60e6 / p.tempo);
  const track = [
    0, 0xff, 0x03, ...vlq(name.length), ...name, // track name
    0, 0xff, 0x51, 3, (usPerBeat >> 16) & 0xff, (usPerBeat >> 8) & 0xff, usPerBeat & 0xff, // tempo
    0, 0xff, 0x58, 4, p.beats, 2, 24, 8, // time signature beats/4
  ];
  let now = 0;
  for (const [tick, , bytes] of events) {
    track.push(...vlq(tick - now), ...bytes);
    now = tick;
  }
  track.push(...vlq(Math.max(0, length - now)), 0xff, 0x2f, 0); // end of track, at the end of the loop

  return new Uint8Array([
    ...ascii('MThd'), ...u32(6), 0, 0, 0, 1, (PPQ >> 8) & 0xff, PPQ & 0xff,
    ...ascii('MTrk'), ...u32(track.length), ...track,
  ]);
}

/** Variable-length quantity: 7 bits per byte, high bit set on all but the last. */
function vlq(n) {
  const out = [n & 0x7f];
  while ((n >>= 7)) out.unshift((n & 0x7f) | 0x80);
  return out;
}

const u32 = (n) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
const ascii = (s) => [...s].map((c) => c.charCodeAt(0));
