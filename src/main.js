import { DrumEngine } from './audio.js?v=78c12be';
import { Grid } from './grid.js?v=78c12be';
import { KITS, KIT_IDS, instrumentLabel } from './kits.js?v=78c12be';
import { KitView } from './kitview.js?v=78c12be';
import { toMidi } from './midi.js?v=78c12be';
import {
  BEATS, DIVISIONS, MAX_BARS, TEMPO,
  clearBar, deserialize, fromPreset, serialize, setBars, setBeats, setDivision, stepsPerBar,
} from './pattern.js?v=78c12be';
import { GENRES, PRESETS } from './presets.js?v=78c12be';
import { Sequencer } from './sequencer.js?v=78c12be';
import { VERSION } from './version.js?v=78c12be';

const KEYS = { settings: 'vdrummer.settings', pattern: 'vdrummer.pattern', library: 'vdrummer.library' };
// kitWidth, kitHeight: the kit view's size in px, once the splitter is dragged (0: the default)
const DEFAULTS = { volume: 80, reverb: 30, showKit: true, kitWidth: 0, kitHeight: 0 };
const UNDO_LIMIT = 100;

const $ = (id) => document.getElementById(id);
const els = {
  play: $('play'),
  tempo: $('tempo'),
  tempoValue: $('tempoValue'),
  tap: $('tap'),
  kits: $('kits'),
  rhythm: $('rhythm'),
  rhythmName: $('rhythmName'),
  rhythmPanel: $('rhythmPanel'),
  prevRhythm: $('prevRhythm'),
  nextRhythm: $('nextRhythm'),
  save: $('save'),
  remove: $('remove'),
  volume: $('volume'),
  volumeValue: $('volumeValue'),
  reverb: $('reverb'),
  reverbValue: $('reverbValue'),
  meter: $('meter'),
  division: $('division'),
  barsDown: $('barsDown'),
  bars: $('bars'),
  barsUp: $('barsUp'),
  swing: $('swing'),
  swingValue: $('swingValue'),
  selBar: $('selBar'),
  clearBar: $('clearBar'),
  undo: $('undo'),
  redo: $('redo'),
  midi: $('midi'),
  stage: $('stage'),
  splitter: $('splitter'),
  rhythmModule: $('rhythmModule'),
  sound: $('sound'),
  volumeModule: $('volumeModule'),
  kitScreen: $('kitScreen'),
  kitPicker: $('kitPicker'),
  readout: $('readout'),
  bpm: $('bpm'),
  pos: $('pos'),
  beatLeds: $('beatLeds'),
  brandDot: $('brandDot'),
  dialog: $('dialog'),
  dialogText: $('dialogText'),
  dialogInput: $('dialogInput'),
  dialogOk: $('dialogOk'),
  toast: $('toast'),
};

// ---------------------------------------------------------------- storage

function load(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function store(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable (private mode etc.) — nothing persists, the app still works.
  }
}

const settings = { ...DEFAULTS, ...load(KEYS.settings, {}) };
let library = (load(KEYS.library, []) || []).filter((x) => x && x.id);

// The pattern being edited, and where it came from: 'p:<preset id>', 'u:<saved id>' or ''.
// `dirty` means it was changed since it was loaded or saved.
const saved = load(KEYS.pattern, null);
let pattern = saved ? deserialize(saved) : fromPreset(PRESETS[0]);
const state = {
  source: saved ? String(saved.source ?? '') : `p:${PRESETS[0].id}`,
  dirty: saved ? Boolean(saved.dirty) : false,
  bar: 0, // the bar selected for clearing
};

let persistTimer = 0;
function persist() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(persistNow, 200);
}

function persistNow() {
  clearTimeout(persistTimer);
  store(KEYS.pattern, { ...serialize(pattern), source: state.source, dirty: state.dirty });
  store(KEYS.settings, settings);
}

// Don't lose the last edit when the page is closed or put away inside the debounce.
window.addEventListener('pagehide', persistNow);
document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && persistNow());

// ---------------------------------------------------------------- audio, views

