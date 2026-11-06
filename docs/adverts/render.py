"""Renders the narrated advert videos: one scene per script entry, each as long as its narration.
Usage: python3 render.py [ad keys...]   (default: all). Output: out/Grony_Ad_<key>.mp4 and _square.mp4."""
import hashlib, json, os, subprocess, sys, wave
from PIL import Image, ImageDraw, ImageFont, ImageFilter
sys.path.insert(0, os.path.dirname(__file__))
from scripts import ADS

HERE = os.path.dirname(os.path.abspath(__file__))
PHOTOS = os.path.join(HERE, "photos")
# Piper voice en_GB-alba-medium (huggingface.co/rhasspy/piper-voices); set VOICE to where the .onnx file is.
VOICE = os.environ.get("VOICE", os.path.join(HERE, "voice", "en_GB-alba-medium.onnx"))
LOGO = os.path.join(HERE, "..", "..", "public", "logo-mark.png")
OUT = os.path.join(HERE, "out"); TMP = os.path.join(HERE, "tmp")
os.makedirs(OUT, exist_ok=True); os.makedirs(TMP, exist_ok=True)
F = "/usr/share/fonts/opentype/inter/Inter-%s.otf"
font = lambda w, s: ImageFont.truetype(F % w, s)
YELLOW = (255, 214, 0); WHITE = (255, 255, 255); INK = (20, 24, 45)
CREDITS = {}
try:
    for v in json.load(open(os.path.join(PHOTOS, "commons", "credits.json"))).values():
        for c in v: CREDITS["commons/" + c["file"]] = c
except FileNotFoundError: pass


def tts(text):
    h = hashlib.md5(text.encode()).hexdigest()[:12]; wav = os.path.join(TMP, f"v_{h}.wav")
    if not os.path.exists(wav):
        subprocess.run([sys.executable, "-m", "piper", "-m", VOICE, "-f", wav, "--length-scale", "1.04", "--sentence-silence", "0.35"],
                       input=text.encode(), check=True, capture_output=True)
    with wave.open(wav) as w: return wav, w.getnframes() / w.getframerate()


def wrap(d, text, f, width):
    lines, cur = [], ""
    for word in text.split():
        t = (cur + " " + word).strip()
        if d.textlength(t, font=f) <= width or not cur: cur = t
        else: lines.append(cur); cur = word
    if cur: lines.append(cur)
    return lines


def bg(W, H, colour):
    im = Image.new("RGB", (W, H)); d = ImageDraw.Draw(im)
    for y in range(H):
        k = y / H; c = tuple(int(v * (1 - 0.55 * k)) for v in colour)
        d.line([(0, y), (W, y)], fill=c)
    glow = Image.new("RGB", (W, H), (0, 0, 0)); ImageDraw.Draw(glow).ellipse((W * .45, H * .62, W * 1.3, H * 1.25), fill=(40, 90, 255))
    return Image.blend(im, glow.filter(ImageFilter.GaussianBlur(120)), 0.22)


def photo(path, w, h, radius=26):
    p = os.path.join(PHOTOS, path)
    try: src = Image.open(p).convert("RGB")
    except Exception: return None
    s = max(w / src.width, h / src.height); src = src.resize((int(src.width * s) + 1, int(src.height * s) + 1), Image.LANCZOS)
    x, y = (src.width - w) // 2, (src.height - h) // 2; src = src.crop((x, y, x + w, y + h))
    card = Image.new("RGBA", (w + 12, h + 12), (0, 0, 0, 0)); m = Image.new("L", (w + 12, h + 12), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, w + 11, h + 11), radius + 6, fill=255)
    card.paste(Image.new("RGB", (w + 12, h + 12), WHITE), (0, 0), m)
    m2 = Image.new("L", (w, h), 0); ImageDraw.Draw(m2).rounded_rectangle((0, 0, w - 1, h - 1), radius, fill=255)
    card.paste(src, (6, 6), m2)
    return card


