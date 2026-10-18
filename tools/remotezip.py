"""Read single members of a remote zip with HTTP range requests, without downloading it all."""
import io, sys, urllib.request, zipfile


class RangeFile(io.RawIOBase):
    def __init__(self, url):
        self.url = url
        req = urllib.request.Request(url, method="HEAD")
        self.size = int(urllib.request.urlopen(req).headers["Content-Length"])
        self.pos = 0
        self.cache = {}  # block index -> bytes
        self.block = 1 << 20

    def seekable(self):
        return True

    def readable(self):
        return True

    def tell(self):
        return self.pos

    def seek(self, offset, whence=0):
        self.pos = offset if whence == 0 else self.pos + offset if whence == 1 else self.size + offset
        return self.pos

    def _fetch(self, start, end):
        req = urllib.request.Request(self.url, headers={"Range": f"bytes={start}-{end - 1}"})
        return urllib.request.urlopen(req).read()

    def read(self, n=-1):
        if n < 0:
            n = self.size - self.pos
        n = min(n, self.size - self.pos)
        if n <= 0:
            return b""
        if n > 4 * self.block:  # big read: fetch directly
            data = self._fetch(self.pos, self.pos + n)
        else:
            out = bytearray()
            p, end = self.pos, self.pos + n
            while p < end:
                b = p // self.block
                if b not in self.cache:
                    self.cache[b] = self._fetch(b * self.block, min(self.size, (b + 1) * self.block))
                chunk = self.cache[b]
                off = p - b * self.block
                take = min(end - p, len(chunk) - off)
                out += chunk[off:off + take]
                p += take
            data = bytes(out)
        self.pos += len(data)
        return data

    def readinto(self, b):
        data = self.read(len(b))
        b[:len(data)] = data
        return len(data)


def open_remote(url):
    return zipfile.ZipFile(io.BufferedReader(RangeFile(url), buffer_size=1 << 16))


if __name__ == "__main__":
    z = open_remote(sys.argv[1])
    for i in z.infolist():
        if len(sys.argv) < 3 or any(s in i.filename for s in sys.argv[2:]):
            print(i.filename, i.file_size, i.compress_size)
