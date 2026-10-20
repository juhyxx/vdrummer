const NS = 'http://www.w3.org/2000/svg';

// The kit seen from above, the drummer sitting at the bottom. viewBox 0 8 400 284.
const KICK = { y: 120, h: 84 }; // bass drum shells; their x and width depend on how many there are
const PIECES = {
  snare: { cx: 136, cy: 232, r: 36, lugs: 10 },
  tom1: { cx: 172, cy: 128, r: 27, lugs: 6 },
  tom2: { cx: 234, cy: 128, r: 30, lugs: 6 },
  tom3: { cx: 296, cy: 236, r: 42, lugs: 8 },
  hat: { cx: 60, cy: 205, r: 34 },
  // the crashes hang high on both sides; the ride sits lower, out over the floor tom
  crash: { cx: 88, cy: 70, r: 50 },
  crash2: { cx: 300, cy: 66, r: 46 },
  tamb: { cx: 22, cy: 158, r: 18 }, // mounted on the hi-hat stand
  ride: { cx: 334, cy: 160, r: 52 },
};
// How long each piece glows after a hit, ms.
const GLOW_MS = { tamb: 240, crash2: 900, crash: 900, ride: 450, hho: 500, hhc: 160, hhp: 180, tom1: 300, tom2: 320, tom3: 360, snare: 220, rim: 150, kick: 260, kick2: 260 };

function el(tag, attrs, parent) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  parent?.append(e);
  return e;
}

const colorOf = (id) => `var(--i-${id})`;

/** A clickable piece: its group plays `id` and is outlined in that instrument's colour. */
function piece(parent, id, title) {
  const g = el('g', { 'data-inst': id, class: 'piece', style: `--c: ${colorOf(id)}` }, parent);
  el('title', {}, g).textContent = title;
  return g;
}

/**
 * Top view of the drum kit. Each piece is outlined in its instrument's colour (as in the
 * grid) and lights up in it when hit: brightest for accents, dim for ghost notes. Pressing
 * a piece plays it; shift-press the hi-hat to play it open.
 */
export class KitView {
  constructor(svg, onHit) {
    this.svg = svg;
    this.glows = {}; // instrument id → [[overlay element, brightness]]
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
    svg.setAttribute('viewBox', '0 8 400 284');
    const defs = el('defs', {}, svg);
    const f = el('filter', { id: 'kit-glow', x: '-50%', y: '-50%', width: '200%', height: '200%' }, defs);
    el('feGaussianBlur', { stdDeviation: 3.5, result: 'blur' }, f);
    const merge = el('feMerge', {}, f);
    el('feMergeNode', { in: 'blur' }, merge);
    el('feMergeNode', { in: 'SourceGraphic' }, merge);

    const base = el('g', { class: 'kit-base' }, svg);
    // Each glow is drawn right after its piece, so pieces in front (toms over the kick,
    // cymbals over drums) also cover its light.
    const glow = (ids, shape, attrs, brightness = 1, parent = base) => {
      const node = el(shape, { ...attrs, opacity: 0, filter: 'url(#kit-glow)' }, parent);
      for (const id of [].concat(ids)) (this.glows[id] ??= []).push([node, brightness]);
      return node;
    };

    // Bass drums: one, which Kick 2 (a double pedal) lights too, or two side by side, splayed
    // outwards as double-kick kits are set up. setKicks() shows the one that fits the kit.
    const single = el('g', { class: 'kicks-1' }, base);
    this.kickDrum(single, ['kick', 'kick2'], 148, 110, 'Kick', glow);
    const double = el('g', { class: 'kicks-2' }, base);
    this.kickDrum(double, ['kick2'], 112, 88, 'Kick 2', glow, -9);
    this.kickDrum(double, ['kick'], 206, 88, 'Kick', glow, 9);

    // The only pedal shown is the hi-hat's: it's an instrument of its own (the kick pedals
    // would only repeat their drums).
    const pedal = piece(base, 'hhp', 'Hat pedal');
    el('rect', { x: 49, y: 246, width: 22, height: 40, rx: 5, class: 'pedal' }, pedal);
    glow('hhp', 'rect', { x: 49, y: 246, width: 22, height: 40, rx: 5, class: 'glow-fill' });

    for (const id of ['snare', 'tom1', 'tom2', 'tom3']) this.drum(base, id, PIECES[id], glow);

    // side stick: the snare's rim
    const s = PIECES.snare;
    const rim = el('circle', { cx: s.cx, cy: s.cy, r: s.r + 3, class: 'rim-target', 'data-inst': 'rim', style: `--c: ${colorOf('rim')}` }, base);
    el('title', {}, rim).textContent = 'Side stick (the rim)';
    glow('rim', 'circle', { cx: s.cx, cy: s.cy, r: s.r + 3, class: 'glow-ring' });

    const hat = PIECES.hat;
    this.cymbal(base, 'hhc', hat, 'Hi-hat (shift: open)', 'hho');
    glow(['hhc', 'hho'], 'circle', { cx: hat.cx, cy: hat.cy, r: hat.r, class: 'glow-fill' });
    glow('hhp', 'circle', { cx: hat.cx, cy: hat.cy, r: hat.r, class: 'glow-fill' }, 0.45);
    glow('hho', 'circle', { cx: hat.cx, cy: hat.cy, r: hat.r + 7, class: 'glow-ring dashed' });

    this.cymbal(base, 'crash', PIECES.crash, 'Crash L');
    glow('crash', 'circle', { cx: PIECES.crash.cx, cy: PIECES.crash.cy, r: PIECES.crash.r, class: 'glow-fill' });
    this.cymbal(base, 'crash2', PIECES.crash2, 'Crash R');
    glow('crash2', 'circle', { cx: PIECES.crash2.cx, cy: PIECES.crash2.cy, r: PIECES.crash2.r, class: 'glow-fill' });
    this.cymbal(base, 'ride', PIECES.ride, 'Ride');
    glow('ride', 'circle', { cx: PIECES.ride.cx, cy: PIECES.ride.cy, r: PIECES.ride.r, class: 'glow-fill' });

    this.tambourine(base, PIECES.tamb, glow);

    this.kitName = el('text', { x: 392, y: 288, 'text-anchor': 'end', class: 'kit-name' }, svg);
  }