def photos_block(im, paths, x, y, w, h):
    paths = [p for p in paths if os.path.exists(os.path.join(PHOTOS, p))][:4]
    if not paths: return
    g = 14
    if len(paths) == 1: cells = [(x, y, w, h)]
    elif len(paths) == 2:
        if w >= h: cw = (w - g) // 2; cells = [(x, y, cw, h), (x + cw + g, y, cw, h)]
        else: ch = (h - g) // 2; cells = [(x, y, w, ch), (x, y + ch + g, w, ch)]
    else:
        cw, ch = (w - g) // 2, (h - g) // 2
        cells = [(x, y, cw, ch), (x + cw + g, y, cw, ch), (x, y + ch + g, cw, ch), (x + cw + g, y + ch + g, cw, ch)][:len(paths)]
    for p, (cx, cy, cw, ch) in zip(paths, cells):
        c = photo(p, cw - 12, ch - 12)
        if c: im.paste(c, (cx, cy), c)


def centred(d, lines, f, y, W, fill, gap=6, x0=0, w=None):
    w = w or W
    for ln in lines:
        d.text((x0 + (w - d.textlength(ln, font=f)) / 2, y), ln, font=f, fill=fill); y += f.size + gap
    return y


def bullets_card(im, items, x, y, w, size, maxh):
    d = ImageDraw.Draw(im); f = font("SemiBold", size)
    rows = [wrap(d, b, f, w - 96) for b in items]
    lh = size + 9; pad = 30
    h = pad * 2 + sum(len(r) * lh for r in rows) + (len(rows) - 1) * 20
    while h > maxh and size > 20:  # shrink to fit
        return bullets_card(im, items, x, y, w, size - 2, maxh)
    d.rounded_rectangle((x, y, x + w, y + h), 26, fill=(255, 255, 255))
    cy = y + pad
    for r in rows:
        d.ellipse((x + 30, cy + size * .3, x + 30 + size * .55, cy + size * .3 + size * .55), fill=YELLOW, outline=INK, width=2)
        for ln in r: d.text((x + 72, cy), ln, font=f, fill=INK); cy += lh
        cy += 20
    return y + h


def dots(d, W, y, n, i):
    x = (W - (n * 22)) / 2
    for k in range(n):
        r = 6 if k == i else 4; c = YELLOW if k == i else (255, 255, 255, 120)
        d.ellipse((x + k * 22 + 11 - r, y - r, x + k * 22 + 11 + r, y + r), fill=c if k == i else (200, 200, 220))


def credit_line(ad):
    used = []
    for sc in ad["scenes"]:
        for p in sc.get("photos", []):
            c = CREDITS.get(p)
            if c and f'{c["author"]} ({c["licence"]})' not in used: used.append(f'{c["author"]} ({c["licence"]})')
    return ("Some photos: Wikimedia Commons, " + ", ".join(used)) if used else ""


