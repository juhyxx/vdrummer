const NS = 'http://www.w3.org/2000/svg';

// The kit seen from above, the drummer sitting at the bottom. viewBox 0 0 400 320.
const KICK = { x: 148, y: 120, w: 110, h: 84 };
const PIECES = {
  snare: { cx: 136, cy: 232, r: 36, lugs: 10 },
  tom1: { cx: 172, cy: 128, r: 27, lugs: 6 },
  tom2: { cx: 234, cy: 128, r: 30, lugs: 6 },
  tom3: { cx: 296, cy: 236, r: 42, lugs: 8 },
  hat: { cx: 60, cy: 205, r: 34 },
  crash: { cx: 88, cy: 92, r: 52 },
  ride: { cx: 318, cy: 110, r: 58 },
};
// How long each piece glows after a hit, ms.
const GLOW_MS = { crash: 900, ride: 450, hho: 500, hhc: 160, hhp: 180, tom1: 300, tom2: 320, tom3: 360, snare: 220, rim: 150, kick: 260 };

function el(tag, attrs, parent) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  parent?.append(e);
  return e;
}

/**
 * Top view of the drum kit. Every hit lights up its piece (amber for accents, dim for
 * ghost notes); pressing a piece plays it. Shift-press the hi-hat to play it open.
 */
export class KitView {
  constructor(svg, onHit) {
    this.svg = svg;
    this.glows = {}; // instrument id → [[overlay element, brightness]]
    const style = getComputedStyle(document.documentElement);
    this.colors = { 2: style.getPropertyValue('--led').trim(), 3: style.getPropertyValue('--led-warn').trim() };
    this.build();
    svg.addEventListener('pointerdown', (e) => {
      const target = e.target.closest('[data-inst]');
      if (!target) return;
      e.preventDefault();
      onHit((e.shiftKey && target.dataset.shift) || target.dataset.inst);
    });
  }

  build() {
    const svg = this.svg;
    svg.setAttribute('viewBox', '0 0 400 320');
    const defs = el('defs', {}, svg);
    const f = el('filter', { id: 'kit-glow', x: '-50%', y: '-50%', width: '200%', height: '200%' }, defs);
    el('feGaussianBlur', { stdDeviation: 5, result: 'blur' }, f);
    const merge = el('feMerge', {}, f);
    el('feMergeNode', { in: 'blur' }, merge);
    el('feMergeNode', { in: 'SourceGraphic' }, merge);

    const base = el('g', { class: 'kit-base' }, svg);
    // Each glow is drawn right after its piece, so pieces in front (toms over the kick,
    // cymbals over drums) also cover its light.
    const glow = (ids, shape, attrs, brightness = 1) => {
      const node = el(shape, { ...attrs, opacity: 0, filter: 'url(#kit-glow)' }, base);
      for (const id of [].concat(ids)) (this.glows[id] ??= []).push([node, brightness]);
      return node;
    };

    // throne
    el('circle', { cx: 203, cy: 306, r: 24, class: 'throne' }, base);

    // kick: from above, its shell is a rectangle with the heads at front and back
    const kick = el('g', { 'data-inst': 'kick', class: 'piece' }, base);
    el('title', {}, kick).textContent = 'Kick';
    el('rect', { x: KICK.x, y: KICK.y, width: KICK.w, height: KICK.h, rx: 8, class: 'shell' }, kick);
    for (const y of [KICK.y + 3, KICK.y + KICK.h - 3]) el('line', { x1: KICK.x + 4, x2: KICK.x + KICK.w - 4, y1: y, y2: y, class: 'hoop' }, kick);
    el('rect', { x: 191, y: KICK.y + KICK.h + 4, width: 24, height: 44, rx: 5, class: 'pedal' }, kick);
    el('circle', { cx: 203, cy: KICK.y + KICK.h + 2, r: 5, class: 'beater' }, kick);
    glow('kick', 'rect', { x: KICK.x, y: KICK.y, width: KICK.w, height: KICK.h, rx: 8, class: 'glow-fill' });
    glow('kick', 'rect', { x: 191, y: KICK.y + KICK.h + 4, width: 24, height: 44, rx: 5, class: 'glow-fill' });

    // hi-hat pedal
    const pedal = el('g', { 'data-inst': 'hhp', class: 'piece' }, base);
    el('title', {}, pedal).textContent = 'Hat pedal';
    el('rect', { x: 49, y: 250, width: 22, height: 44, rx: 5, class: 'pedal' }, pedal);
    glow('hhp', 'rect', { x: 49, y: 250, width: 22, height: 44, rx: 5, class: 'glow-fill' });

    for (const id of ['snare', 'tom1', 'tom2', 'tom3']) this.drum(base, id, PIECES[id], glow);

    // side stick: the snare's rim
    const s = PIECES.snare;
    const rim = el('circle', { cx: s.cx, cy: s.cy, r: s.r + 3, class: 'rim-target', 'data-inst': 'rim' }, base);
    el('title', {}, rim).textContent = 'Side stick (the rim)';
    glow('rim', 'circle', { cx: s.cx, cy: s.cy, r: s.r + 3, class: 'glow-ring' });

    const hat = PIECES.hat;
    this.cymbal(base, 'hhc', hat, 'Hi-hat (shift: open)', 'hho');
    glow(['hhc', 'hho'], 'circle', { cx: hat.cx, cy: hat.cy, r: hat.r, class: 'glow-fill' });
    glow('hhp', 'circle', { cx: hat.cx, cy: hat.cy, r: hat.r, class: 'glow-fill' }, 0.45);
    glow('hho', 'circle', { cx: hat.cx, cy: hat.cy, r: hat.r + 7, class: 'glow-ring dashed' });

    this.cymbal(base, 'crash', PIECES.crash, 'Crash');
    glow('crash', 'circle', { cx: PIECES.crash.cx, cy: PIECES.crash.cy, r: PIECES.crash.r, class: 'glow-fill' });
    this.cymbal(base, 'ride', PIECES.ride, 'Ride');
    glow('ride', 'circle', { cx: PIECES.ride.cx, cy: PIECES.ride.cy, r: PIECES.ride.r, class: 'glow-fill' });

    this.kitName = el('text', { x: 392, y: 312, 'text-anchor': 'end', class: 'kit-name' }, svg);
  }

