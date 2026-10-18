// Drum sounds, synthesised. Each voice of a kit is rendered once into an AudioBuffer by an
// OfflineAudioContext (which needs no user gesture and runs off the main thread); playing a
// hit then only means starting a buffer at the right time.

const RATE = 44100;
// The six square-wave oscillators behind the TR-808's cymbals and hi-hats, in Hz.
const METAL = [205.3, 304.4, 369.6, 522.7, 540, 800];

/** Renders every voice of a kit: { instrument id: AudioBuffer }. */
export async function renderKit(kit) {
  const entries = Object.entries(kit.voices);
  const buffers = await Promise.all(entries.map(([, spec]) => render(spec)));
  return Object.fromEntries(entries.map(([id], i) => [id, buffers[i]]));
}

async function render(spec) {
  const voice = VOICES[spec.type];
  const ctx = new OfflineAudioContext(1, Math.ceil(voice.length(spec) * RATE), RATE);
  voice.build(ctx, ctx.destination, spec);
  const buf = await ctx.startRendering();
  finish(buf, spec.level ?? 0.9);
  return buf;
}

/** Scales the sound to its peak level and fades out the last 10 ms, so the cut-off end doesn't click. */
function finish(buf, level) {
  const d = buf.getChannelData(0);
  let peak = 0;
  for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
  const k = peak ? level / peak : 0;
  const fade = Math.min(d.length, Math.round(0.01 * buf.sampleRate));
  for (let i = 0; i < d.length; i++) d[i] *= k * Math.min(1, (d.length - i) / fade);
}

// ---------------------------------------------------------------- building blocks

/** Gain that rises to `peak` in `attack` s, then decays exponentially to −60 dB at `decay` s. */
function env(ctx, peak, decay, attack = 0.001) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, 0);
  g.gain.linearRampToValueAtTime(peak, attack);
  g.gain.setTargetAtTime(0, attack, decay / 6.9);
  return g;
}

function gain(ctx, value) {
  const g = ctx.createGain();
  g.gain.value = value;
  return g;
}

function filter(ctx, type, frequency, Q = 0.7) {
  return new BiquadFilterNode(ctx, { type, frequency, Q });
}

function osc(ctx, type = 'sine') {
  const o = new OscillatorNode(ctx, { type });
  o.start(0);
  return o;
}

/** White noise from a fixed seed, so a kit sounds the same every time it's rendered. */
function noise(ctx, seconds, seed) {
  const buf = ctx.createBuffer(1, Math.ceil(seconds * ctx.sampleRate), ctx.sampleRate);
  const d = buf.getChannelData(0);
  let s = seed * 2654435761 >>> 0 || 1;
  for (let i = 0; i < d.length; i++) {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    d[i] = (s >>> 0) / 2147483648 - 1;
  }
  const src = new AudioBufferSourceNode(ctx, { buffer: buf });
  src.start(0);
  return src;
}

/** The 808's six detuned square waves: a metallic, inharmonic buzz for cymbals. */
function metal(ctx, tune, level) {
  const sum = gain(ctx, level / METAL.length);
  for (const f of METAL) {
    const o = osc(ctx, 'square');
    o.frequency.value = f * tune;
    o.connect(sum);
  }
  return sum;
}

/** Soft clipping: adds punch and grit. Returns the node to feed; it passes on to `out`. */
function drive(ctx, amount, out) {
  if (!amount || amount <= 1) return out;
  const n = 1024;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) curve[i] = Math.tanh(((i / (n - 1)) * 2 - 1) * amount) / Math.tanh(amount);
  const ws = new WaveShaperNode(ctx, { curve, oversample: '2x' });
  ws.connect(out);
  return ws;
}

function chain(...nodes) {
  for (let i = 1; i < nodes.length; i++) nodes[i - 1].connect(nodes[i]);
  return nodes[nodes.length - 1];
}

// ---------------------------------------------------------------- voices

