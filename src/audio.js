import { INSTRUMENTS, KITS } from './kits.js?v=78c12be';

// Gain of each hit level: 1 ghost, 2 normal, 3 accent. Ghost notes also use the kit's
// softly played sample where it has one, which sounds different, not just quieter.
const VELOCITY = [0, 0.3, 0.7, 1];

/** Fetches and decodes a kit's samples: { instrument id: { hit, soft } } of AudioBuffers. */
async function loadKit(id) {
  // An offline context decodes without a user gesture, so kits can load before the first click.
  const decoder = new OfflineAudioContext(1, 1, 44100);
  const load = async (name) => {
    const res = await fetch(`samples/${id}/${name}.wav`);
    if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
    return decoder.decodeAudioData(await res.arrayBuffer());
  };
  const { soft, alias = {} } = KITS[id];
  const own = INSTRUMENTS.filter((inst) => !alias[inst.id]);
  const voices = await Promise.all(
    own.map(async (inst) => ({
      hit: await load(inst.id),
      soft: soft.includes(inst.id) ? await load(`${inst.id}-soft`) : null,
    })),
  );
  const kit = Object.fromEntries(own.map((inst, i) => [inst.id, voices[i]]));
  for (const [inst, other] of Object.entries(alias)) kit[inst] = kit[other];
  return kit;
}

// Reverb amount (0–1) → levels. The convolver normalises its impulse response, so a send of
// 1 comes back about as loud as the dry kit. The curve keeps the low half of the slider
// subtle and saves the wash for the top; there the dry kit dips a little to make room.
const wet = (v) => 1.6 * v ** 1.6;
const dry = (v) => 1 - 0.25 * v ** 2;

/**
 * Plays the drum samples. Each instrument has its own bus, panned to its place in the kit;
 * the whole kit then goes through one room reverb, whose amount the player sets.
 */
export class DrumEngine {
  constructor() {
    this.ctx = null;
    this.loaded = new Map(); // kit id → Promise of its buffers
    this.buffers = null;
    this.kit = null;
    this.volume = 0.8;
    this.reverbAmount = 0.3;
    this.openHat = null;
  }

  /** Loads a kit's samples (once) without switching to it, so switching later is instant. */
  prepare(id) {
    if (!this.loaded.has(id)) {
      this.loaded.set(id, loadKit(id).catch((err) => {
        this.loaded.delete(id); // let a later attempt try again
        throw err;
      }));
    }
    return this.loaded.get(id);
  }

  async setKit(id) {
    this.kit = id;
    const buffers = await this.prepare(id);
    if (this.kit !== id) return; // another kit was picked meanwhile
    this.buffers = buffers;
    if (this.ctx) {
      this.setRoom();
      this.applyPan();
    }
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
    // kit → dry → master, and kit → send → low cut (keeps the kick's boom dry) → reverb → master
    const kit = new GainNode(ctx);
    this.dry = new GainNode(ctx, { gain: dry(this.reverbAmount) });
    kit.connect(this.dry).connect(this.master);
    this.send = new GainNode(ctx, { gain: wet(this.reverbAmount) });
    this.lowCut = new BiquadFilterNode(ctx, { type: 'highpass', frequency: 200 });
    kit.connect(this.send).connect(this.lowCut);
    this.buses = {};
    for (const inst of INSTRUMENTS) {
      this.buses[inst.id] = new StereoPannerNode(ctx);
      this.buses[inst.id].connect(kit);
    }
    this.applyPan();
    this.setRoom();
  }

  /** Pans every instrument to its place for the current kit (see `pan` in kits.js). */
  applyPan() {
    const t = this.ctx.currentTime;
    const kitPan = KITS[this.kit]?.pan ?? {};
    for (const inst of INSTRUMENTS) this.buses[inst.id].pan.setTargetAtTime(kitPan[inst.id] ?? inst.pan, t, 0.03);
  }

  /**
   * Builds the current kit's room: an impulse response of noise that decays to −60 dB over
   * the room's length and gets darker as it goes (walls soak up the highs first), after a
   * short pre-delay. Each channel has its own noise, for a wide stereo tail.
   */
  setRoom() {
    const { seconds } = KITS[this.kit ?? 'rock'].room;
    if (this.reverb && this.roomSeconds === seconds) return;
    this.roomSeconds = seconds;
    const ctx = this.ctx;
    const rate = ctx.sampleRate;
    const pre = Math.round(0.012 * rate);
    const len = Math.round(seconds * rate);
    const ir = ctx.createBuffer(2, pre + len, rate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / rate;
        const k = 0.08 + 0.6 * Math.exp((-3 * t) / seconds); // one-pole low-pass, closing over time
        lp += k * (Math.random() * 2 - 1 - lp);
        d[pre + i] = lp * Math.exp((-6.9 * t) / seconds);
      }
    }
    // A convolver's buffer can't always be replaced in place, so swap in a new node.
    this.reverb?.disconnect();
    this.lowCut.disconnect();
    this.reverb = new ConvolverNode(ctx, { buffer: ir });
    this.lowCut.connect(this.reverb).connect(this.master);
  }

  /** Reverb amount, 0–1, for the whole kit. */
  setReverb(v) {
    this.reverbAmount = v;
    if (!this.ctx) return;
    this.send.gain.setTargetAtTime(wet(v), this.ctx.currentTime, 0.03);
    this.dry.gain.setTargetAtTime(dry(v), this.ctx.currentTime, 0.03);
  }

  setVolume(v) {
    this.volume = v;
    if (this.ctx) this.master.gain.setTargetAtTime(v ** 2, this.ctx.currentTime, 0.02);
  }

  /** Plays instrument `id` at hit `level` (1–3), at context time `time` (now if omitted or past). */
  play(id, level, time = 0) {
    const voice = this.buffers?.[id];
    if (!voice || !this.ctx) return;
    const buffer = (level === 1 && voice.soft) || voice.hit;
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