  drum(parent, id, { cx, cy, r, lugs }, glow) {
    const g = el('g', { 'data-inst': id, class: 'piece' }, parent);
    el('title', {}, g).textContent = { snare: 'Snare', tom1: 'High tom', tom2: 'Mid tom', tom3: 'Floor tom' }[id];
    el('circle', { cx, cy, r: r + 3, class: 'shell' }, g);
    el('circle', { cx, cy, r, class: 'head' }, g);
    for (let k = 0; k < lugs; k++) {
      const a = ((k + 0.5) / lugs) * 2 * Math.PI;
      el('circle', { cx: cx + (r + 3) * Math.cos(a), cy: cy + (r + 3) * Math.sin(a), r: 2, class: 'lug' }, g);
    }
    glow(id, 'circle', { cx, cy, r: r + 3, class: 'glow-fill' });
  }

  cymbal(parent, id, { cx, cy, r }, title, shift) {
    const g = el('g', { 'data-inst': id, class: 'piece' }, parent);
    if (shift) g.dataset.shift = shift;
    el('title', {}, g).textContent = title;
    el('circle', { cx, cy, r, class: 'cym' }, g);
    for (const k of [0.8, 0.62, 0.44]) el('circle', { cx, cy, r: r * k, class: 'groove' }, g);
    el('circle', { cx, cy, r: r * 0.24, class: 'bell' }, g);
    el('circle', { cx, cy, r: 2.5, class: 'nut' }, g);
  }

  setKitName(name) {
    this.kitName.textContent = `${name} kit`;
  }

  flash(id, level) {
    const color = this.colors[level === 3 ? 3 : 2];
    const peak = level === 1 ? 0.4 : 1;
    for (const [node, brightness] of this.glows[id] ?? []) {
      node.style.color = color;
      node.animate([{ opacity: peak * brightness }, { opacity: 0 }], { duration: GLOW_MS[id] ?? 250, easing: 'cubic-bezier(0.1, 0.7, 0.3, 1)' });
    }
  }
}