  /**
   * A bass drum from above: its shell is a rectangle, with a head at the front and the back.
   * `angle` (degrees, clockwise) turns it about the middle of its back head.
   */
  kickDrum(parent, ids, x, w, title, glow, angle = 0) {
    const back = KICK.y + KICK.h;
    const turned = el('g', angle ? { transform: `rotate(${angle} ${x + w / 2} ${back})` } : {}, parent);
    const g = piece(turned, ids[0], title);
    el('rect', { x, y: KICK.y, width: w, height: KICK.h, rx: 8, class: 'shell' }, g);
    for (const y of [KICK.y + 3, back - 3]) el('line', { x1: x + 4, x2: x + w - 4, y1: y, y2: y, class: 'hoop' }, g);
    glow(ids, 'rect', { x, y: KICK.y, width: w, height: KICK.h, rx: 8, class: 'glow-fill' }, 1, turned);
  }

  drum(parent, id, { cx, cy, r, lugs }, glow) {
    const g = piece(parent, id, { snare: 'Snare', tom1: 'High tom', tom2: 'Mid tom', tom3: 'Floor tom' }[id]);
    el('circle', { cx, cy, r: r + 3, class: 'shell' }, g);
    el('circle', { cx, cy, r, class: 'head' }, g);
    for (let k = 0; k < lugs; k++) {
      const a = ((k + 0.5) / lugs) * 2 * Math.PI;
      el('circle', { cx: cx + (r + 3) * Math.cos(a), cy: cy + (r + 3) * Math.sin(a), r: 2, class: 'lug' }, g);
    }
    glow(id, 'circle', { cx, cy, r: r + 3, class: 'glow-fill' });
  }

  /** A tambourine: a wooden frame with pairs of jingles in slots around it. */
  tambourine(parent, { cx, cy, r }, glow) {
    const g = piece(parent, 'tamb', 'Tambourine');
    el('circle', { cx, cy, r, class: 'frame' }, g);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * 2 * Math.PI - Math.PI / 2;
      el('rect', { x: cx + r * Math.cos(a) - 3, y: cy + r * Math.sin(a) - 2, width: 6, height: 4, rx: 1, class: 'jingle', transform: `rotate(${(a * 180) / Math.PI + 90} ${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)})` }, g);
    }
    glow('tamb', 'circle', { cx, cy, r: r + 2, class: 'glow-fill' });
  }

  cymbal(parent, id, { cx, cy, r }, title, shift) {
    const g = piece(parent, id, title);
    if (shift) g.dataset.shift = shift;
    el('circle', { cx, cy, r, class: 'cym' }, g);
    for (const k of [0.8, 0.62, 0.44]) el('circle', { cx, cy, r: r * k, class: 'groove' }, g);
    el('circle', { cx, cy, r: r * 0.24, class: 'bell' }, g);
    el('circle', { cx, cy, r: 2.5, class: 'nut' }, g);
  }

  setKicks(n) {
    this.svg.dataset.kicks = n;
  }

  setKitName(text, title) {
    this.kitName.textContent = text;
    (this.kitName.firstElementChild ?? el('title', {}, this.kitName)).textContent = title;
  }

  flash(id, level) {
    const peak = [0, 0.3, 0.65, 0.85][level] ?? 0.65;
    for (const [node, brightness] of this.glows[id] ?? []) {
      node.style.color = colorOf(id);
      node.animate([{ opacity: peak * brightness }, { opacity: 0 }], { duration: GLOW_MS[id] ?? 250, easing: 'cubic-bezier(0.1, 0.7, 0.3, 1)' });
    }
  }
}
