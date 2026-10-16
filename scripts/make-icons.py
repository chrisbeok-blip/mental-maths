#!/usr/bin/env python3
"""Render icons/icon-192.png and icons/icon-512.png: blue rounded square with a white multiplication cross."""
from PIL import Image, ImageDraw

def make(size):
    s = 4  # supersample for smooth edges
    img = Image.new("RGBA", (512 * s, 512 * s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, 512 * s - 1, 512 * s - 1], radius=112 * s, fill=(31, 94, 255, 255))
    w = 56 * s
    d.line([(168 * s, 168 * s), (344 * s, 344 * s)], fill="white", width=w)
    d.line([(344 * s, 168 * s), (168 * s, 344 * s)], fill="white", width=w)
    for (x, y) in [(168, 168), (344, 344), (344, 168), (168, 344)]:
        d.ellipse([(x * s - w // 2, y * s - w // 2), (x * s + w // 2, y * s + w // 2)], fill="white")
    img.resize((size, size), Image.LANCZOS).save(f"icons/icon-{size}.png")

for n in (192, 512):
    make(n)
print("icons written")
