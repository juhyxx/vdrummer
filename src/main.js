import { DrumEngine } from './audio.js';
import { Grid } from './grid.js';
import { KITS, KIT_IDS, instrumentLabel } from './kits.js';
import { KitView } from './kitview.js';
import { toMidi } from './midi.js';
import {
  BEATS, DIVISIONS, MAX_BARS, TEMPO,
  clearBar, copyBarToAll, deserialize, fromPreset, serialize, setBars, setBeats, setDivision, stepsPerBar,
} from './pattern.js';
import { GENRES, PRESETS } from './presets.js';
import { Sequencer } from './sequencer.js';
import { VERSION } from './version.js';

const KEYS = { settings: 'vdrummer.settings', pattern: 'vdrummer.pattern', library: 'vdrummer.library' };
const DEFAULTS = { volume: 80 };
const UNDO_LIMIT = 100;

const $ = (id) => document.getElementById(id);
const els = {
  play: $('play'),
  tempo: $('tempo'),
  tempoValue: $('tempoValue'),
  tap: $('tap'),
  kits: $('kits'),
  rhythm: $('rhythm'),
  save: $('save'),
  remove: $('remove'),
  volume: $('volume'),
  volumeValue: $('volumeValue'),
  meter: $('meter'),
  division: $('division'),
  barsDown: $('barsDown'),
  bars: $('bars'),
  barsUp: $('barsUp'),
  swing: $('swing'),
  swingValue: $('swingValue'),
  selBar: $('selBar'),
  copyBar: $('copyBar'),
  clearBar: $('clearBar'),
  undo: $('undo'),
  redo: $('redo'),
  midi: $('midi'),
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
  bar: 0, // the bar selected for copy / clear
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

function fillRhythms() {
  const sel = els.rhythm;
  sel.replaceChildren();
  // Shown while the pattern doesn't match a stored one; picking a rhythm then always loads it.
  const custom = new Option('', '');
  custom.disabled = true;
  custom.hidden = true;
  sel.add(custom);
  for (const genre of GENRES) {
    const group = document.createElement('optgroup');
    group.label = genre.name;
    for (const p of PRESETS.filter((x) => x.genre === genre.id)) group.append(new Option(p.name, `p:${p.id}`));
    sel.append(group);
  }
  if (library.length) {
    const group = document.createElement('optgroup');
    group.label = 'Saved';
    for (const item of [...library].sort((a, b) => a.name.localeCompare(b.name))) group.append(new Option(item.name, `u:${item.id}`));
    sel.append(group);
  }
}

function showSource() {
  const sel = els.rhythm;
  sel.options[0].textContent = `${pattern.name} *`;
  const match = !state.dirty && [...sel.options].some((o) => o.value === state.source && o.value);
  sel.value = match ? state.source : '';
  sel.title = state.dirty ? 'Changed since it was loaded' : '';
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
  fillRhythms();
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
  fillRhythms();
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

els.rhythm.addEventListener('change', () => loadRhythm(els.rhythm.value));
els.save.addEventListener('click', saveRhythm);
els.remove.addEventListener('click', removeRhythm);

els.volume.addEventListener('input', () => {
  settings.volume = Number(els.volume.value);
  els.volumeValue.textContent = `${settings.volume}%`;
  setFill(els.volume);
  engine.setVolume(settings.volume / 100);
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


els.copyBar.addEventListener('click', () => {
  if (pattern.bars < 2) toast('Add bars first');
  else if (edit((p) => copyBarToAll(p, state.bar))) toast(`Bar ${state.bar + 1} copied to all`);
});
els.clearBar.addEventListener('click', () => edit((p) => clearBar(p, state.bar)));
els.undo.addEventListener('click', undo);
els.redo.addEventListener('click', redo);
els.midi.addEventListener('click', exportMidi);

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
fillRhythms();
render();
useKit();
// Load the other kits in the background, so switching is instant (and they work offline).
setTimeout(() => KIT_IDS.forEach((id) => engine.prepare(id).catch(() => {})), 3000);
// Cells are sized once the pixel font (and so the row labels) has loaded.
document.fonts?.ready.then(() => grid.fit());

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