const VOICES = {
  // A sine that drops in pitch (the body), a low thud and the beater's click.
  kick: {
    length: (p) => p.decay + 0.05,
    build(ctx, out, p) {
      const bus = drive(ctx, p.drive, out);
      const body = osc(ctx);
      body.frequency.setValueAtTime(p.f0, 0);
      body.frequency.exponentialRampToValueAtTime(p.f1, p.bend);
      chain(body, env(ctx, 1, p.decay, 0.002), bus);
      if (p.thud) chain(noise(ctx, 0.15, 1), filter(ctx, 'lowpass', 180), env(ctx, p.thud, 0.08), bus);
      if (p.click) chain(noise(ctx, 0.05, 2), filter(ctx, 'bandpass', p.clickFreq, 0.9), env(ctx, p.click, 0.02), bus);
    },
  },

  // Two shell tones plus filtered noise for the wires, and the stick's crack.
  snare: {
    length: (p) => Math.max(p.toneDecay, p.noiseDecay) + 0.05,
    build(ctx, out, p) {
      const bus = drive(ctx, p.drive, out);
      p.tones.forEach((f, i) => {
        const o = osc(ctx, 'triangle');
        o.frequency.setValueAtTime(f * 1.2, 0);
        o.frequency.exponentialRampToValueAtTime(f, 0.015);
        chain(o, env(ctx, p.tone / (i + 1), p.toneDecay), bus);
      });
      chain(noise(ctx, p.noiseDecay + 0.05, 3), filter(ctx, 'highpass', p.hp), filter(ctx, 'lowpass', p.lp), env(ctx, p.wires, p.noiseDecay), bus);
      if (p.crack) chain(noise(ctx, 0.04, 4), filter(ctx, 'bandpass', 3500, 0.8), env(ctx, p.crack, 0.012), bus);
    },
  },

  // Cross-stick: a short, woody knock.
  stick: {
    length: () => 0.12,
    build(ctx, out, p) {
      const o = osc(ctx, 'triangle');
      o.frequency.setValueAtTime(p.freq * 1.4, 0);
      o.frequency.exponentialRampToValueAtTime(p.freq, 0.008);
      chain(o, env(ctx, 0.7, 0.05), out);
      chain(noise(ctx, 0.1, 5), filter(ctx, 'bandpass', p.click, 3), env(ctx, 1, 0.04), out);
    },
  },

  // Hand clap: three quick bursts of band-passed noise, then a short tail.
  clap: {
    length: (p) => p.decay + 0.08,
    build(ctx, out, p) {
      const g = ctx.createGain();
      chain(noise(ctx, p.decay + 0.08, 8), filter(ctx, 'highpass', 700), filter(ctx, 'bandpass', p.freq, 1.2), g, out);
      const a = g.gain;
      a.setValueAtTime(0, 0);
      for (const t of [0, 0.01, 0.02]) {
        a.setValueAtTime(1, t);
        a.exponentialRampToValueAtTime(0.15, t + 0.009);
      }
      a.setValueAtTime(1, 0.03);
      a.setTargetAtTime(0, 0.03, p.decay / 6.9);
    },
  },

  tom: {
    length: (p) => p.decay + 0.05,
    build(ctx, out, p) {
      const bus = drive(ctx, p.drive, out);
      const o = osc(ctx);
      o.frequency.setValueAtTime(p.freq * p.bend, 0);
      o.frequency.exponentialRampToValueAtTime(p.freq, p.bendTime ?? 0.06);
      chain(o, env(ctx, 1, p.decay), bus);
      if (p.overtone) {
        const o2 = osc(ctx, 'triangle');
        o2.frequency.value = p.freq * 1.5;
        chain(o2, env(ctx, p.overtone, p.decay * 0.4), bus);
      }
      if (p.attack) chain(noise(ctx, 0.05, 6), filter(ctx, 'bandpass', p.freq * 6, 0.8), env(ctx, p.attack, 0.025), bus);
    },
  },

  hat: {
    length: (p) => p.decay + 0.05,
    build(ctx, out, p) {
      const mix = ctx.createGain();
      chain(mix, filter(ctx, 'bandpass', p.bp, 0.7), filter(ctx, 'highpass', p.hp), env(ctx, 1, p.decay), out);
      metal(ctx, p.tune, p.metal).connect(mix);
      chain(noise(ctx, p.decay + 0.05, 7), gain(ctx, p.noise), mix);
    },
  },

  // Ride and crash: metallic buzz and noise with a long ring. The ride adds a few
  // sine partials for its "ping", the crash a bright splash at the start.
  cymbal: {
    length: (p) => p.decay + 0.05,
    build(ctx, out, p) {
      const mix = ctx.createGain();
      chain(mix, filter(ctx, 'highpass', p.hp), env(ctx, 1, p.decay, 0.002), out);
      metal(ctx, p.tune, p.metal).connect(mix);
      chain(noise(ctx, p.decay + 0.05, 9), gain(ctx, p.noise), mix);
      if (p.burst) chain(noise(ctx, 0.5, 10), filter(ctx, 'highpass', p.hp * 1.5), env(ctx, p.burst, 0.35), out);
      if (p.ping) {
        p.pings.forEach((f, i) => {
          const o = osc(ctx);
          o.frequency.value = f;
          chain(o, env(ctx, p.ping / (i + 1), p.pingDecay), out);
        });
      }
    },
  },
};
