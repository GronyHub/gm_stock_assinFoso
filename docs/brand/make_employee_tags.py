import os, sys
from PIL import Image, ImageDraw, ImageFont

OUT = os.path.dirname(os.path.abspath(__file__))
NAVY = (1, 7, 69); YEL = (255, 240, 0); WHITE = (255, 255, 255); GREY = (170, 178, 214); INK = (20, 24, 60)
INTER = '/usr/share/fonts/opentype/inter/'
BLK, EXB, SEMI, MED, REG = [INTER + f for f in ('Inter-Black.otf', 'Inter-ExtraBold.otf', 'Inter-SemiBold.otf', 'Inter-Medium.otf', 'Inter-Regular.otf')]
LOGO = Image.open('/home/user/gm_stock_assinfoso/docs/brand/grony-logo-mark-512.png').convert('RGBA')

DPI = 600
def mm(v): return int(round(v / 25.4 * DPI))
CW = float(sys.argv[1]) if len(sys.argv) > 1 else 85.6   # card width in mm  (change when exact size is known)
CH = float(sys.argv[2]) if len(sys.argv) > 2 else 54.0    # card height in mm
W, H = mm(CW), mm(CH)
_f = {}
def F(p, s):
    k = (p, int(s))
    if k not in _f: _f[k] = ImageFont.truetype(p, int(s))
    return _f[k]

# Current shop staff on the system (children_manager accounts and inactive accounts are not shop staff).
STAFF = [
    ('GM-01', 'Grony', 'Prince Fiifi Arthur', 'STAFF'),
    ('GM-02', 'Joe', '', 'STAFF'),
    ('GM-03', 'Bino', 'Simon Kwasi Binolib', 'STAFF'),
    ('GM-04', 'James', 'James Nartey', 'STAFF'),
    ('GM-05', 'Mahama', '', 'STAFF'),
]
PHOTOS = {}  # name -> path to a square-ish photo; filled in once staff have added theirs
for n in STAFF:
    p = os.path.join(OUT, 'photos', n[1].lower() + '.jpg')
    if os.path.exists(p): PHOTOS[n[1]] = p

def ctext(d, cx, y, t, font, fill, spacing=0):
    if spacing:
        tw = sum(d.textlength(c, font=font) for c in t) + spacing * (len(t) - 1)
        x = cx - tw / 2
        for c in t:
            d.text((x, y), c, font=font, fill=fill); x += d.textlength(c, font=font) + spacing
    else:
        d.text((cx - d.textlength(t, font=font) / 2, y), t, font=font, fill=fill)

def fit(d, t, path, size, maxw):
    while d.textlength(t, font=F(path, size)) > maxw and size > 20: size -= 4
    return F(path, size)

def rr_mask(w, h, r):
    m = Image.new('L', (w, h), 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, w - 1, h - 1), r, fill=255); return m

def silhouette(d, cx, cy, r, col):
    d.ellipse((cx - r * .34, cy - r * .62, cx + r * .34, cy + r * .06), fill=col)
    d.ellipse((cx - r * .74, cy + r * .16, cx + r * .74, cy + r * 1.5), fill=col)


