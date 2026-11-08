"""Renders the Company Laws category training videos into public/law-videos/<slug>.mp4 (720x1280, narrated).
Reuses the advert renderer's drawing helpers, photos and voice (docs/adverts/render.py). Scenes are in scenes.py; the
'app' scenes show real screenshots of the app taken by shots.js (docs/laws-videos/shots/*.png).

Voice: the British Piper voice en_GB-alba-medium if VOICE points at it (see docs/adverts/README.md). Without it a
computer voice (espeak-ng, female) is used so the videos can still be made; run again with VOICE set to replace it.
Usage: [VOICE=/path/en_GB-alba-medium.onnx] python3 render_laws.py [slug ...]   (default: all)"""
import hashlib, os, subprocess, sys, wave
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, "..", "adverts"))
import render as R  # noqa: E402  (docs/adverts/render.py)
from scenes import CATS  # noqa: E402
from PIL import Image, ImageDraw  # noqa: E402

OUT = os.path.join(HERE, "..", "..", "public", "law-videos"); TMP = os.path.join(HERE, "tmp"); SHOTS = os.path.join(HERE, "shots")
os.makedirs(OUT, exist_ok=True); os.makedirs(TMP, exist_ok=True)
W, H = 720, 1280
HAVE_PIPER = os.path.exists(R.VOICE)

def tts(text):
    if HAVE_PIPER: return R.tts(text)
    h = hashlib.md5(text.encode()).hexdigest()[:12]; wav = os.path.join(TMP, f"e_{h}.wav")
    if not os.path.exists(wav):
        subprocess.run(["espeak-ng", "-v", "en-gb+f3", "-s", "155", "-p", "55", "-g", "3", "-w", wav, text], check=True)
    with wave.open(wav) as w: return wav, w.getnframes() / w.getframerate()

def band(d, cat):
    fb = R.font("Bold", 24); tag = f"COMPANY LAWS  ·  {cat['key'].upper()}"
    while d.textlength(tag, font=fb) > W - 120 and fb.size > 14: fb = R.font("Bold", fb.size - 2)
    d.rounded_rectangle((50, 60, W - 50, 112), 26, fill=tuple(int(v * 0.55) for v in cat["colour"]), outline=(255, 255, 255), width=2)
    d.text(((W - d.textlength(tag, font=fb)) / 2, 74), tag, font=fb, fill=(255, 255, 255))

def frame(cat, i):
    sc = cat["scenes"][i]; n = len(cat["scenes"]); M = 50
    im = R.bg(W, H, cat["colour"] if sc["kind"] != "sanction" else (150, 40, 50)); d = ImageDraw.Draw(im)
    band(d, cat)
    k = sc["kind"]
    if k == "title":
        R.photos_block(im, cat["photos"], M, 160, W - 2 * M, 520)
        fh = R.font("ExtraBold", 66)
        y = R.centred(d, R.wrap(d, sc["heading"].upper(), fh, W - 2 * M), fh, 740, W, R.YELLOW, 8)
        fs = R.font("Medium", 36); y = R.centred(d, R.wrap(d, sc["sub"], fs, W - 2 * M), fs, y + 24, W, (255, 255, 255))
        R.centred(d, ["Staff training"], R.font("Bold", 30), H - 250, W, (225, 228, 245))
    elif k == "app":
        fh = R.font("ExtraBold", 46); y = R.centred(d, R.wrap(d, sc["heading"], fh, W - 2 * M), fh, 150, W, R.YELLOW, 6)
        p = os.path.join(SHOTS, sc["shot"] + ".png")
        if os.path.exists(p):
            src = Image.open(p).convert("RGB"); h = 820; w = int(src.width * h / src.height)
            src = src.resize((w, h), Image.LANCZOS)
            top = int(y + 14); card = Image.new("RGB", (w + 16, h + 16), (255, 255, 255))
            m = Image.new("L", card.size, 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, w + 15, h + 15), 28, fill=255)
            card.paste(src, (8, 8)); im.paste(card, ((W - w - 16) // 2, top), m)
            fc = R.font("SemiBold", 28); R.centred(d, R.wrap(d, sc["caption"], fc, W - 2 * M), fc, top + h + 36, W, (255, 255, 255))
    else:
        fh = R.font("ExtraBold", 50); y = R.centred(d, R.wrap(d, sc["heading"], fh, W - 2 * M), fh, 170, W, R.YELLOW, 6)
        R.bullets_card(im, sc["bullets"], M - 10, y + 36, W - 2 * M + 20, 36, H - y - 200)
    ff = R.font("Bold", 22); foot = "GRONY MULTIMEDIA  ·  STAFF TRAINING"
    d.text(((W - d.textlength(foot, font=ff)) / 2, H - 70), foot, font=ff, fill=(225, 228, 245))
    R.dots(d, W, H - 28, n, i)
    return im

def render(cat):
    parts = []; slug = cat["slug"]; total = 0
    for i, sc in enumerate(cat["scenes"]):
        wav, dur = tts(sc["say"])
        png = os.path.join(TMP, f"{slug}_{i}.png"); frame(cat, i).save(png)
        seg = os.path.join(TMP, f"{slug}_{i}.mp4"); L = dur + 0.9; total += L
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-loop", "1", "-framerate", "30", "-i", png, "-i", wav,
            "-filter_complex", f"[0:v]scale={W}:{H},fps=30,fade=t=in:st=0:d=0.3,fade=t=out:st={L-0.3:.2f}:d=0.3,format=yuv420p[v];"
            f"[1:a]adelay=350|350,apad,atrim=0:{L:.2f},aformat=sample_rates=44100:channel_layouts=stereo[a]",
            "-map", "[v]", "-map", "[a]", "-t", f"{L:.2f}", "-c:v", "libx264", "-preset", "medium", "-tune", "stillimage",
            "-crf", "24", "-r", "30", "-c:a", "aac", "-b:a", "96k", seg], check=True)
        parts.append(seg)
    lst = os.path.join(TMP, f"{slug}.txt"); open(lst, "w").write("".join(f"file '{p}'\n" for p in parts))
    out = os.path.join(OUT, f"{slug}.mp4")
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", "-movflags", "+faststart", out], check=True)
    print(out, round(total), "s", "(Piper voice)" if HAVE_PIPER else "(espeak voice)", flush=True)

if __name__ == "__main__":
    keys = sys.argv[1:] or [c["slug"] for c in CATS]
    for c in CATS:
        if c["slug"] not in keys: continue
        if os.environ.get("PREVIEW"):
            for i in range(len(c["scenes"])): frame(c, i).save(os.path.join(TMP, f"pv_{c['slug']}_{i}.png"))
            continue
        render(c)
