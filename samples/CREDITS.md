# Drum sample credits and licenses

The WAV files in this folder are one-shot drum hits made from the sample libraries below by
[`tools/build_samples.py`](../tools/build_samples.py). For each instrument it picks a hard
hit (and, for acoustic kits, a softly played one, `*-soft.wav`), mixes it down to mono,
trims it to start on the hit and end once it has died away (with a fade), and scales it to
a set peak level. Where a kit had fewer toms than vdrummer's three, one tom was pitched up
(rock: high tom from the 14" tom, +3 semitones; jazz: mid tom from the 14" floor tom,
+4 semitones). The sources are credited below; their licenses apply to the files made from them.

These modified sets are distributed as the **vdrummer Metal, Rock, Jazz and Electro kit
samples**, not under the original libraries' names.

## `metal/`: The Aasimonster (DrumGizmo)

- Source: <https://drumgizmo.org/wiki/doku.php?id=kits:the_aasimonster>, version 2.1
- A death metal kit used by the Danish band DIE to record *Rise of the Rotten*; converted
  to the DrumGizmo 2.0 format by Chaot4.
- License: [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/)
- Changes: each hit's 16 microphone channels were time-aligned (the kit was recorded through
  two audio interfaces) and mixed to mono; the overhead and room mics were high-passed. The
  kit's two bass drums are *Kick* (right) and *Kick 2* (left), its two 16" crashes *Crash*
  and *Crash 2*; the *Rimshot* row uses the snare rim shot. These files are released under
  CC BY 4.0.
- The Aasimonster has no tambourine: `metal/tamb.wav` and `metal/tamb-soft.wav` come from
  AVL Black Pearl (below, CC BY-SA 3.0).

## `rock/` and `jazz/`: AVL Drumkits by Glen MacArthur

- `rock/`: *Red Zeppelin* (Ludwig kit, Sabian and Zildjian cymbals; Crash 2 is its 17"
  Zildjian crash)
- `jazz/`: *Blonde Bop* (TAMA kit, Zildjian, Sabian and Paiste cymbals; Crash 2 is its 17"
  Sabian AAX), all but the snare, which is played with brushes (see below)
- `metal/tamb*.wav`: the tambourine of *Black Pearl*
- Source: <http://www.bandshed.net/avldrumkits/>, SFZ releases (2023)
- License: [Creative Commons Attribution-ShareAlike 3.0](http://creativecommons.org/licenses/by-sa/3.0/),
  with the exception quoted below. These modified files are released under the same license.

The AVL Drumkits readme, kept here as its license asks:

> AVL-Drumkits
> Created by: Glen MacArthur 2015
> Formats: SFZ, SF2, h2drumkit
> Website: http://www.bandshed.net/avldrumkits/
> Contact: info@bandshed.net
>
> License: CC-BY-SA with the following exception:
> The by-sa condition is imperative if you modify the samples themselves or create new
> sample libraries with this licensed product. However, produced music and other
> non-sample-library works can be licensed freely.
>
> Attribution means keeping all authors information and this readme-file or its content in
> the release.
>
> If you want to create a fork, a modified version, of this sample library you have to
> release and distribute it under a different name.
>
> http://creativecommons.org/licenses/by-sa/3.0/

## `jazz/snare.wav`, `jazz/snare-soft.wav`: brushed snare from Kingsley's Drum Kit

- *Snare Hard Hit Brushes* (Freesound sound [125021](https://freesound.org/s/125021/)) and
  *Snare Normal Hit Brushes* ([125022](https://freesound.org/s/125022/)), from the pack
  *Kingsley's Drum Kit* by **captain k man** on [Freesound](https://freesound.org/people/captain%20k%20man/packs/7808/)
- License: [Creative Commons 0](https://creativecommons.org/publicdomain/zero/1.0/) (public domain)
- Made from Freesound's high-quality MP3 previews.

## `electronic/`: Roland TR-808 samples by Michael Fischer

- Recorded by Michael Fischer (Technopolis) from a Roland TR-808, *Roland TR-808 Rhythm
  Composer Sound Sample Set 1.0.0* (1994), distributed "absolutely free" with no licensing
  restrictions.
- Source: [machines.hyperreal.org](http://machines.hyperreal.org/), via
  [fluid-music/open-drums](https://github.com/fluid-music/open-drums/tree/475cc3314fe06f6d1af02e9790ad9707c1f2b26b/tr-808)
- Files used: BD2575 (kick), SD5075 (snare), CP (clap, in the side stick row), HT50, MT50,
  LT50 (toms), CH (closed hat and hat pedal), OH25 (open hat), CY2525 (ride), CY5075 (crash),
  CY7575 (crash 2), MA (maracas, in the tambourine row).