const engine = new DrumEngine();
engine.volume = settings.volume / 100;
engine.reverbAmount = settings.reverb / 100;
const seq = new Sequencer(engine, () => pattern);
const kitView = new KitView($('kit'), (id) => preview(id, 2));
const grid = new Grid($('gridScroller'), {
  strokeStart,
  paint: onPaint,
  strokeEnd,
  preview: (id) => preview(id, 2),
  selectBar,
});
const beatLeds = [];

const label = (inst) => instrumentLabel(pattern.kit, inst);

let kitLoading = null; // id of the kit whose samples are on their way

/** Switches the sound to the pattern's kit; the promise settles once its samples are loaded. */
function useKit() {
  const id = pattern.kit;
  const ready = engine.setKit(id);
  kitLoading = id;
  showKitName();
  ready.then(
    () => kitLoading === id && ((kitLoading = null), showKitName()),
    () => {
      if (kitLoading !== id) return;
      kitLoading = null;
      showKitName();
      toast(`Couldn't load the ${KITS[id].name} kit`);
    },
  );
  return ready;
}

function showKitName() {
  const kit = KITS[pattern.kit];
  kitView.setKicks(kit.kicks);
  kitView.setKitName(kitLoading === pattern.kit ? `Loading ${kit.name} kit...` : `${kit.name} kit`, `Samples: ${kit.source}`);
}

function preview(id, level) {
  engine.start();
  engine.play(id, level);
  kitView.flash(id, level);
}

// ---------------------------------------------------------------- history

const history = { undo: [], redo: [] };

function snapshot() {
  return { p: JSON.stringify(serialize(pattern)), source: state.source, dirty: state.dirty };
}

function remember(snap) {
  history.undo.push(snap);
  if (history.undo.length > UNDO_LIMIT) history.undo.shift();
  history.redo.length = 0;
  showHistory();
}

/** Runs a change to the pattern, as one undo step. Returns whether anything changed. */
function edit(change) {
  const before = snapshot();
  const spb = stepsPerBar(pattern);
  change(pattern);
  if (JSON.stringify(serialize(pattern)) === before.p) return false;
  remember(before);
  state.dirty = true;
  afterChange(spb);
  return true;
}

function afterChange(oldSpb) {
  seq.reposition(oldSpb, pattern);
  state.bar = Math.min(state.bar, pattern.bars - 1);
  render();
  persist();
}

function restore(snap) {
  const spb = stepsPerBar(pattern);
  pattern = deserialize(JSON.parse(snap.p));
  state.source = snap.source;
  state.dirty = snap.dirty;
  useKit();
  afterChange(spb);
}

function undo() {
  const snap = history.undo.pop();
  if (!snap) return;
  history.redo.push(snapshot());
  restore(snap);
}

function redo() {
  const snap = history.redo.pop();
  if (!snap) return;
  history.undo.push(snapshot());
  restore(snap);
}

// Painting on the grid changes the pattern in place; a whole drag is one undo step.
let strokeBefore = null;
let strokeChanged = false;

function strokeStart() {
  strokeBefore = snapshot();
  strokeChanged = false;
}

function onPaint(id, level) {
  strokeChanged = true;
  if (level && !seq.playing) preview(id, level);
}

function strokeEnd() {
  if (strokeChanged) {
    remember(strokeBefore);
    state.dirty = true;
    showSource();
    persist();
  }
  strokeBefore = null;
}

// ---------------------------------------------------------------- render

function render() {
  showTempo();
  for (const input of els.kits.querySelectorAll('input')) input.checked = input.value === pattern.kit;
  showKitName();
  els.meter.value = pattern.beats;
  els.division.value = pattern.div;
  els.bars.textContent = pattern.bars;
  els.barsDown.disabled = pattern.bars <= 1;
  els.barsUp.disabled = pattern.bars >= MAX_BARS;
  els.swing.value = pattern.swing;
  els.swing.disabled = pattern.div !== 2 && pattern.div !== 4;
  els.swing.title = els.swing.disabled ? 'Swing works on 1/8 and 1/16 grids' : 'Delays every second note';
  els.swingValue.textContent = `${pattern.swing}%`;
  setFill(els.swing);
  els.selBar.textContent = state.bar + 1;
  grid.render(pattern, label, state.bar);
  makeBeatLeds();
  showSource();
  showHistory();
}

