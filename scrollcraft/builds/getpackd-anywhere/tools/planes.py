#!/usr/bin/env python3
"""Split the Pangong photo into compositing planes.

in:  photo.jpg (2400x1600), depth.png (depth-anything-v2-small, near = white)
out: assets/gate-back.jpg   clean plate: flags and posts removed, sky rebuilt
     assets/gate-front.webp genuine alpha cutout of flags + posts
     assets/gate-aux.png    R = back-plate depth (holes filled), G = sky mask, B = front depth
     lab/planes-check.jpg   cutout over magenta and the clean plate, for inspection

usage: python planes.py photo.jpg depth.png <build dir>
"""
import sys, os
import numpy as np
from PIL import Image, ImageFilter

photo, depth_p, out = sys.argv[1:4]
im = np.asarray(Image.open(photo).convert("RGB")).astype(np.float32)
d = np.asarray(Image.open(depth_p).convert("L")).astype(np.float32) / 255.0
H, W = d.shape
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
xn, yn = xx / W, yy / H
r, g, b = im[..., 0], im[..., 1], im[..., 2]

def _box(a, k, axis):
    # running mean of width 2k+1 along one axis, edge-padded
    pad = [(0, 0)] * a.ndim; pad[axis] = (k + 1, k)
    c = np.cumsum(np.pad(a, pad, mode="edge"), axis=axis, dtype=np.float64)
    n = a.shape[axis]
    hi = np.take(c, np.arange(2 * k + 1, 2 * k + 1 + n), axis=axis)
    lo = np.take(c, np.arange(0, n), axis=axis)
    return ((hi - lo) / (2 * k + 1)).astype(np.float32)

def blur(a, rad):
    # three box passes approximate a gaussian of the given radius
    a = a.astype(np.float32)
    k = max(1, int(round(rad * 0.85)))
    for _ in range(3):
        a = _box(_box(a, k, 0), k, 1)
    return a

def dilate(m, n):
    out = m.copy()
    for _ in range(n):
        o = out.copy()
        o[1:] |= out[:-1]; o[:-1] |= out[1:]; o[:, 1:] |= out[:, :-1]; o[:, :-1] |= out[:, 1:]
        out = o
    return out

def erode(m, n):
    return ~dilate(~m, n)

# ---- sky colour model: quadratic in x,y per channel, fitted on confident sky
conf = (d < 0.08) & (b > r + 28) & (b > 120) & (yn < 0.66)
def feats(x, y):
    return np.stack([np.ones_like(x), x, y, x * x, y * y, x * y, y * y * y], -1)
F = feats(xn[conf], yn[conf])
coef = [np.linalg.lstsq(F, im[..., c][conf], rcond=None)[0] for c in range(3)]
Fall = feats(xn, yn)
sky = np.stack([Fall @ coef[c] for c in range(3)], -1)
sky_err = np.sqrt(((im - sky) ** 2).sum(-1))

# ---- foreground mask from depth, refined at the sky boundary by colour
fg = d > 0.45
band = dilate(fg, 10) & ~erode(fg, 10)
# inside the boundary band, a pixel that matches the sky model is background
is_sky_px = (sky_err < 26) & (b > r + 18)
fg = np.where(band & is_sky_px, False, fg)
fg = np.where(band & ~is_sky_px & (d > 0.30) , True, fg)
# clean speckle: open then close
fg = dilate(erode(fg, 1), 1)
fg = erode(dilate(fg, 1), 1)

# ---- alpha: feather 1.2px, then decontaminate edge colour from sky spill
alpha = np.clip(blur(fg.astype(np.float32), 1.2), 0, 1)
edge = (alpha > 0.02) & (alpha < 0.98)
fgc = im.copy()
a3 = alpha[..., None]
# un-premultiply against the local background (sky model where it is sky, else leave)
spill = edge & (sky_err < 60)
est = (im - (1 - a3) * sky) / np.maximum(a3, 0.15)
fgc[spill] = np.clip(est[spill], 0, 255)

# ---- clean plate
hole = dilate(fg, 7)
vis = ~hole
skyvis = vis & is_sky_px & (yn < 0.68)
# ridge line: lowest sky row per visible column, interpolated across hidden columns
ridge = np.full(W, np.nan, np.float32)
for x in range(W):
    ys = np.nonzero(skyvis[:, x])[0]
    if ys.size > 40:
        rr = int(ys.max())
        # trust it only where both sides of the ridge are actually visible
        if not hole[max(0, rr - 40):min(H, rr + 40), x].any(): ridge[x] = rr
