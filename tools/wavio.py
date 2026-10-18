"""Minimal WAV reading and writing (PCM 16/24/32-bit and 32-bit float), standard library only."""
import struct
from array import array


def read(path_or_bytes):
    """Returns (sample_rate, channels) where channels is a list of array('f') in −1…1."""
    data = path_or_bytes if isinstance(path_or_bytes, (bytes, bytearray)) else open(path_or_bytes, "rb").read()
    if data[:4] != b"RIFF" or data[8:12] != b"WAVE":
        raise ValueError("not a WAV file")
    pos, fmt, raw = 12, None, None
    while pos + 8 <= len(data):
        cid, size = data[pos:pos + 4], struct.unpack("<I", data[pos + 4:pos + 8])[0]
        body = data[pos + 8:pos + 8 + size]
        if cid == b"fmt ":
            fmt = struct.unpack("<HHIIHH", body[:16])
            if fmt[0] == 0xFFFE:  # WAVE_FORMAT_EXTENSIBLE: the real format is in the sub-format GUID
                fmt = (struct.unpack("<H", body[24:26])[0],) + fmt[1:]
        elif cid == b"data":
            raw = body
        pos += 8 + size + (size & 1)
    tag, nch, rate, _, _, bits = fmt
    if tag == 3 and bits == 32:
        flat = array("f", raw[: len(raw) // 4 * 4])
    elif tag == 1 and bits == 16:
        ints = array("h", raw[: len(raw) // 2 * 2])
        flat = array("f", (v / 32768 for v in ints))
    elif tag == 1 and bits == 24:
        n = len(raw) // 3
        flat = array("f", (int.from_bytes(raw[i * 3:i * 3 + 3], "little", signed=True) / 8388608 for i in range(n)))
    elif tag == 1 and bits == 32:
        ints = array("i", raw[: len(raw) // 4 * 4])
        flat = array("f", (v / 2147483648 for v in ints))
    else:
        raise ValueError(f"unsupported WAV format {tag}/{bits} bit")
    return rate, [flat[c::nch] for c in range(nch)]


def write_mono16(path, rate, samples):
    """Writes 16-bit mono PCM with triangular dither."""
    import random
    rnd = random.Random(1)
    out = array("h", (max(-32768, min(32767, round(v * 32767 + rnd.random() - rnd.random()))) for v in samples))
    raw = out.tobytes()
    with open(path, "wb") as f:
        f.write(b"RIFF" + struct.pack("<I", 36 + len(raw)) + b"WAVE")
        f.write(b"fmt " + struct.pack("<IHHIIHH", 16, 1, 1, rate, rate * 2, 2, 16))
        f.write(b"data" + struct.pack("<I", len(raw)) + raw)
