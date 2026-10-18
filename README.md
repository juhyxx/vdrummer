<p align="center"><img src="assets/logo.svg" width="420" alt="vdrummer"></p>

Virtual drummer that runs entirely in the browser. Program a groove on a step grid
(rows are the pieces of the kit, columns are ticks), loop it, and watch it played on a
drum kit seen from above. Installable as a PWA and works offline.

**Live:** <https://juhyxx.github.io/vdrummer/>

## Develop

No dependencies and no build step. Browsers only load ES modules from `http://localhost`
or `https://`, so serve the folder rather than opening the file:

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000> and press **Play** (or Space). Locally the version is
`dev` and the service worker fetches everything from the network first, so edits show
up on reload.

## Deploy and versioning

Every push to `main` runs [`.github/workflows/pages.yml`](.github/workflows/pages.yml),
the same setup as [pitcher](https://github.com/juhyxx/pitcher):

1. Copies the published files to `_site/`.
2. Fails if `sw.js` doesn't list every published file (or lists one that doesn't exist).
3. Stamps the version, the short commit hash: `?v=<hash>` goes on the `styles.css` and
   `src/*.js` URLs in `index.html` and `sw.js` and on the modules' imports of each other,
   and `VERSION` in `sw.js` and `src/version.js` (shown on hover over the logo).
4. Force-pushes the result as a single commit to the `gh-pages` branch.

When adding a file, list it in `FILES` in `sw.js`. The drum samples are the exception:
they're cached as the app loads them, and it loads every kit soon after it starts.

## Samples

The kits are made from freely licensed sample libraries:

| Kit | Source | License |
| --- | --- | --- |
| Metal | [The Aasimonster](https://drumgizmo.org/wiki/doku.php?id=kits:the_aasimonster) (DrumGizmo) | CC BY 4.0 |
| Rock | [AVL Drumkits](http://www.bandshed.net/avldrumkits/) Red Zeppelin, by Glen MacArthur | CC BY-SA 3.0 |
| Jazz | [AVL Drumkits](http://www.bandshed.net/avldrumkits/) Blonde Bop, by Glen MacArthur | CC BY-SA 3.0 |
| Jazz snare (brushes) | Kingsley's Drum Kit by captain k man, on [Freesound](https://freesound.org/people/captain%20k%20man/packs/7808/) | CC0 |
| Electro | Roland TR-808 samples by Michael Fischer, via [open-drums](https://github.com/fluid-music/open-drums) | free, no restrictions |

[`tools/build_samples.py`](tools/build_samples.py) (Python 3, standard library only)
downloads them and writes `samples/`: for each instrument a hard hit and, for acoustic kits, a
soft one, as 16-bit mono WAV trimmed to start on the hit, faded out once it has died away and
scaled to a set peak, so the kits are balanced alike. For the Aasimonster it reads only the
hits it needs out of the 2.3 GB archive, and lines up and mixes the kit's 16 microphones. The
brushed snare comes as MP3 and is decoded with `afconvert` (macOS) or `ffmpeg`. To change a
kit, edit the tables at the top of the script and run:

```sh
python3 tools/build_samples.py
```

Details and the full license notes are in [`samples/CREDITS.md`](samples/CREDITS.md).

## Features

- **Grid**: one row per instrument (crash, ride, open/closed hi-hat, three toms, snare,
  side stick, kick, kick 2, hi-hat pedal), one column per tick. Steps of 1/4, 1/8, 1/8 triplets,
  1/16 or 1/16 triplets; meters from 2/4 to 7/4. Changing the resolution moves every hit
  to the nearest new step.
- **Hits** come in three levels. Each click on a cell steps it through off → ghost (dim,
  with a dot) → hit → accent (bright, with a white core) → off. Drag with the mouse to
  paint the level the first cell got over others. On touch, tap to step a cell and drag
  to scroll.
- **Colours**: every instrument has its own LED colour, by family (cymbals amber, hi-hats
  cyan to blue, toms violet to magenta, snare lime, kicks red), in the grid and on the kit.
- **Bars**: loop 1–16 bars. Click a bar number to select it, then *Copy to all* to fill
  every bar with it (build one bar, then copy), or *Clear*.
- **Kits**: four sets of recorded drums. Metal is a death metal kit with two bass drums (the
  Aasimonster), Rock a Ludwig kit (AVL Red Zeppelin), Jazz a small TAMA bop kit (AVL Blonde
  Bop) with the snare played with brushes, and Electro a Roland TR-808. The other kits have
  one bass drum, so *Kick 2* is a double pedal on it. Ghost notes on the acoustic kits use
  softly played hits, not just quieter ones. A closed hi-hat chokes an open one. The side stick row is a
  rimshot in the Metal kit and a clap in Electro. See [Samples](#samples).
- **Kit view**: the drums from above, each outlined in its colour and lighting up in it as
  it plays (brightest for accents); press a piece to play it (shift-press the hi-hat for an
  open hat). The kit picker sits on top of it. *View: Kit* hides the view (the picker
  moves to the toolbar), and the grid takes the whole width.
- The grid's cells grow to fill its screen, in width and (on wide screens) height.
- **Rhythms**: 31 prepared grooves in four groups, each loading with its genre's kit and
  tempo: rock & pop, metal (with double bass split between the feet), jazz & latin (swing,
  waltz, bossa nova, samba, baião, salsa, cha-cha-chá, songo, Afro-Cuban 6/8) and
  electronic. Save your own under a name; they're kept in `localStorage`, as are the
  pattern being edited and the settings.
- **MIDI export**: *MIDI* downloads the rhythm as a Standard MIDI File, one loop with its
  tempo, meter and swing, on General MIDI drum notes (channel 10), so it plays in any DAW
  or drum plugin. Ghost, normal and accented hits are velocities 40, 90 and 120.
- **Wide stereo**: each piece sits where the drummer hears it, crash far left, ride far
  right, toms sweeping across, and cymbals, toms and snare are widened with a short, darker
  echo on the other side (as overhead mics hear a kit); the kicks stay in the middle. *Width*
  narrows it, down to mono.
- **Reverb** on the whole kit, from dry to a wash (default 30 %). Each kit sits in its own
  room, from a tight one for metal to a longer one for jazz and electro; the tail darkens as
  it decays, and the low end stays dry so the kick keeps its punch.
- Tempo 40–260 BPM with tap tempo, swing for 1/8 and 1/16 grids, undo and redo
  (Ctrl/Cmd+Z, Shift+Ctrl/Cmd+Z).
- Timing runs on the audio clock with a lookahead scheduler driven from a worker, so it
  stays steady in a background tab; the screen shows each step when it's heard.

## Files

- `src/main.js`: UI wiring, storage, undo, transport
- `src/pattern.js`: the pattern model: resolution, meter and bar changes, presets, storage format
- `src/presets.js`: the prepared rhythms
- `src/kits.js`: instruments and the four kits
- `src/audio.js`: sample loading and playback (buses, panning, reverb, hi-hat choke)
- `src/sequencer.js`: lookahead scheduler
- `src/midi.js`: MIDI file export
- `src/grid.js`: the step grid
- `src/kitview.js`: the top view of the kit (SVG)
- `src/version.js`: version (stamped on deploy)
- `samples/`: the drum samples, one folder per kit; credits and licenses in [`samples/CREDITS.md`](samples/CREDITS.md)
- `tools/build_samples.py`: builds `samples/` from the source libraries
- `sw.js`: service worker (offline cache)
- `icons/`, `assets/logo.svg`: app icons and logo
- `fonts/`: [Silkscreen](https://github.com/googlefonts/silkscreen) pixel font, self-hosted for offline use (SIL OFL, see `fonts/OFL.txt`)