good = ~np.isnan(ridge)
ridge = np.interp(np.arange(W), np.nonzero(good)[0], ridge[good])
ridge = blur(ridge[None, :].repeat(3, 0), 6)[1]
above = yy <= ridge[None, :]
plate = im.copy()
rng = np.random.default_rng(7)
noise = rng.normal(0, 1.6, (H, W, 1)).astype(np.float32)
sky_fill = hole & above
# The whole sky above the ridge is rebuilt from the model; real sky detail
# (the small clouds) is kept only where it is well away from any hole, so the
# gaps that peeked between flags do not leave blotches.
near_hole = np.clip(blur(hole.astype(np.float32), 28) * 3.0, 0, 1)
keep = (1 - near_hole)[..., None] * above[..., None]
model = np.clip(sky + noise, 0, 255)
plate = np.where(above[..., None], model * (1 - keep) + im * keep, plate)

# Below the ridge: clone across each hole run from both sides, translating
# (not mirroring) and following the ridge slope near the mountains, so the
# slope striations continue instead of folding into chevrons.
low = hole & ~above
src = plate.copy()
for y in range(H):
    row = low[y]
    if not row.any(): continue
    xs = np.nonzero(row)[0]
    runs = np.split(xs, np.nonzero(np.diff(xs) > 1)[0] + 1)
    for run in runs:
        a, z = int(run[0]), int(run[-1]) + 1
        n = z - a
        xi = np.arange(a, z)
        near_ridge = np.clip(1 - (y - ridge[xi]) / (0.22 * H), 0, 1)
        def take(sx):
            sx = np.clip(sx, 0, W - 1)
            sy = np.clip(np.round(y + (ridge[sx] - ridge[xi]) * near_ridge), 0, H - 1).astype(int)
            return src[sy, sx]
        has_l, has_r = a - n >= 0, z + n <= W
        Lc = take(xi - n) if has_l else None
        Rc = take(xi + n) if has_r else None
        if Lc is None and Rc is None:
            Rc = take(xi + n)
        if Lc is None: plate[y, a:z] = Rc
        elif Rc is None: plate[y, a:z] = Lc
        else:
            t = np.clip((xi - a - n * 0.3) / max(1, n * 0.4), 0, 1)[:, None]
            plate[y, a:z] = Lc * (1 - t) + Rc * t
soft = np.stack([blur(plate[..., c], 1.2) for c in range(3)], -1)
plate[low] = soft[low] * 0.5 + plate[low] * 0.5

# ---- aux maps
dback = d.copy()
dback[hole] = np.nan
# fill back depth holes row-wise by interpolation (background depth is smooth)
for y in range(H):
    rw = dback[y]; m = np.isnan(rw)
    if m.any() and (~m).any():
        rw[m] = np.interp(np.nonzero(m)[0], np.nonzero(~m)[0], rw[~m])
dback = np.clip(blur(np.nan_to_num(dback, nan=0.0), 3), 0, 1)
skym = np.clip(blur((above).astype(np.float32), 2.0), 0, 1)
dfront = np.where(fg, d, 0)
dfront = np.clip(blur(dilate(fg, 3) * np.maximum(dfront, blur(dfront, 8)), 2), 0, 1)
aux = np.stack([dback, skym, dfront], -1)

os.makedirs(os.path.join(out, "assets"), exist_ok=True)
os.makedirs(os.path.join(out, "lab"), exist_ok=True)
Image.fromarray(plate.astype(np.uint8)).save(os.path.join(out, "assets/gate-back.jpg"), quality=84, optimize=True, progressive=True)
rgba = np.dstack([fgc, alpha * 255]).astype(np.uint8)
Image.fromarray(rgba, "RGBA").save(os.path.join(out, "assets/gate-front.webp"), quality=86, method=6)
Image.fromarray((aux * 255).astype(np.uint8)).resize((1200, 800), Image.LANCZOS).save(os.path.join(out, "assets/gate-aux.png"), optimize=True)

# ---- inspection sheet: cutout over magenta, cutout over black, clean plate
s = 0.33
def small(a): return Image.fromarray(a.astype(np.uint8)).resize((int(W * s), int(H * s)), Image.LANCZOS)
mag = (fgc * a3 + np.array([255, 0, 200]) * (1 - a3))
blk = (fgc * a3 + np.array([12, 14, 18]) * (1 - a3))
sheet = Image.new("RGB", (int(W * s) * 2 + 10, int(H * s) * 2 + 10), (40, 40, 40))
sheet.paste(small(mag), (0, 0)); sheet.paste(small(blk), (int(W * s) + 10, 0))
sheet.paste(small(plate), (0, int(H * s) + 10)); sheet.paste(small(aux * 255), (int(W * s) + 10, int(H * s) + 10))
sheet.save(os.path.join(out, "lab/planes-check.jpg"), quality=80)
print("fg px", int(fg.sum()), "hole px", int(hole.sum()), "sky fill", int(sky_fill.sum()), "low fill", int(low.sum()))