function showTempo() {
  els.tempo.value = pattern.tempo;
  els.tempoValue.textContent = `${pattern.tempo}`;
  els.bpm.textContent = pattern.tempo;
  setFill(els.tempo);
}

function showHistory() {
  els.undo.disabled = !history.undo.length;
  els.redo.disabled = !history.redo.length;
}

function makeBeatLeds() {
  if (beatLeds.length === pattern.beats) return;
  els.beatLeds.replaceChildren();
  beatLeds.length = 0;
  for (let i = 0; i < pattern.beats; i++) beatLeds.push(els.beatLeds.appendChild(document.createElement('span')));
}

/** Lights the slider groove up to its value. */
function setFill(input) {
  const pct = ((input.value - input.min) / (input.max - input.min)) * 100;
  input.style.setProperty('--pct', `${pct}%`);
}

// ---------------------------------------------------------------- rhythms

/** Every rhythm to pick, in the order the panel shows them: the presets by genre, then the saved ones by name. */
function rhythmList() {
  const list = [];
  for (const genre of GENRES) {
    for (const p of PRESETS.filter((x) => x.genre === genre.id)) list.push({ value: `p:${p.id}`, name: p.name, tempo: p.tempo, group: genre.name });
  }
  for (const item of [...library].sort((a, b) => a.name.localeCompare(b.name))) {
    list.push({ value: `u:${item.id}`, name: item.name, tempo: item.tempo, group: 'Saved' });
  }
  return list;
}

/** Fills the rhythm panel: a column per group, the current rhythm lit. */
function fillRhythms() {
  const panel = els.rhythmPanel;
  panel.replaceChildren();
  let column = null;
  for (const r of rhythmList()) {
    if (column?.dataset.group !== r.group) {
      column = panel.appendChild(document.createElement('section'));
      column.className = 'rhythm-group';
      column.dataset.group = r.group;
      const heading = column.appendChild(document.createElement('h2'));
      heading.className = 'module-label';
      heading.textContent = r.group;
    }
    const item = column.appendChild(document.createElement('button'));
    item.type = 'button';
    item.className = 'rhythm-item';
    item.value = r.value;
    item.title = `${r.name}, ${r.tempo} BPM`;
    if (r.value === state.source) item.setAttribute('aria-current', 'true');
    const name = document.createElement('span');
    name.className = 'rhythm-name';
    name.textContent = r.name;
    const tempo = document.createElement('span');
    tempo.className = 'rhythm-tempo';
    tempo.textContent = r.tempo;
    item.append(name, tempo);
  }
}

/** Puts the open rhythm panel under the picker, inside the window. */
function placeRhythmPanel() {
  const panel = els.rhythmPanel;
  const anchor = els.rhythmModule.getBoundingClientRect();
  const margin = 16;
  // Its width depends on the room to its right, so measure it at the window's left edge first.
  panel.style.left = `${scrollX + margin}px`;
  const left = Math.min(anchor.left, document.documentElement.clientWidth - panel.offsetWidth - margin);
  panel.style.left = `${scrollX + Math.max(margin, left)}px`;
  panel.style.top = `${scrollY + anchor.bottom + 8}px`;
  panel.style.maxHeight = `${Math.max(200, innerHeight - anchor.bottom - 8 - margin)}px`;
}

/** Loads the rhythm `by` places on in the panel's order, wrapping around. */
function stepRhythm(by) {
  const list = rhythmList();
  const i = list.findIndex((r) => r.value === state.source);
  const next = i < 0 ? (by > 0 ? 0 : list.length - 1) : (i + by + list.length) % list.length;
  loadRhythm(list[next].value);
}