def front(sid, name, full, role):
    im = Image.new('RGBA', (W, H), NAVY); d = ImageDraw.Draw(im)
    # lanyard slot (top centre)
    sw, sh = int(H * .22), int(H * .045)
    d.rounded_rectangle((W // 2 - sw // 2, int(H * .05), W // 2 + sw // 2, int(H * .05) + sh), sh // 2, outline=GREY, width=4)
    # photo (left)
    pr = int(H * .30); pcx = int(W * .25); pcy = int(H * .56); ring = int(H * .022)
    d.ellipse((pcx - pr - ring, pcy - pr - ring, pcx + pr + ring, pcy + pr + ring), fill=YEL)
    if name in PHOTOS:
        ph = Image.open(PHOTOS[name]).convert('RGB'); q = min(ph.size)
        ph = ph.crop(((ph.width - q) // 2, (ph.height - q) // 2, (ph.width + q) // 2, (ph.height + q) // 2)).resize((pr * 2, pr * 2), Image.LANCZOS)
        layer = ph
    else:
        layer = Image.new('RGBA', (pr * 2, pr * 2), (232, 235, 250, 255)); silhouette(ImageDraw.Draw(layer), pr, pr - int(H * .012), pr * .78, (168, 175, 212))
    m = Image.new('L', (pr * 2, pr * 2), 0); ImageDraw.Draw(m).ellipse((0, 0, pr * 2 - 1, pr * 2 - 1), fill=255)
    im.paste(layer, (pcx - pr, pcy - pr), m)
    # right block
    x0 = int(W * .52); rw = W - x0 - int(W * .05)
    lg = LOGO.resize((int(H * .19), int(H * .19)), Image.LANCZOS); im.alpha_composite(lg, (x0, int(H * .12)))
    d.text((x0 + int(H * .22), int(H * .10)), 'GRONY', font=F(BLK, H * .105), fill=WHITE)
    d.text((x0 + int(H * .22), int(H * .215)), 'MULTIMEDIA', font=F(EXB, H * .058), fill=YEL)
    d.line((x0, int(H * .35), x0 + rw, int(H * .35)), fill=YEL, width=int(H * .012))
    disp = name.upper(); d.text((x0, int(H * .39)), disp, font=fit(d, disp, BLK, H * .15, rw), fill=WHITE)
    if full: d.text((x0, int(H * .575)), full, font=fit(d, full, MED, H * .056, rw), fill=GREY)
    rf = F(EXB, H * .06); sp = H * .011
    tw = sum(d.textlength(c, font=rf) for c in role) + sp * (len(role) - 1); pw = tw + H * .15; phh = H * .12; py = int(H * .69)
    d.rounded_rectangle((x0, py, x0 + pw, py + phh), phh // 2, fill=YEL)
    xx = x0 + H * .075
    for c in role:
        d.text((xx, py + H * .027), c, font=rf, fill=NAVY); xx += d.textlength(c, font=rf) + sp
    d.text((x0, int(H * .88)), sid, font=F(SEMI, H * .042), fill=GREY)
    return im

def back():
    im = Image.new('RGBA', (W, H), WHITE); d = ImageDraw.Draw(im)
    lw = int(W * .30)
    d.rectangle((0, 0, lw, H), fill=NAVY); d.rectangle((lw, 0, lw + int(H * .02), H), fill=YEL)
    lg = LOGO.resize((int(H * .26), int(H * .26)), Image.LANCZOS); im.alpha_composite(lg, (lw // 2 - lg.width // 2, int(H * .14)))
    ctext(d, lw // 2, int(H * .46), 'GRONY', F(BLK, H * .10), WHITE)
    ctext(d, lw // 2, int(H * .58), 'MULTIMEDIA', F(EXB, H * .052), YEL, spacing=H * .008)
    ctext(d, lw // 2, int(H * .80), 'WEAR THIS TAG', F(EXB, H * .042), WHITE, spacing=H * .006)
    ctext(d, lw // 2, int(H * .865), 'AT ALL TIMES', F(EXB, H * .042), WHITE, spacing=H * .006)
    x0 = lw + int(W * .06); rw = W - x0 - int(W * .04)
    d.text((x0, int(H * .07)), 'HOW CAN WE HELP?', font=fit(d, 'HOW CAN WE HELP?', BLK, H * .095, rw), fill=NAVY)
    d.text((x0, int(H * .185)), 'Ask for the manager', font=F(SEMI, H * .06), fill=INK)
    rows = [('CALL / WHATSAPP / MOMO', '053 432 8977'), ('LOCATION', 'Assin Foso, near GCB Bank'),
            ('EMAIL', 'info@gronymultimedia.com'), ('WEBSITE', 'www.gronymultimedia.com')]
    y = H * .31
    for lab, val in rows:
        d.text((x0, int(y)), lab, font=F(EXB, H * .034), fill=(110, 116, 160))
        d.text((x0, int(y + H * .045)), val, font=fit(d, val, SEMI, H * .062, rw), fill=NAVY); y += H * .15
    d.text((x0, int(H * .915)), 'Company property, not transferable. If found, call 053 432 8977.', font=fit(d, 'Company property, not transferable. If found, call 053 432 8977.', REG, H * .036, rw), fill=INK)
    return im

def card(im):  # rounded corners, as a printed card would be die-cut
    out = Image.new('RGBA', im.size, (0, 0, 0, 0)); out.paste(im, (0, 0), rr_mask(im.width, im.height, mm(3.2))); return out

fronts = [card(front(*s)) for s in STAFF]
b = card(back())
os.makedirs(os.path.join(OUT, 'png'), exist_ok=True)
for f_ in os.listdir(os.path.join(OUT, 'png')): os.remove(os.path.join(OUT, 'png', f_))
for s, f in zip(STAFF, fronts): f.save(os.path.join(OUT, 'png', f'tag_{s[1].lower()}_front.png'))
b.save(os.path.join(OUT, 'png', 'tag_back.png'))

# A4 portrait print sheets with as many cards as fit; backs mirrored column-wise for long-edge duplex.
A4W, A4H = mm(210), mm(297); gap = mm(6); mar = mm(12)
cols = max(1, (A4W - 2 * mar + gap) // (W + gap)); rows = max(1, (A4H - 2 * mar + gap) // (H + gap)); per = cols * rows
gx = (A4W - (cols * W + (cols - 1) * gap)) // 2; gy = mar
def sheet(items, mirror):
    pg = Image.new('RGB', (A4W, A4H), WHITE); d = ImageDraw.Draw(pg)
    for i, it in enumerate(items):
        r, c = divmod(i, cols)
        if mirror: c = cols - 1 - c
        x = gx + c * (W + gap); y = gy + r * (H + gap)
        pg.paste(it, (x, y), it)
        for (px, py) in ((x, y), (x + W, y), (x, y + H), (x + W, y + H)):
            d.line((px - mm(3), py, px - mm(1), py), fill=(120, 120, 120), width=3); d.line((px + mm(1), py, px + mm(3), py), fill=(120, 120, 120), width=3)
            d.line((px, py - mm(3), px, py - mm(1)), fill=(120, 120, 120), width=3); d.line((px, py + mm(1), px, py + mm(3)), fill=(120, 120, 120), width=3)
    return pg
pages = []
for i in range(0, len(fronts), per):
    chunk = fronts[i:i + per]
    pages += [sheet(chunk, False), sheet([b] * len(chunk), True)]
outp = os.path.join(OUT, 'Grony_Multimedia_Employee_Tags_Horizontal.pdf')
pages[0].save(outp, 'PDF', resolution=DPI, save_all=True, append_images=pages[1:])
print('done', len(fronts), 'tags', CW, 'x', CH, 'mm', cols, 'x', rows, 'per sheet')
