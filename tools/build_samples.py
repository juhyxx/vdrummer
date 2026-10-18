"""Builds the drum samples in samples/ from freely licensed sample libraries.

    python3 tools/build_samples.py [cache-dir]

Downloads the sources into cache-dir (default .cache/), then writes one 16-bit mono WAV per
instrument and kit: samples/<kit>/<instrument>.wav, plus <instrument>-soft.wav, a softly
played hit for ghost notes, where the library has velocity layers. Each sample is trimmed to
start on the hit, cut once it has decayed (with a fade), and scaled to a set peak, so kits
are balanced alike; the soft hit too, as the player sets loudness and the soft layer only
changes the tone. Standard library only. See samples/CREDITS.md for the sources' licenses.
"""
import math, os, re, shutil, subprocess, sys, urllib.request, zipfile

sys.path.insert(0, os.path.dirname(__file__))
import remotezip, wavio  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, ".cache")
OUT = os.path.join(ROOT, "samples")
RATE = 44100

AVL = "https://www.bandshed.net/sounds/AVLDrumkits_SFZ/{}.zip"
AASIMONSTER = "https://drumgizmo.org/kits/Aasimonster/aasimonster2_1.zip"
TR808 = "https://raw.githubusercontent.com/fluid-music/open-drums/475cc3314fe06f6d1af02e9790ad9707c1f2b26b/tr-808/TR808WAV/{}"
# Kingsley's Drum Kit by captain k man on Freesound (CC0). Only the MP3 previews can be
# fetched without an account; decoding them needs afconvert (macOS) or ffmpeg.
FREESOUND = "https://cdn.freesound.org/previews/{}/{}_2272910-hq.mp3"

# Peak level of each instrument's (hard) sample, and the longest it may ring, in seconds.
LEVEL = {"kick": 0.95, "kick2": 0.95, "snare": 0.9, "rim": 0.6, "tom1": 0.8, "tom2": 0.8, "tom3": 0.85,
         "hhc": 0.45, "hho": 0.45, "hhp": 0.35, "ride": 0.45, "crash": 0.55}
LONGEST = {"kick": 0.9, "kick2": 0.9, "snare": 0.9, "rim": 0.4, "tom1": 1.2, "tom2": 1.4, "tom3": 1.6,
           "hhc": 0.5, "hho": 1.2, "hhp": 0.5, "ride": 2.5, "crash": 3.0}
SEMITONE = 2 ** (1 / 12)

# AVL Drumkits (SFZ): instrument → (sample name prefix, pitch ratio). Each sample has five
# velocity layers, -1 (softest) … -5; the hard sample is -5, the soft one -2.
AVL_KITS = {
    "rock": ("RED_ZEPPELIN_2023_repack", {
        "kick": "36-Ludwig-26-Kick", "snare": "38-Ludwig-14-Snare", "rim": "37-Ludwig-14-SideStick",
        "tom1": ("45-Ludwig-14-Tom", SEMITONE ** 3), "tom2": "45-Ludwig-14-Tom", "tom3": "41-Ludwig-16-FloorTom",
        "hhc": "42-Sabian-13-HatClosed", "hho": "46-Sabian-13-HatSemi", "hhp": "44-Sabian-13-HatPedal",
        "ride": "51-Zildjian-24-Ride", "crash": "49-Zildjian-20-Crash",
    }),
    "jazz": ("BLONDE_BOP_SFZ", {  # the snare is played with brushes, from BRUSH_SNARE
        "kick": "36-TAMA-18-Kick", "rim": "37-TAMA-13-SideStick",
        "tom1": "45-TAMA-10-Tom", "tom2": ("41-TAMA-14-FloorTom", SEMITONE ** 4), "tom3": "41-TAMA-14-FloorTom",
        "hhc": "42-Zildjian-13-HatClosed", "hho": "46-Zildjian-13-HatSemi", "hhp": "44-Zildjian-13-HatPedal",
        "ride": "51-SabianAAX-20-RideTip", "crash": "49-Paiste2002-16-Crash",
    }),
}
AVL_SOFT = {"kick", "snare", "tom1", "tom2", "tom3", "hhc"}

# Freesound sound ids of the brushed snare: a hard hit, and a normal one for ghost notes.
BRUSH_SNARE = {"": 125021, "-soft": 125022}