function showSource() {
  // Marked while the pattern doesn't match a stored one; picking a rhythm then always loads it.
  const match = !state.dirty && rhythmList().some((r) => r.value === state.source);
  els.rhythmName.textContent = match ? pattern.name : `${pattern.name} *`;
  els.rhythm.title = state.dirty ? 'Changed since it was loaded' : 'Pick a rhythm';
  els.save.classList.toggle('pending', state.dirty);
  els.remove.disabled = !state.source.startsWith('u:');
}

function loadRhythm(value) {
  let next = null;
  if (value.startsWith('p:')) {
    const preset = PRESETS.find((p) => `p:${p.id}` === value);
    if (preset) next = fromPreset(preset);
  } else if (value.startsWith('u:')) {
    const item = library.find((x) => `u:${x.id}` === value);
    if (item) next = deserialize(item);
  }
  if (!next) return;
  remember(snapshot());
  const spb = stepsPerBar(pattern);
  pattern = next;
  state.source = value;
  state.dirty = false;
  state.bar = 0;
  useKit();
  afterChange(spb);
}

async function saveRhythm() {
  const current = library.find((x) => `u:${x.id}` === state.source);
  const name = (await ask({ text: 'Save rhythm as', value: current?.name ?? pattern.name, ok: 'Save' }))?.trim();
  if (!name) return;
  let item = library.find((x) => x.name.toLowerCase() === name.toLowerCase());
  if (!item) {
    item = { id: Date.now().toString(36) };
    library.push(item);
  }
  pattern.name = name;
  Object.assign(item, serialize(pattern));
  store(KEYS.library, library);
  state.source = `u:${item.id}`;
  state.dirty = false;
  showSource();
  persist();
  toast(`Saved ${name}`);
}

async function removeRhythm() {
  const item = library.find((x) => `u:${x.id}` === state.source);
  if (!item || !(await ask({ text: `Delete ${item.name}?`, ok: 'Delete' }))) return;
  library = library.filter((x) => x !== item);
  store(KEYS.library, library);
  state.source = '';
  state.dirty = true;
  showSource();
  persist();
  toast(`Deleted ${item.name}`);
}

/** A small modal: resolves to the typed text (with `value`), true (without), or null if cancelled. */
function ask({ text, value, ok = 'OK' }) {
  const d = els.dialog;
  els.dialogText.textContent = text;
  els.dialogOk.textContent = ok;
  const input = value != null;
  els.dialogInput.hidden = !input;
  els.dialogInput.value = value ?? '';
  d.returnValue = '';
  d.showModal();
  if (input) els.dialogInput.select();
  else els.dialogOk.focus();
  return new Promise((resolve) => {
    d.addEventListener('close', () => {
      if (d.returnValue !== 'ok') resolve(null);
      else resolve(input ? els.dialogInput.value : true);
    }, { once: true });
  });
}

function exportMidi() {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([toMidi(pattern)], { type: 'audio/midi' }));
  a.download = `${pattern.name.replace(/[\\/:*?"<>|]+/g, '').trim() || 'rhythm'}.mid`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

let toastTimer = 0;
function toast(message) {
  els.toast.textContent = message;
  els.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (els.toast.hidden = true), 1800);
}

// ---------------------------------------------------------------- transport

let raf = 0;
let wakeLock = null;
let starting = false;

async function play() {
  if (starting || seq.playing) return;
  starting = true;
  engine.start(); // inside the click, so the browser lets it make sound
  try {
    await useKit();
    seq.start();
  } catch {
    return; // useKit() has said why
  } finally {
    starting = false;
  }
  els.play.textContent = 'Stop';
  els.play.classList.add('running');
  els.readout.classList.remove('idle');
  raf = requestAnimationFrame(frame);
  keepAwake(true);
}

function stop() {
  seq.stop();
  cancelAnimationFrame(raf);
  els.play.textContent = 'Play';
  els.play.classList.remove('running');
  els.readout.classList.add('idle');
  els.pos.textContent = 'Bar -';
  beatLeds.forEach((led) => (led.className = ''));
  grid.setPlayhead(-1);
  keepAwake(false);
}

const toggle = () => (seq.playing ? stop() : play());

