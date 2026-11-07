"""Renders the page guide videos into public/guides/<key>.mp4 (720x1280, narrated, British voice).
Reuses the advert renderer's drawing helpers and voice (docs/adverts/render.py).
Usage: VOICE=/path/en_GB-alba-medium.onnx python3 render_guides.py [keys...]   (default: all)"""
import os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "adverts"))
sys.path.insert(0, HERE)
import render as R  # noqa: E402  (docs/adverts/render.py)
from guides import GUIDES  # noqa: E402
from PIL import ImageDraw  # noqa: E402

OUT = os.path.join(HERE, "..", "..", "public", "guides")
TMP = os.path.join(HERE, "tmp")
os.makedirs(OUT, exist_ok=True); os.makedirs(TMP, exist_ok=True)
W, H = 720, 1280


def frame(g, i):
    sc = g["scenes"][i]; n = len(g["scenes"])
    im = R.bg(W, H, g["colour"]); d = ImageDraw.Draw(im); M = 50
    # top band: which page this guide is for
    fb = R.font("Bold", 26)
    tag = f"HOW TO USE  ·  {g['title'].upper()}"
    d.rounded_rectangle((M, 60, W - M, 112), 26, fill=tuple(int(v * 0.55) for v in g["colour"]), outline=(255, 255, 255), width=2)
    d.text(((W - d.textlength(tag, font=fb)) / 2, 72), tag, font=fb, fill=(255, 255, 255))
    if not sc.get("bullets"):  # title scene
        fh = R.font("ExtraBold", 72)
        y = R.centred(d, R.wrap(d, sc["heading"].upper(), fh, W - 2 * M), fh, 420, W, R.YELLOW, 8)
        if sc.get("sub"):
            fs = R.font("Medium", 38)
            y = R.centred(d, R.wrap(d, sc["sub"], fs, W - 2 * M), fs, y + 30, W, (255, 255, 255))
        R.centred(d, ["▶ Guide"], R.font("Bold", 30), H - 260, W, (225, 228, 245))
    else:
        fh = R.font("ExtraBold", 50)
        y = R.centred(d, R.wrap(d, sc["heading"], fh, W - 2 * M), fh, 170, W, R.YELLOW, 6)
        R.bullets_card(im, sc["bullets"], M - 10, y + 36, W - 2 * M + 20, 36, H - y - 200)
    foot = "GRONY MULTIMEDIA  ·  STAFF GUIDE"
    ff = R.font("Bold", 22)
    d.text(((W - d.textlength(foot, font=ff)) / 2, H - 70), foot, font=ff, fill=(225, 228, 245))
    R.dots(d, W, H - 28, n, i)
    return im


def render(key):
    g = GUIDES[key]; parts = []
    for i, sc in enumerate(g["scenes"]):
        wav, dur = R.tts(sc["say"])
        png = os.path.join(TMP, f"{key}_{i}.png"); frame(g, i).save(png)
        seg = os.path.join(TMP, f"{key}_{i}.mp4"); L = dur + 0.9
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-loop", "1", "-framerate", "30", "-i", png, "-i", wav,
            "-filter_complex", f"[0:v]scale={W}:{H},fps=30,fade=t=in:st=0:d=0.3,fade=t=out:st={L-0.3:.2f}:d=0.3,format=yuv420p[v];"
            f"[1:a]adelay=350|350,apad,atrim=0:{L:.2f},aformat=sample_rates=44100:channel_layouts=stereo[a]",
            "-map", "[v]", "-map", "[a]", "-t", f"{L:.2f}", "-c:v", "libx264", "-preset", "medium", "-tune", "stillimage",
            "-crf", "24", "-r", "30", "-c:a", "aac", "-b:a", "96k", seg], check=True)
        parts.append(seg)
    lst = os.path.join(TMP, f"{key}.txt"); open(lst, "w").write("".join(f"file '{p}'\n" for p in parts))
    out = os.path.join(OUT, f"{key}.mp4")
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", "-movflags", "+faststart", out], check=True)
    print(out, round(sum(R.tts(s["say"])[1] + 0.9 for s in g["scenes"]), 1), "s", flush=True)


if __name__ == "__main__":
    keys = sys.argv[1:] or list(GUIDES)
    for k in keys:
        if os.environ.get("PREVIEW"):
            for i in range(len(GUIDES[k]["scenes"])):
                frame(GUIDES[k], i).save(os.path.join(TMP, f"pv_{k}_{i}.png"))
            continue
        render(k)
