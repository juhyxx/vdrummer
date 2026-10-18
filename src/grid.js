import { INSTRUMENTS } from './kits.js';
import { stepsPerBar, totalSteps } from './pattern.js';

// Counting syllables shown above the steps of a beat ("1 e + a" for 16ths).
const COUNT = { 1: [''], 2: ['', '+'], 3: ['', '+', 'a'], 4: ['', 'e', '+', 'a'], 6: ['', '·', '·', '+', '·', '·'] };
const CELL_MIN = 20; // px
const CELL_MAX = 56;
const GAP = 3;

const ROW = Object.fromEntries(INSTRUMENTS.map((inst, r) => [inst.id, r]));

function make(tag, className, text) {
  const e = document.createElement(tag);
  e.className = className;
  if (text != null) e.textContent = text;
  return e;
}

/**
 * The step grid: one row per instrument, one column per step. Clicking a cell sets it to
 * the current hit level, or clears it if it already has that level; dragging with the
 * mouse paints the same change over more cells. On touch a tap toggles and a drag scrolls.
 */
export class Grid {
  /**
   * @param {HTMLElement} scroller  scrolling container the grid goes into
   * @param {object} on  level() → current hit level; strokeStart(); paint(id, level); strokeEnd();
   *   preview(id); selectBar(bar)
   */
  constructor(scroller, on) {
    this.scroller = scroller;
    this.on = on;
    this.el = make('div', 'grid');
    this.el.setAttribute('role', 'grid');
    scroller.append(this.el);
    this.cells = [];   // [row][step]
    this.labels = [];
    this.heads = [];
    this.stroke = null;
    this.tap = null;
    this.playStep = -1;

    this.el.addEventListener('pointerdown', (e) => this.down(e));
    this.el.addEventListener('pointermove', (e) => this.move(e));
    this.el.addEventListener('pointerup', (e) => this.up(e));
    this.el.addEventListener('pointercancel', () => this.cancel());
    this.el.addEventListener('lostpointercapture', () => this.endStroke());
    this.el.addEventListener('contextmenu', (e) => e.target.closest('.cell') && e.preventDefault());
    // Keyboard: Enter/Space on a row name previews it, on a bar number selects the bar.
    this.el.addEventListener('click', (e) => {
      if (e.detail !== 0) return;
      const label = e.target.closest('.row-label');
      if (label) on.preview(label.dataset.inst);
    });
    new ResizeObserver(() => this.fit()).observe(scroller);
  }

  render(p, labelFor, selectedBar) {
    this.p = p;
    const spb = stepsPerBar(p);
    const total = totalSteps(p);
    const frag = document.createDocumentFragment();

    frag.append(make('div', 'corner'));
    this.heads = [];
    for (let b = 0; b < p.bars; b++) {
      const h = make('button', 'bar-head', String(b + 1));
      h.type = 'button';
      h.title = `Bar ${b + 1}: select it to copy or clear`;
      h.style.gridColumn = `span ${spb}`;
      h.classList.toggle('sel', b === selectedBar);
      h.addEventListener('click', () => this.on.selectBar(b));
      this.heads.push(h);
      frag.append(h);
    }

    frag.append(make('div', 'corner'));
    for (let i = 0; i < total; i++) {
      const s = i % spb;
      const sub = s % p.div;
      frag.append(make('div', 'count' + (sub ? '' : ' beat'), sub ? COUNT[p.div][sub] : String(s / p.div + 1)));
    }

    this.cells = [];
    this.labels = [];
    INSTRUMENTS.forEach((inst, r) => {
      const label = make('button', 'row-label', labelFor(inst));
      label.type = 'button';
      label.dataset.inst = inst.id;
      label.title = `${labelFor(inst)}: press to hear it`;
      this.labels.push(label);
      frag.append(label);
      const row = [];
      for (let i = 0; i < total; i++) {
        const s = i % spb;
        let cls = 'cell';
        if (s % p.div === 0) cls += ' beat';
        if (s === 0 && i > 0) cls += ' bar';
        if (Math.floor(s / p.div) % 2) cls += ' odd';
        const c = make('div', cls);
        c.dataset.r = r;
        c.dataset.i = i;
        c.dataset.v = p.notes[inst.id][i];
        row.push(c);
        frag.append(c);
      }
      this.cells.push(row);
    });

    this.playhead = make('div', 'playhead');
    frag.append(this.playhead);
    this.el.replaceChildren(frag);
    this.el.style.setProperty('--steps', total);
    this.playStep = -1;
    this.fit();
  }