/** Shows each step as it's heard: playhead, lit kit pieces, beat LEDs. */
function frame() {
  for (const ev of seq.due(engine.heardTime())) showStep(ev);
  raf = requestAnimationFrame(frame);
}

function showStep({ step, hits }) {
  const spb = stepsPerBar(pattern);
  if (step >= spb * pattern.bars) return; // from before the pattern got shorter
  const bar = Math.floor(step / spb);
  const s = step % spb;
  grid.setPlayhead(step);
  grid.flash(step, hits);
  for (const [id, level] of hits) kitView.flash(id, level);
  if (s % pattern.div === 0) {
    const beat = s / pattern.div;
    beatLeds.forEach((led, i) => (led.className = i === beat ? (beat === 0 ? 'on warn' : 'on good') : ''));
    els.pos.textContent = `Bar ${bar + 1}/${pattern.bars}`;
    els.brandDot.animate([{ transform: 'scale(1.5)', opacity: 1 }, { transform: 'scale(1)', opacity: 0.85 }], { duration: 200, easing: 'ease-out' });
  }
}

async function keepAwake(on) {
  try {
    if (on && !wakeLock) wakeLock = await navigator.wakeLock?.request('screen');
    if (!on && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch {
    wakeLock = null;
  }
}

document.addEventListener('visibilitychange', () => {
  // The browser drops the wake lock when the page is hidden; take it again on return.
  if (document.visibilityState === 'visible' && seq.playing) {
    wakeLock = null;
    keepAwake(true);
  }
});

let taps = [];
function tap() {
  const now = performance.now();
  if (taps.length && now - taps[taps.length - 1] > 2000) taps = [];
  taps.push(now);
  if (taps.length > 6) taps.shift();
  if (taps.length < 2) return;
  const beat = (taps[taps.length - 1] - taps[0]) / (taps.length - 1);
  setTempo(Math.round(60000 / beat));
}

function setTempo(bpm) {
  const tempo = Math.min(TEMPO.max, Math.max(TEMPO.min, bpm));
  if (tempo === pattern.tempo) return;
  pattern.tempo = tempo;
  state.dirty = true;
  showTempo();
  showSource();
  persist();
}

function selectBar(bar) {
  state.bar = bar;
  els.selBar.textContent = bar + 1;
  grid.selectBar(bar);
}

// ---------------------------------------------------------------- controls

function makeToggles(container, name, items) {
  for (const { value, label } of items) {
    const l = document.createElement('label');
    l.className = 'btn toggle';
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = name;
    input.value = value;
    l.append(input, label);
    container.append(l);
  }
}

makeToggles(els.kits, 'kit', KIT_IDS.map((id) => ({ value: id, label: KITS[id].name })));
for (const b of BEATS) els.meter.add(new Option(`${b}/4`, b));
for (const { div, label } of DIVISIONS) els.division.add(new Option(label, div));

els.play.addEventListener('click', toggle);
els.tap.addEventListener('click', tap);

els.tempo.addEventListener('input', () => setTempo(Number(els.tempo.value)));

els.kits.addEventListener('change', (e) => {
  pattern.kit = e.target.value;
  state.dirty = true;
  useKit();
  grid.setLabels(label);
  showSource();
  persist();
});

els.prevRhythm.addEventListener('click', () => stepRhythm(-1));
els.nextRhythm.addEventListener('click', () => stepRhythm(1));

// The panel can only be measured once it's open, so it stays invisible until it's placed.
els.rhythmPanel.addEventListener('beforetoggle', (e) => {
  if (e.newState !== 'open') return;
  fillRhythms();
  els.rhythmPanel.classList.add('placing');
});
els.rhythmPanel.addEventListener('toggle', (e) => {
  if (e.newState !== 'open') return;
  placeRhythmPanel();
  els.rhythmPanel.classList.remove('placing');
  (els.rhythmPanel.querySelector('[aria-current]') ?? els.rhythmPanel.querySelector('button'))?.focus();
});
els.rhythmPanel.addEventListener('click', (e) => {
  const item = e.target.closest('.rhythm-item');
  if (!item) return;
  els.rhythmPanel.hidePopover();
  loadRhythm(item.value);
});
els.rhythmPanel.addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
  e.preventDefault();
  const items = [...els.rhythmPanel.querySelectorAll('.rhythm-item')];
  const at = items.indexOf(document.activeElement);
  const i = at < 0 ? 0 : (at + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
  items[i].focus();
});
window.addEventListener('resize', () => els.rhythmPanel.matches(':popover-open') && placeRhythmPanel());
els.save.addEventListener('click', saveRhythm);
els.remove.addEventListener('click', removeRhythm);

els.volume.addEventListener('input', () => {
  settings.volume = Number(els.volume.value);
  els.volumeValue.textContent = `${settings.volume}%`;
  setFill(els.volume);
  engine.setVolume(settings.volume / 100);
  persist();
});

els.reverb.addEventListener('input', () => {
  settings.reverb = Number(els.reverb.value);
  els.reverbValue.textContent = `${settings.reverb}%`;
  setFill(els.reverb);
  engine.setReverb(settings.reverb / 100);
  persist();
});

els.meter.addEventListener('change', () => edit((p) => setBeats(p, Number(els.meter.value))));
els.division.addEventListener('change', () => edit((p) => setDivision(p, Number(els.division.value))));
els.barsDown.addEventListener('click', () => edit((p) => setBars(p, Math.max(1, p.bars - 1))));
els.barsUp.addEventListener('click', () => edit((p) => setBars(p, Math.min(MAX_BARS, p.bars + 1))));

els.swing.addEventListener('input', () => {
  pattern.swing = Number(els.swing.value);
  state.dirty = true;
  els.swingValue.textContent = `${pattern.swing}%`;
  setFill(els.swing);
  showSource();
  persist();
});


els.clearBar.addEventListener('click', () => edit((p) => clearBar(p, state.bar)));
els.undo.addEventListener('click', undo);
els.redo.addEventListener('click', redo);
els.midi.addEventListener('click', exportMidi);

// ---------------------------------------------------------------- kit view size

// The splitter between the kit view and the grid sizes the kit view: its width side by side,
// its height on narrow screens, where it sits above the grid. Dragged below half the smallest
// size it closes to a bar, and pressing the bar opens it again.
const KIT_MIN = { width: 310, height: 160 }; // 310: room for the kit picker
const GRID_MIN = 340; // the width the grid keeps, splitter included (as in styles.css)
const narrow = matchMedia('(max-width: 960px)');
const kitDim = () => (narrow.matches ? 'height' : 'width');
const sizeKey = { width: 'kitWidth', height: 'kitHeight' };

function kitRange(dim) {
  const max = dim === 'width' ? els.stage.clientWidth - GRID_MIN : innerHeight * 0.75;
  return [KIT_MIN[dim], Math.max(KIT_MIN[dim], Math.round(max))];
}

const kitSize = (dim) => (settings.showKit ? Math.round(els.kitScreen.getBoundingClientRect()[dim]) : 0);

function showKitView() {
  const open = settings.showKit;
  const dim = kitDim();
  els.stage.classList.toggle('no-kit', !open);
  for (const [name, px] of [['--kit-w', settings.kitWidth], ['--kit-h', settings.kitHeight]]) {
    if (px) els.stage.style.setProperty(name, `${px}px`);
    else els.stage.style.removeProperty(name);
  }
  // The kit picker sits under the kit; while the view is closed it waits in the Sound group.
  if (open && els.kitPicker.parentNode !== els.kitScreen) els.kitScreen.append(els.kitPicker);
  else if (!open && els.kitPicker.parentNode !== els.sound) els.sound.insertBefore(els.kitPicker, els.volumeModule);

  const s = els.splitter;
  s.setAttribute('aria-orientation', dim === 'width' ? 'vertical' : 'horizontal');
  s.setAttribute('aria-valuenow', open ? Math.round((100 * kitSize(dim)) / kitRange(dim)[1]) : 0);
  if (open) s.removeAttribute('aria-valuetext');
  else s.setAttribute('aria-valuetext', 'Closed');
  s.title = open ? 'Drag to size the kit view, double-click to close it' : 'Show the drum kit';
}

function openKit(open) {
  settings.showKit = open;
  showKitView();
  persist();
}

/** Sizes the kit view along `dim`, within its range; too small closes it. */
function sizeKit(dim, size) {
  const [min, max] = kitRange(dim);
  settings.showKit = size >= min / 2;
  if (settings.showKit) settings[sizeKey[dim]] = Math.min(max, Math.max(min, Math.round(size)));
  showKitView();
  persist();
}

els.splitter.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  e.preventDefault();
  const dim = kitDim();
  const at = (ev) => (dim === 'width' ? ev.clientX : ev.clientY);
  const start = at(e);
  const from = kitSize(dim);
  const before = settings[sizeKey[dim]];
  let moved = false;
  const move = (ev) => {
    if (!moved && Math.abs(at(ev) - start) < 4) return; // a press, not a drag yet
    moved = true;
    els.splitter.classList.add('dragging');
    sizeKit(dim, from + at(ev) - start);
  };
  const end = (ev) => {
    els.splitter.removeEventListener('pointermove', move);
    els.splitter.removeEventListener('pointerup', end);
    els.splitter.removeEventListener('pointercancel', end);
    els.splitter.classList.remove('dragging');
    if (!moved && ev.type === 'pointerup' && !settings.showKit) openKit(true);
    // Dragged shut: it opens again at the size it had.
    else if (moved && !settings.showKit) {
      settings[sizeKey[dim]] = before;
      showKitView();
      persist();
    }
  };
  els.splitter.setPointerCapture(e.pointerId);
  els.splitter.addEventListener('pointermove', move);
  els.splitter.addEventListener('pointerup', end);
  els.splitter.addEventListener('pointercancel', end);
});

