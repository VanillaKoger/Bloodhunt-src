#!/usr/bin/env python3
"""Draw the home-screen icon with the stdlib only."""
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "public"


def write_png(path: Path, w: int, h: int, rgba: bytes) -> None:
    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    raw = b"".join(b"\x00" + rgba[y * w * 4 : (y + 1) * w * 4] for y in range(h))
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
    path.write_bytes(png)


def draw(size: int) -> bytes:
    buf = bytearray(size * size * 4)

    def put(x: int, y: int, r: int, g: int, b: int, a: int = 255) -> None:
        if x < 0 or y < 0 or x >= size or y >= size:
            return
        i = (y * size + x) * 4
        src_a = a / 255
        dst_a = buf[i + 3] / 255
        out_a = src_a + dst_a * (1 - src_a)
        if out_a <= 0:
            return
        for c, v in enumerate((r, g, b)):
            buf[i + c] = int((v * src_a + buf[i + c] * dst_a * (1 - src_a)) / out_a)
        buf[i + 3] = int(out_a * 255)

    def fill_circle(cx, cy, rad, col) -> None:
        r2 = rad * rad
        for y in range(int(cy - rad), int(cy + rad) + 1):
            for x in range(int(cx - rad), int(cx + rad) + 1):
                if (x - cx) ** 2 + (y - cy) ** 2 <= r2:
                    put(x, y, *col)

    def bat(cx, cy, s, col) -> None:
        # Coarse filled bat: body plus two wings.
        fill_circle(cx, cy, s * 0.22, col)
        for side in (-1, 1):
            for t in range(8):
                ang = 0.4 + t * 0.14
                rad = s * (0.25 + t * 0.08)
                px = cx + side * rad * (0.55 + 0.08 * t)
                py = cy - s * 0.05 + (t - 3) * s * 0.045
                fill_circle(px, py, s * (0.2 - t * 0.012), col)
        fill_circle(cx - s * 0.08, cy - s * 0.28, s * 0.06, col)
        fill_circle(cx + s * 0.08, cy - s * 0.28, s * 0.06, col)

    for y in range(size):
        for x in range(size):
            put(x, y, 8, 4, 12, 255)
    m = size / 2
    fill_circle(m, m, size * 0.46, (226, 180, 74, 255))
    fill_circle(m, m, size * 0.40, (92, 14, 32, 255))
    fill_circle(m, m * 0.92, size * 0.22, (156, 22, 48, 255))
    bat(m, m * 1.02, size * 0.55, (18, 6, 12, 255))
    fill_circle(m - size * 0.06, m * 0.98, size * 0.035, (255, 40, 64, 255))
    fill_circle(m + size * 0.06, m * 0.98, size * 0.035, (255, 40, 64, 255))
    return bytes(buf)


def main() -> None:
    ROOT.mkdir(parents=True, exist_ok=True)
    files = {
        512: "icon-512.png",
        192: "icon-192.png",
        180: "apple-touch-icon.png",
        32: "favicon.png",
    }
    for size, name in files.items():
        write_png(ROOT / name, size, size, draw(size))
        print(name, size)


if __name__ == "__main__":
    main()
