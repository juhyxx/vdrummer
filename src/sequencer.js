import { INSTRUMENTS } from './kits.js?v=78c12be';
import { stepsPerBar, totalSteps } from './pattern.js?v=78c12be';

const LOOKAHEAD = 0.12; // s of audio scheduled in advance
const INTERVAL = 25;    // ms between scheduler runs

// The scheduler's clock runs in a worker: timers on the page are throttled to once a second
// in background tabs, which would make the drummer stumble.
const TIMER = `let id = 0;
onmessage = (e) => { clearInterval(id); if (e.data === 'start') id = setInterval(() => postMessage(0), ${INTERVAL}); };`;

/**
 * Steps through the pattern, scheduling each step's hits on the audio clock a little
 * ahead of time ("A Tale of Two Clocks"). Every scheduled step is also queued with its
 * time, so the screen can show it the moment it's heard.
 */
export class Sequencer {
  constructor(engine, getPattern) {
    this.engine = engine;
    this.getPattern = getPattern;
    this.playing = false;
    this.step = 0;
    this.nextTime = 0;
    this.queue = []; // { time, step, hits: [[instrument id, level]] }
    this.timer = new Worker(URL.createObjectURL(new Blob([TIMER], { type: 'text/javascript' })));
    this.timer.onmessage = () => this.playing && this.schedule();
  }

  start() {
    const ctx = this.engine.start();
    this.step = 0;
    this.nextTime = ctx.currentTime + 0.06;
    this.queue = [];
    this.playing = true;
    this.schedule();
    this.timer.postMessage('start');
  }

  stop() {
    this.playing = false;
    this.timer.postMessage('stop');
    this.queue = [];
  }

  schedule() {
    const ctx = this.engine.ctx;
    const p = this.getPattern();
    const total = totalSteps(p);
    this.step %= total;
    // After the tab was frozen, carry on from now rather than rushing through the missed steps.
    if (this.nextTime < ctx.currentTime - 0.2) this.nextTime = ctx.currentTime + 0.02;

    while (this.nextTime < ctx.currentTime + LOOKAHEAD) {
      const stepDur = 60 / p.tempo / p.div;
      const time = this.nextTime + swingDelay(p, this.step, stepDur);
      const hits = [];
      for (const { id } of INSTRUMENTS) {
        const level = p.notes[id][this.step];
        if (!level) continue;
        this.engine.play(id, level, time);
        hits.push([id, level]);
      }
      this.queue.push({ time, step: this.step, hits });
      this.nextTime += stepDur;
      this.step = (this.step + 1) % total;
    }
  }

  /** Steps whose time has come, oldest first. */
  due(now) {
    let n = 0;
    while (n < this.queue.length && this.queue[n].time <= now) n++;
    return this.queue.splice(0, n);
  }

  /** Keeps the position within the bar when the grid changes shape under a playing pattern. */
  reposition(oldSpb, p) {
    const spb = stepsPerBar(p);
    const bar = Math.floor(this.step / oldSpb);
    this.step = (bar * spb + Math.floor(((this.step % oldSpb) * spb) / oldSpb)) % totalSteps(p);
    this.queue = this.queue.filter((e) => e.time <= this.engine.heardTime() + 0.01);
  }
}

/** Swing delays every second 8th (or 16th) note; at 100 % it lands on the last triplet. */
export function swingDelay(p, step, stepDur) {
  if (!p.swing || (p.div !== 2 && p.div !== 4) || step % 2 === 0) return 0;
  return ((p.swing / 100) * stepDur) / 3;
}