// Opening the bar moves the splitter away, so a double-click here always starts on it open.
els.splitter.addEventListener('dblclick', () => settings.showKit && openKit(false));

els.splitter.addEventListener('keydown', (e) => {
  const dim = kitDim();
  const dir = (dim === 'width' ? { ArrowLeft: -1, ArrowRight: 1 } : { ArrowUp: -1, ArrowDown: 1 })[e.key];
  if (e.key === 'Enter') openKit(!settings.showKit);
  else if (e.key === 'Home') openKit(false);
  else if (e.key === 'End') sizeKit(dim, kitRange(dim)[1]);
  else if (dir && !settings.showKit) dir > 0 && openKit(true);
  else if (dir) {
    const size = kitSize(dim) + dir * (e.shiftKey ? 80 : 20);
    if (size < kitRange(dim)[0]) openKit(false);
    else sizeKit(dim, size);
  } else return;
  e.preventDefault();
});

narrow.addEventListener('change', showKitView);

document.addEventListener('keydown', (e) => {
  if (els.dialog.open || e.target.matches('input[type="text"], select, textarea')) return;
  const mod = e.metaKey || e.ctrlKey;
  const key = e.key.toLowerCase();
  if (e.code === 'Space' && !mod) {
    e.preventDefault();
    // A focused button would also take the space as a click.
    if (e.target.closest('button, label')) document.activeElement.blur();
    if (!e.repeat) toggle();
  } else if (mod && key === 'z') {
    e.preventDefault();
    e.shiftKey ? redo() : undo();
  } else if (mod && key === 'y') {
    e.preventDefault();
    redo();
  }
});

document.querySelector('.brand').title = `vdrummer ${VERSION}`;

// ---------------------------------------------------------------- start up

els.volume.value = settings.volume;
els.volumeValue.textContent = `${settings.volume}%`;
setFill(els.volume);
showKitView();
els.reverb.value = settings.reverb;
els.reverbValue.textContent = `${settings.reverb}%`;
setFill(els.reverb);
render();
useKit();
// Load the other kits in the background, so switching is instant (and they work offline).
setTimeout(() => KIT_IDS.forEach((id) => engine.prepare(id).catch(() => {})), 3000);
// Cells are sized once the pixel font (and so the row labels) has loaded.
document.fonts?.ready.then(() => grid.fit());

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
