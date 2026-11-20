import sys, glob, os
from PIL import Image, ImageDraw
d = sys.argv[1]; out = sys.argv[2]; cols = int(sys.argv[3]) if len(sys.argv) > 3 else 4; tw = int(sys.argv[4]) if len(sys.argv) > 4 else 480
fs = sorted(glob.glob(os.path.join(d, "*.png")), key=os.path.getmtime)
if len(sys.argv) > 5: fs = [f for f in fs if any(k in os.path.basename(f) for k in sys.argv[5].split(","))]
ims = [Image.open(f).convert("RGB") for f in fs]
th = int(ims[0].height * tw / ims[0].width)
rows = (len(ims) + cols - 1) // cols
S = Image.new("RGB", (cols * (tw + 8), rows * (th + 26)), (30, 30, 30))
dr = ImageDraw.Draw(S)
for k, (f, im) in enumerate(zip(fs, ims)):
    x, y = (k % cols) * (tw + 8), (k // cols) * (th + 26)
    S.paste(im.resize((tw, th), Image.LANCZOS), (x, y + 20)); dr.text((x + 4, y + 4), os.path.basename(f), fill=(220, 220, 220))
S.save(out, quality=80)
print(out, len(ims))
