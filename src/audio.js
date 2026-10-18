import { INSTRUMENTS, KITS } from './kits.js';
import { renderKit } from './synth.js';

// Gain of each hit level: 1 ghost, 2 normal, 3 accent.
const VELOCITY = [0, 0.3, 0.7, 1];

/**
 * Plays the drum sounds. Kits are rendered ahead of time (see synth.js); each instrument
 * has its own bus, panned to its place in the kit and sent to a small room reverb.
 */
export class DrumEngine {
  constructor() {
    this.ctx = null;
    this.rendered = new Map(); // kit id → Promise of { instrument id: AudioBuffer }
    this.buffers = null;
    this.kit = null;
    this.volume = 0.8;
    this.openHat = null;
  }

  /** Renders a kit's sounds (once) without switching to it, so switching later is instant. */
  prepare(id) {
    if (!this.rendered.has(id)) this.rendered.set(id, renderKit(KITS[id]));
    return this.rendered.get(id);
  }

  async setKit(id) {
    this.kit = id;
    const buffers = await this.prepare(id);
    if (this.kit !== id) return; // another kit was picked meanwhile
    this.buffers = buffers;
    if (this.ctx) this.setRoom();
  }

  /** Creates or resumes the AudioContext. Call it from a user gesture, or browsers keep it silent. */
  start() {
    if (!this.ctx) this.createContext();
    if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  createContext() {
    // iOS: play through the silent switch, like a music app.
    if (navigator.audioSession) navigator.audioSession.type = 'playback';
    const ctx = (this.ctx = new AudioContext({ latencyHint: 'interactive' }));
    this.master = new GainNode(ctx, { gain: this.volume ** 2 });
    const limiter = new DynamicsCompressorNode(ctx, { threshold: -10, knee: 10, ratio: 4, attack: 0.003, release: 0.2 });
    this.master.connect(limiter).connect(ctx.destination);
    this.send = new GainNode(ctx, { gain: 0 });
    this.buses = {};
    for (const inst of INSTRUMENTS) {
      const pan = new StereoPannerNode(ctx, { pan: inst.pan });
      pan.connect(this.master);
      pan.connect(this.send);
      this.buses[inst.id] = pan;
    }
    this.setRoom();
  }

  /** Builds the current kit's reverb: decaying noise as the impulse response. */
  setRoom() {
    const { seconds, send } = KITS[this.kit ?? 'rock'].room;
    const ctx = this.ctx;
    const len = Math.round(seconds * ctx.sampleRate);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 4;
    }
    // A convolver's buffer can't always be replaced in place, so swap in a new node.
    this.reverb?.disconnect();
    this.send.disconnect();
    this.reverb = new ConvolverNode(ctx, { buffer: ir });
    this.send.connect(this.reverb).connect(this.master);
    this.send.gain.value = send;
  }

  setVolume(v) {
    this.volume = v;
    if (this.ctx) this.master.gain.setTargetAtTime(v ** 2, this.ctx.currentTime, 0.02);
  }

  /** Plays instrument `id` at hit `level` (1–3), at context time `time` (now if omitted or past). */
  play(id, level, time = 0) {
    const buffer = this.buffers?.[id];
    if (!buffer || !this.ctx) return;
    const ctx = this.ctx;
    const t = Math.max(time, ctx.currentTime);
    if (id === 'hhc' || id === 'hhp' || id === 'hho') this.choke(t);
    const src = new AudioBufferSourceNode(ctx, { buffer });
    const g = new GainNode(ctx, { gain: VELOCITY[level] ?? 0.7 });
    src.connect(g).connect(this.buses[id]);
    src.start(t);
    if (id === 'hho') this.openHat = { src, g, t, end: t + buffer.duration };
  }

  /** Closing the hi-hat (or hitting it open again) silences the open hat that's still ringing. */
  choke(t) {
    const hat = this.openHat;
    if (!hat || t <= hat.t || t >= hat.end) return;
    hat.g.gain.setTargetAtTime(0, t, 0.01);
    hat.src.stop(t + 0.08);
    this.openHat = null;
  }

  /** The context time of the sound coming out of the speakers right now. */
  heardTime() {
    const ctx = this.ctx;
    if (!ctx) return 0;
    const ts = ctx.getOutputTimestamp?.();
    if (ts?.contextTime > 0 && ts.performanceTime > 0) {
      return ts.contextTime + (performance.now() - ts.performanceTime) / 1000;
    }
    return ctx.currentTime - (ctx.outputLatency || ctx.baseLatency || 0);
  }
}