  /** Re-reads every cell's level from the pattern (after an edit that kept the shape). */
  refresh() {
    INSTRUMENTS.forEach(({ id }, r) => this.cells[r].forEach((c, i) => (c.dataset.v = this.p.notes[id][i])));
  }

  setLabels(labelFor) {
    INSTRUMENTS.forEach((inst, r) => {
      this.labels[r].textContent = labelFor(inst);
      this.labels[r].title = `${labelFor(inst)}: press to hear it`;
    });
  }

  selectBar(bar) {
    this.heads.forEach((h, b) => h.classList.toggle('sel', b === bar));
  }

  /** Sizes the cells to fill the screen's width, within limits. */
  fit() {
    if (!this.p) return;
    const total = totalSteps(this.p);
    const labelW = this.labels[0]?.offsetWidth ?? 96;
    const avail = this.scroller.clientWidth - labelW - 24;
    const w = Math.max(CELL_MIN, Math.min(CELL_MAX, Math.floor(avail / total - GAP)));
    this.el.style.setProperty('--cw', `${w}px`);
    if (this.playStep >= 0) this.setPlayhead(this.playStep, false);
  }

  setPlayhead(step, follow = true) {
    this.playStep = step;
    const cell = this.cells[0]?.[step];
    if (!cell) {
      this.playhead.hidden = true;
      return;
    }
    const last = this.cells[this.cells.length - 1][step];
    Object.assign(this.playhead.style, {
      transform: `translate(${cell.offsetLeft - 2}px, ${cell.offsetTop - 2}px)`,
      width: `${cell.offsetWidth + 4}px`,
      height: `${last.offsetTop + last.offsetHeight - cell.offsetTop + 4}px`,
    });
    this.playhead.hidden = false;
    if (follow && !this.stroke) this.follow(step);
  }

  /** Scrolls so the playing bar is in view, when the loop is wider than the screen. */
  follow(step) {
    const sc = this.scroller;
    if (sc.scrollWidth <= sc.clientWidth) return;
    const cell = this.cells[0][step];
    const labelW = this.labels[0].offsetWidth;
    const left = cell.offsetLeft - labelW;
    if (left >= sc.scrollLeft && cell.offsetLeft + cell.offsetWidth <= sc.scrollLeft + sc.clientWidth) return;
    const barStart = this.cells[0][step - (step % stepsPerBar(this.p))];
    sc.scrollTo({ left: barStart.offsetLeft - labelW - 8, behavior: 'smooth' });
  }

  /** Lights up the cells that just played. */
  flash(step, hits) {
    for (const [id] of hits) {
      this.cells[ROW[id]]?.[step]?.animate([{ filter: 'brightness(1.9)' }, { filter: 'brightness(1)' }], { duration: 180, easing: 'ease-out' });
    }
  }

  // ---------------------------------------------------------------- painting

  down(e) {
    const label = e.target.closest('.row-label');
    if (label) {
      this.on.preview(label.dataset.inst);
      return;
    }
    const cell = e.target.closest('.cell');
    if (!cell || e.button !== 0) return;
    if (e.pointerType === 'touch') {
      this.tap = { cell, x: e.clientX, y: e.clientY };
      return;
    }
    e.preventDefault();
    this.el.setPointerCapture(e.pointerId);
    this.startStroke(cell);
  }

  startStroke(cell) {
    const { id, i } = this.at(cell);
    const level = this.on.level();
    this.stroke = { value: this.p.notes[id][i] === level ? 0 : level, last: null };
    this.on.strokeStart();
    this.paint(cell);
  }

  paint(cell) {
    if (cell === this.stroke.last) return;
    this.stroke.last = cell;
    const { id, i } = this.at(cell);
    const v = this.stroke.value;
    if (this.p.notes[id][i] === v) return;
    this.p.notes[id][i] = v;
    cell.dataset.v = v;
    this.on.paint(id, v);
  }

  move(e) {
    if (!this.stroke) return;
    const cell = document.elementFromPoint(e.clientX, e.clientY)?.closest('.cell');
    if (cell && this.el.contains(cell)) this.paint(cell);
  }

  up(e) {
    const tap = this.tap;
    this.tap = null;
    if (tap && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) < 12) {
      this.startStroke(tap.cell);
      this.endStroke();
      return;
    }
    this.endStroke();
  }

  cancel() {
    this.tap = null;
    this.endStroke();
  }

  endStroke() {
    if (!this.stroke) return;
    this.stroke = null;
    this.on.strokeEnd();
  }

  at(cell) {
    return { id: INSTRUMENTS[cell.dataset.r].id, i: Number(cell.dataset.i) };
  }
}
