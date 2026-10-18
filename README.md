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

When adding a file, list it in `FILES` in `sw.js`.

## Features

- **Grid**: one row per instrument (crash, ride, open/closed hi-hat, three toms, snare,
  side stick, kick, hi-hat pedal), one column per tick. Steps of 1/4, 1/8, 1/8 triplets,
  1/16 or 1/16 triplets; meters from 2/4 to 7/4. Changing the resolution moves every hit
  to the nearest new step.
- **Hits** come in three levels, picked under *Hit* (or keys 1–3): ghost (dim), normal,
  and accent (amber). Clicking a cell sets it to the current level or clears it if it
  already has that level; drag with the mouse to paint. On touch, tap to set and drag
  to scroll.
- **Bars**: loop 1–16 bars. Click a bar number to select it, then *Copy to all* to fill
  every bar with it (build one bar, then copy), or *Clear*.
- **Kits**: Metal, Rock, Jazz and Electro sound sets. The sounds are synthesised in the
  browser, with no samples to download: each kit is rendered once into buffers by an
  `OfflineAudioContext`, panned as the drummer hears it, with its own room reverb. A
  closed hi-hat chokes an open one. In the Electro kit the side stick row is a clap.
- **Kit view**: the drums from above. Each piece lights up as it plays (amber for accents);
  press a piece to play it (shift-press the hi-hat for an open hat).
- **Rhythms**: 25 prepared grooves in four groups (rock & pop, metal, jazz & latin,
  electronic), each loading with its genre's kit and tempo. Save your own under a name;
  they're kept in `localStorage`, as are the pattern being edited and the settings.
- Tempo 40–260 BPM with tap tempo, swing for 1/8 and 1/16 grids, undo and redo
  (Ctrl/Cmd+Z, Shift+Ctrl/Cmd+Z).
- Timing runs on the audio clock with a lookahead scheduler driven from a worker, so it
  stays steady in a background tab; the screen shows each step when it's heard.

## Files

- `src/main.js`: UI wiring, storage, undo, transport
- `src/pattern.js`: the pattern model: resolution, meter and bar changes, presets, storage format
- `src/presets.js`: the prepared rhythms
- `src/kits.js`: instruments and the four sound sets
- `src/synth.js`: drum synthesis, rendered offline into buffers
- `src/audio.js`: playback engine (buses, panning, reverb, hi-hat choke)
- `src/sequencer.js`: lookahead scheduler
- `src/grid.js`: the step grid
- `src/kitview.js`: the top view of the kit (SVG)
- `src/version.js`: version (stamped on deploy)
- `sw.js`: service worker (offline cache)
- `icons/`, `assets/logo.svg`: app icons and logo
- `fonts/`: [Silkscreen](https://github.com/googlefonts/silkscreen) pixel font, self-hosted for offline use (SIL OFL, see `fonts/OFL.txt`)