# The Aasimonster (DrumGizmo): every hit is recorded on 16 mics. instrument → (kit instrument,
# {mic: gain}). Overhead and room mics are high-passed so they add air, not boom. "soft" picks
# a quieter hit for ghost notes (a fraction of the loudest hit's power).
OVERHEADS = {"OH L": 0.3, "OH R": 0.3, "Amb L": 0.2, "Amb R": 0.2}
AASI_KIT = {
    "kick": ("kick_r", {"Kick R": 1, "Alesis": 0.3, "OH L": 0.1, "OH R": 0.1}),
    "kick2": ("kick_l", {"Kick L": 1, "Alesis": 0.3, "OH L": 0.1, "OH R": 0.1}),
    "snare": ("snare_on_center", {"Snare top": 1, "Snare bottom": 0.4, **OVERHEADS}),
    "rim": ("snare_rim_shot", {"Snare top": 1, "Snare bottom": 0.3, **OVERHEADS}),
    "tom1": ("tom_1", {"Tom1": 1, **OVERHEADS}),
    "tom2": ("tom_3", {"Tom3": 1, **OVERHEADS}),
    "tom3": ("tom_4", {"Tom4": 1, **OVERHEADS}),
    "hhc": ("hihat_closed1", {"Hihat": 1, "OH L": 0.3, "OH R": 0.3}),
    "hho": ("hihat_open", {"Hihat": 1, "OH L": 0.3, "OH R": 0.3}),
    "hhp": ("hihat_closed3", {"Hihat": 1, "OH L": 0.2, "OH R": 0.2}),
    "ride": ("ride", {"Ride": 1, "OH L": 0.4, "OH R": 0.4}),
    "crash": ("crash1", {"OH L": 1, "OH R": 1, "Amb L": 0.4, "Amb R": 0.4}),
}
AASI_SOFT = {"kick": 0.12, "kick2": 0.12, "snare": 0.06, "tom1": 0.12, "tom2": 0.12, "tom3": 0.12, "hhc": 0.12}
AASI_HARD = {"hhp": 0.15}  # the pedal is a light closed-hat hit, not the loudest one
HIGHPASS = {"OH L", "OH R", "Amb L", "Amb R"}

# TR-808 (Michael Fischer's sample set). Names give knob positions, e.g. BD2575 = tone 2.5, decay 7.5.
TR808_KIT = {
    "kick": "BD/BD2575.WAV", "snare": "SD/SD5075.WAV", "rim": "CP/CP.WAV",
    "tom1": "HT/HT50.WAV", "tom2": "MT/MT50.WAV", "tom3": "LT/LT50.WAV",
    "hhc": "CH/CH.WAV", "hho": "OH/OH25.WAV", "hhp": "CH/CH.WAV",
    "ride": "CY/CY2525.WAV", "crash": "CY/CY5075.WAV",
}


# ---------------------------------------------------------------- signal helpers

def mono(channels):
    n = len(channels)
    return [sum(c[i] for c in channels) / n for i in range(len(channels[0]))] if n > 1 else list(channels[0])


def highpass(x, freq, rate=RATE):
    """Second-order Butterworth high-pass."""
    w = 2 * math.pi * freq / rate
    alpha = math.sin(w) / math.sqrt(2)
    cw = math.cos(w)
    a0 = 1 + alpha
    b0, b1, b2 = (1 + cw) / 2 / a0, -(1 + cw) / a0, (1 + cw) / 2 / a0
    a1, a2 = -2 * cw / a0, (1 - alpha) / a0
    y, x1, x2, y1, y2 = [], 0.0, 0.0, 0.0, 0.0
    for v in x:
        out = b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
        x2, x1, y2, y1 = x1, v, y1, out
        y.append(out)
    return y


def onset(x, fraction=0.1):
    peak = max(map(abs, x))
    return next((i for i, v in enumerate(x) if abs(v) >= peak * fraction), 0) if peak else 0


def shift(x, n):
    """Delays (n > 0) or advances (n < 0) a signal, keeping its length."""
    return ([0.0] * n + x[: len(x) - n]) if n >= 0 else (x[-n:] + [0.0] * -n)


def repitch(x, ratio):
    """Plays the sample `ratio` times faster (and higher), by linear interpolation."""
    out = []
    pos = 0.0
    while pos < len(x) - 1:
        i = int(pos)
        f = pos - i
        out.append(x[i] * (1 - f) + x[i + 1] * f)
        pos += ratio
    return out


