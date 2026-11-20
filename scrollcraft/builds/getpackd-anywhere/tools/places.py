#!/usr/bin/env python3
"""Export the hero's cycling places: photo (1920w JPEG) + depth map (960w PNG, near = white).
usage: python places.py <src dir with <slug>.jpg and <slug>-depth.png> <build dir>"""
import sys, os
from PIL import Image, ImageFilter
src, out = sys.argv[1], sys.argv[2]
SLUGS = ["ladakh", "kerala", "rajasthan", "kashmir", "meghalaya", "spiti"]
os.makedirs(os.path.join(out, "assets/places"), exist_ok=True)
os.makedirs(os.path.join(out, "lab"), exist_ok=True)
tiles = []
for s in SLUGS:
    im = Image.open(os.path.join(src, f"{s}.jpg")).convert("RGB")
    d = Image.open(os.path.join(src, f"{s}-depth.png")).convert("L")
    w = 1920; h = round(im.height * w / im.width)
    im.resize((w, h), Image.LANCZOS).save(os.path.join(out, f"assets/places/{s}.jpg"), quality=80, optimize=True, progressive=True)
    # soften the depth a little: hard depth edges tear when the warp is applied
    d.resize((960, round(960 * h / w)), Image.LANCZOS).filter(ImageFilter.GaussianBlur(1.6)).save(os.path.join(out, f"assets/places/{s}-depth.png"), optimize=True)
    t = im.resize((400, round(400 * h / w))); dt = d.resize(t.size).convert("RGB")
    pair = Image.new("RGB", (810, t.height), (30, 30, 30)); pair.paste(t, (0, 0)); pair.paste(dt, (410, 0)); tiles.append(pair)
    print(s, (w, h), os.path.getsize(os.path.join(out, f"assets/places/{s}.jpg")) // 1024, "KB")
H = sum(t.height + 8 for t in tiles)
sheet = Image.new("RGB", (810, H), (30, 30, 30)); y = 0
for t in tiles: sheet.paste(t, (0, y)); y += t.height + 8
sheet.save(os.path.join(out, "lab/places-check.jpg"), quality=78)
