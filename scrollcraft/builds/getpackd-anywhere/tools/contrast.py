import json, sys, re
from PIL import Image
d = sys.argv[1]
rows = json.load(open(f"{d}/lines.json"))
def lum(c):
    c = [v / 255 for v in c]
    c = [v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c]
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
worst_all = 99
for r in rows:
    im = Image.open(f"{d}/{r['name']}-bg.png").convert("RGB")
    W, H = im.size
    for ln in r["lines"]:
        rgb = [int(v) for v in re.findall(r"[\d.]+", ln["color"])[:3]]
        L_ink = lum(rgb)
        box = (max(0, int(ln["x"])), max(0, int(ln["y"])), min(W, int(ln["x"] + ln["w"])), min(H, int(ln["y"] + ln["h"])))
        if box[2] <= box[0] or box[3] <= box[1]: continue
        px = sorted(lum(p) for p in im.crop(box).getdata())
        bright = px[int(len(px) * 0.98) - 1]
        ratio = (max(L_ink, bright) + 0.05) / (min(L_ink, bright) + 0.05)
        need = 3.0 if ln["size"] >= 24 else 4.5
        flag = "" if ratio >= need else "  << FAIL"
        worst_all = min(worst_all, ratio / need)
        print(f"{r['name']:<11} {ratio:5.2f}:1 (need {need})  {ln['t'][:34]!r}{flag}")
print("worst ratio/need:", round(worst_all, 2))