def finish(x, name):
    """Starts the sample just before the hit, ends it when it has died away (fading the tail)
    and scales it to the instrument's peak level."""
    peak = max(map(abs, x))
    hit = onset(x, 0.05)
    start = max(0, hit - int(0.002 * RATE))
    floor = peak * 10 ** (-54 / 20)
    end = max(i for i, v in enumerate(x) if abs(v) >= floor) + 1
    end = min(end, start + int(LONGEST[name] * RATE))
    gain = LEVEL[name] / max(map(abs, x[start:end]))
    y = [v * gain for v in x[start:end]]
    fade = min(len(y) // 3, int(0.4 * RATE))
    for i in range(fade):
        y[len(y) - fade + i] *= math.cos(i / fade * math.pi / 2) ** 2
    for i in range(hit - start):  # the moment before the hit fades in
        y[i] *= i / (hit - start)
    return y


def save(kit, name, hard, soft=None):
    os.makedirs(os.path.join(OUT, kit), exist_ok=True)
    for suffix, x in (("", hard), ("-soft", soft)):
        if x is None:
            continue
        y = finish(x, name)
        wavio.write_mono16(os.path.join(OUT, kit, f"{name}{suffix}.wav"), RATE, y)
        print(f"  {kit}/{name}{suffix}.wav  {len(y) / RATE:.2f} s  peak {max(map(abs, y)):.2f}")


def fetch(url, path):
    if not os.path.exists(path):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        print("download", url)
        urllib.request.urlretrieve(url, path + ".part")
        os.rename(path + ".part", path)
    return path


def load(source):
    rate, ch = wavio.read(source)
    assert rate == RATE, f"{rate} Hz"
    return ch


# ---------------------------------------------------------------- kits

def build_avl(kit, archive, pieces):
    z = zipfile.ZipFile(fetch(AVL.format(archive), os.path.join(CACHE, f"{archive}.zip")))
    names = {os.path.basename(n): n for n in z.namelist()}
    for name, spec in pieces.items():
        prefix, ratio = spec if isinstance(spec, tuple) else (spec, 1)
        layer = lambda v: mono(load(z.read(names[f"{prefix}-{v}.wav"])))  # noqa: E731
        hard, soft = layer(5), layer(2) if name in AVL_SOFT else None
        if ratio != 1:
            hard, soft = repitch(hard, ratio), soft and repitch(soft, ratio)
        save(kit, name, hard, soft)


def build_aasimonster():
    z = remotezip.open_remote(AASIMONSTER)
    for name, (inst, mics) in AASI_KIT.items():
        xml = z.read(f"aasimonster2/{inst}/{inst}.xml").decode()
        hits = [(float(p), f) for p, f in re.findall(r'<sample name="[^"]+" power="([^"]+)">\s*<audiofile channel="[^"]+" file="([^"]+)"', xml)]
        channels = dict(re.findall(r'<audiofile channel="([^"]+)" file="[^"]+" filechannel="(\d+)"', xml.split("</sample>")[0]))
        loudest = max(p for p, _ in hits)
        pick = lambda frac: min(hits, key=lambda h: abs(h[0] - loudest * frac))[1]  # noqa: E731
        hard = mix_hit(z, inst, pick(AASI_HARD.get(name, 1)), channels, mics)
        soft = mix_hit(z, inst, pick(AASI_SOFT[name]), channels, mics) if name in AASI_SOFT else None
        save("metal", name, hard, soft)


def mix_hit(z, inst, file, channels, mics):
    """Mixes one multi-mic hit down to mono. The kit was recorded through two audio interfaces
    whose clocks are ~20 ms apart, so each mic is first lined up on the main (first) mic."""
    path = os.path.join(CACHE, "aasimonster", inst, os.path.basename(file))
    if not os.path.exists(path):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        data = z.read(f"aasimonster2/{inst}/{file}")
        with open(path, "wb") as f:
            f.write(data)
    ch = load(path)
    main, *_ = mics
    lead = onset(list(ch[int(channels[main]) - 1]))
    out = None
    for mic, g in mics.items():
        x = list(ch[int(channels[mic]) - 1])
        if mic in HIGHPASS:
            x = highpass(x, 180)
        # line up on the main mic; distant mics keep a natural 2 ms of air
        x = shift(x, lead - onset(x) + (int(0.002 * RATE) if mic in HIGHPASS else 0))
        if mic == "Snare bottom" and sum(a * b for a, b in zip(x[lead:lead + 400], out[lead:lead + 400])) < 0:
            g = -g  # the bottom mic faces the other way
        out = [v * g for v in x] if out is None else [a + v * g for a, v in zip(out, x)]
    return out


def brush_snare():
    """The brushed snare hits, decoded from Freesound's MP3 previews: (suffix, samples)."""
    for suffix, sound in BRUSH_SNARE.items():
        mp3 = fetch(FREESOUND.format(sound // 1000, sound), os.path.join(CACHE, "freesound", f"{sound}.mp3"))
        wav = mp3[:-4] + ".wav"
        if not os.path.exists(wav):
            if shutil.which("afconvert"):
                subprocess.run(["afconvert", "-f", "WAVE", "-d", "LEI16", mp3, wav], check=True)
            else:
                subprocess.run(["ffmpeg", "-loglevel", "error", "-i", mp3, "-ac", "1", "-ar", str(RATE), wav], check=True)
        yield suffix, mono(load(wav))


def build_808():
    for name, file in TR808_KIT.items():
        path = fetch(TR808.format(file), os.path.join(CACHE, "tr808", file))
        save("electronic", name, mono(load(path)))


if __name__ == "__main__":
    for kit, (archive, pieces) in AVL_KITS.items():
        print(kit)
        build_avl(kit, archive, pieces)
    brushes = dict(brush_snare())
    save("jazz", "snare", brushes[""], brushes["-soft"])
    print("metal")
    build_aasimonster()
    print("electronic")
    build_808()