def frame(ad, i, W, H):
    sc = ad["scenes"][i]; n = len(ad["scenes"])
    im = bg(W, H, ad["colour"]); d = ImageDraw.Draw(im)
    tall = H > W; M = 50 if tall else 60
    if sc.get("contact"):
        logo = Image.open(LOGO).convert("RGBA").resize((150, 150))
        ly = 120 if tall else 80; im.paste(logo, ((W - 150) // 2, ly), logo)
        y = centred(d, ["GRONY MULTIMEDIA"], font("ExtraBold", 54 if tall else 58), ly + 180, W, YELLOW)
        y = centred(d, ["Visit us today!"], font("Bold", 36), y + 6, W, WHITE) + 30
        if tall: y += 40
        for b in sc["bullets"]:
            sz = 32
            while d.textlength(b, font=font("SemiBold", sz)) > W - 2 * M - 90: sz -= 1
            f = font("SemiBold", sz)
            d.rounded_rectangle((M, y, W - M, y + 70), 35, fill=WHITE)
            d.text(((W - d.textlength(b, font=f)) / 2, y + 35 - sz * 0.6), b, font=f, fill=INK); y += (92 if tall else 82)
        cl = credit_line(ad)
        if cl:
            fc = font("Medium", 18 if tall else 16); centred(d, wrap(d, cl, fc, W - 2 * M), fc, H - (110 if tall else 70), W, (200, 205, 230), 3)
    elif tall:
        ph = 520 if sc.get("bullets") else 640
        photos_block(im, sc.get("photos", []), M, 70, W - 2 * M, ph)
        y = 70 + ph + 26
        y = centred(d, wrap(d, sc["heading"].upper(), font("ExtraBold", 50), W - 2 * M), font("ExtraBold", 50), y, W, YELLOW, 4)
        if sc.get("sub"): centred(d, wrap(d, sc["sub"], font("Medium", 32), W - 2 * M), font("Medium", 32), y + 14, W, WHITE)
        if sc.get("bullets"): bullets_card(im, sc["bullets"], M - 10, y + 28, W - 2 * M + 20, 33, H - y - 130)
    else:
        bx = 470
        photos_block(im, sc.get("photos", []), M, 80, bx - M, H - 200)
        tx, tw = bx + 40, W - bx - 40 - M
        y = 90 if sc.get("bullets") else 300
        fh = font("ExtraBold", 50)
        y = centred(d, wrap(d, sc["heading"].upper(), fh, tw), fh, y, W, YELLOW, 4, tx, tw)
        if sc.get("sub"): centred(d, wrap(d, sc["sub"], font("Medium", 34), tw), font("Medium", 34), y + 18, W, WHITE, 6, tx, tw)
        if sc.get("bullets"): bullets_card(im, sc["bullets"], tx, y + 24, tw, 30, H - y - 140)
    fb = font("Bold", 24)
    foot = "GRONY MULTIMEDIA  ·  053 432 8977"
    if not sc.get("contact"): d.text(((W - d.textlength(foot, font=fb)) / 2, H - 70), foot, font=fb, fill=(225, 228, 245))
    dots(d, W, H - 28, n, i)
    return im


def render(key, W, H, suffix):
    ad = ADS[key]; parts = []
    for i, sc in enumerate(ad["scenes"]):
        wav, dur = tts(sc["say"])
        png = os.path.join(TMP, f"{key}{suffix}_{i}.png"); frame(ad, i, W, H).save(png)
        seg = os.path.join(TMP, f"{key}{suffix}_{i}.mp4"); L = dur + 0.9
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-loop", "1", "-framerate", "30", "-i", png, "-i", wav,
            "-filter_complex", f"[0:v]scale={W}:{H},fps=30,"
            f"fade=t=in:st=0:d=0.3,fade=t=out:st={L-0.3:.2f}:d=0.3,format=yuv420p[v];[1:a]adelay=350|350,apad,atrim=0:{L:.2f},aformat=sample_rates=44100:channel_layouts=stereo[a]",
            "-map", "[v]", "-map", "[a]", "-t", f"{L:.2f}", "-c:v", "libx264", "-preset", "medium", "-tune", "stillimage", "-crf", "24", "-r", "30", "-c:a", "aac", "-b:a", "96k", seg], check=True)
        parts.append(seg)
    lst = os.path.join(TMP, f"{key}{suffix}.txt"); open(lst, "w").write("".join(f"file '{p}'\n" for p in parts))
    name = "Grony_All_Services" if key == "all" else f"Grony_Ad_{key}"
    out = os.path.join(OUT, f"{name}{suffix}.mp4")
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", "-movflags", "+faststart", out], check=True)
    print(out, round(sum(tts(s["say"])[1] + 0.9 for s in ad["scenes"]), 1), "s", flush=True)


if __name__ == "__main__":
    keys = sys.argv[1:] or list(ADS)
    for k in keys:
        if os.environ.get("PREVIEW"):
            for i in range(len(ADS[k]["scenes"])):
                frame(ADS[k], i, 720, 1280).save(os.path.join(TMP, f"pv_{k}_{i}.png")); frame(ADS[k], i, 1080, 1080).save(os.path.join(TMP, f"pvs_{k}_{i}.png"))
            continue
        render(k, 720, 1280, ""); render(k, 1080, 1080, "_square")
