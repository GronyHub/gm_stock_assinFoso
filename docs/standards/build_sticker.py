from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.graphics import renderPDF
import sys
NUMBER_DISPLAY="053 432 8977"
WA_URL="https://wa.me/233534328977"
NAVY=colors.HexColor("#14213D"); ORANGE=colors.HexColor("#E85D04"); LIGHT=colors.HexColor("#FDF0E6"); GREEN=colors.HexColor("#1E9E4F"); GREY=colors.HexColor("#555555")
SW,SH=190*mm,92*mm

def fit(text,font,maxw,maxfs):
    return min(maxfs,maxw/stringWidth(text,font,1))

def qr(c,x,y,size,url):
    w=QrCodeWidget(url); w.barLevel='M'
    b=w.getBounds(); bw=b[2]-b[0]; bh=b[3]-b[1]
    d=Drawing(size,size,transform=[size/bw,0,0,size/bh,0,0]); d.add(w)
    renderPDF.draw(d,c,x,y)

import re
CALL_PATH="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"
def parse_path(d):
    tk=re.findall(r'[MmLlHhVvCcZz]|[-+]?(?:\d*\.\d+|\d+\.?)',d)
    i=0; cmd=None; cur=(0.0,0.0); start=(0.0,0.0); ops=[]
    def num():
        nonlocal i
        v=float(tk[i]); i+=1; return v
    while i<len(tk):
        t=tk[i]
        if t.isalpha():
            cmd=t; i+=1
            if cmd in 'Zz': ops.append(('Z',)); cur=start
            continue
        if cmd=='M': cur=(num(),num()); start=cur; ops.append(('M',)+cur); cmd='L'
        elif cmd=='m': cur=(cur[0]+num(),cur[1]+num()); start=cur; ops.append(('M',)+cur); cmd='l'
        elif cmd=='L': cur=(num(),num()); ops.append(('L',)+cur)
        elif cmd=='l': cur=(cur[0]+num(),cur[1]+num()); ops.append(('L',)+cur)
        elif cmd=='H': cur=(num(),cur[1]); ops.append(('L',)+cur)
        elif cmd=='h': cur=(cur[0]+num(),cur[1]); ops.append(('L',)+cur)
        elif cmd=='V': cur=(cur[0],num()); ops.append(('L',)+cur)
        elif cmd=='v': cur=(cur[0],cur[1]+num()); ops.append(('L',)+cur)
        elif cmd=='C':
            p=[num() for _ in range(6)]; ops.append(('C',)+tuple(p)); cur=(p[4],p[5])
        elif cmd=='c':
            p=[num() for _ in range(6)]; a=(cur[0]+p[0],cur[1]+p[1],cur[0]+p[2],cur[1]+p[3],cur[0]+p[4],cur[1]+p[5]); ops.append(('C',)+a); cur=(a[4],a[5])
        else: raise ValueError(cmd)
    return ops
CALL_OPS=parse_path(CALL_PATH)
def draw_ops(c,ops,x0,y0,k,color):
    p=c.beginPath()
    for o in ops:
        if o[0]=='M': p.moveTo(x0+o[1]*k,y0+(24-o[2])*k)
        elif o[0]=='L': p.lineTo(x0+o[1]*k,y0+(24-o[2])*k)
        elif o[0]=='C': p.curveTo(x0+o[1]*k,y0+(24-o[2])*k,x0+o[3]*k,y0+(24-o[4])*k,x0+o[5]*k,y0+(24-o[6])*k)
        else: p.close()
    c.setFillColor(color); c.drawPath(p,fill=1,stroke=0)
def phone_icon(c,cx,cy,color):
    k=0.8; draw_ops(c,CALL_OPS,cx-12*k,cy-12*k,k,color)
def chat_icon(c,cx,cy,color):
    c.setFillColor(color); c.circle(cx,cy+1,7.2,fill=1,stroke=0)
    t=c.beginPath(); t.moveTo(cx-6.2,cy-3); t.lineTo(cx-9,cy-8.5); t.lineTo(cx-1.8,cy-5.2); t.close(); c.drawPath(t,fill=1,stroke=0)
    c.setFillColor(colors.white)
    for dx in (-3.6,0,3.6): c.circle(cx+dx,cy+1,1.3,fill=1,stroke=0)
def momo_icon(c,cx,cy,color):
    c.setFillColor(NAVY); c.roundRect(cx-8.5,cy-8.5,9.5,17,1.8,fill=1,stroke=0)
    c.setFillColor(colors.white); c.rect(cx-7.2,cy-5.8,7,11.6,fill=1,stroke=0)
    c.setFillColor(colors.HexColor("#F2A900")); c.setStrokeColor(NAVY); c.setLineWidth(1.1); c.circle(cx+4.4,cy+2.2,5.6,fill=1,stroke=1)
    c.setLineWidth(1.2); c.arc(cx+4.4-2.5,cy+2.2-2.5,cx+4.4+2.5,cy+2.2+2.5,45,270)
    c.setLineWidth(1.0); c.line(cx+4.4,cy+2.2-3.8,cx+4.4,cy+2.2+3.8)

def sticker(c):
    W,H=SW,SH
    c.saveState()
    p=c.beginPath(); p.roundRect(0,0,W,H,12); c.clipPath(p,stroke=0,fill=0)
    c.setFillColor(colors.white); c.rect(0,0,W,H,fill=1,stroke=0)
    c.setFillColor(NAVY); c.rect(0,H-72,W,72,fill=1,stroke=0)
    c.setFillColor(ORANGE); c.rect(0,H-77,W,5,fill=1,stroke=0)
    c.setFillColor(LIGHT); c.rect(0,0,W,30,fill=1,stroke=0)
    c.setStrokeColor(ORANGE); c.setLineWidth(1.5); c.line(0,30,W,30)
    c.restoreState()
    # heading
    head="SEND YOUR WORK ON WHATSAPP"
    fs=fit(head,"Helvetica-Bold",W-60,34)
    c.setFillColor(colors.white); c.setFont("Helvetica-Bold",fs); c.drawCentredString(W/2,H-72+ (72-fs*0.72)/2,head)
    # left column
    lab="COMPANY NUMBER  -  CALLS, WHATSAPP & MOBILE MONEY"; lfs=fit(lab,"Helvetica-Bold",338,11)
    c.setFillColor(NAVY); c.setFont("Helvetica-Bold",lfs); c.drawString(24,H-100,lab)
    nfs=fit(NUMBER_DISPLAY,"Helvetica-Bold",342,60)
    c.setFillColor(NAVY); c.setFont("Helvetica-Bold",nfs); c.drawString(22,90,NUMBER_DISPLAY)
    # three channel chips: call, whatsapp, mobile money
    CALLBLUE=colors.HexColor("#1F5FBF"); GOLD=colors.HexColor("#F2A900")
    chw,chh,gap,cy0=108,34,7,42
    chips=[("CALL",CALLBLUE,colors.white,phone_icon),("WhatsApp",GREEN,colors.white,chat_icon),(("MOBILE","MONEY"),GOLD,NAVY,momo_icon)]
    for i,(lb,col,tc,icon) in enumerate(chips):
        x=24+i*(chw+gap)
        c.setFillColor(col); c.roundRect(x,cy0,chw,chh,17,fill=1,stroke=0)
        cx,cy=x+20,cy0+chh/2
        c.setFillColor(colors.white); c.circle(cx,cy,12,fill=1,stroke=0)
        icon(c,cx,cy,col)
        c.setFillColor(tc)
        if isinstance(lb,tuple):
            c.setFont("Helvetica-Bold",10.5); c.drawString(x+38,cy+1.5,lb[0]); c.drawString(x+38,cy-10,lb[1])
        else:
            f_=fit(lb,"Helvetica-Bold",chw-38-8,14); c.setFont("Helvetica-Bold",f_); c.drawString(x+38,cy-f_*0.35,lb)
    # divider + QR
    c.setStrokeColor(colors.HexColor("#CCCCCC")); c.setLineWidth(0.8); c.line(374,42,374,H-86)
    qs=128; qx=W-24-qs; qy=46
    qr(c,qx,qy,qs,WA_URL)
    c.setFillColor(NAVY); c.setFont("Helvetica-Bold",8.6); c.drawCentredString(qx+qs/2,34.5,"SCAN TO CHAT ON WHATSAPP")
    # bottom strip text
    c.setFillColor(NAVY); c.setFont("Helvetica-Bold",11)
    c.drawCentredString(W/2,10,"GRONY MULTIMEDIA   •   ASSIN FOSO   •   NEAR GCB BANK")
    # border
    c.setStrokeColor(NAVY); c.setLineWidth(3.5); c.roundRect(0,0,W,H,12,fill=0,stroke=1)

out=sys.argv[1] if len(sys.argv)>1 else "Grony_Company_Number_Sticker.pdf"
c=canvas.Canvas(out,pagesize=A4); c.setTitle("Grony Multimedia – Company number sticker")
PW,PH=A4
def place(x,y,scale):
    cut=1.6*mm
    c.setStrokeColor(colors.HexColor("#999999")); c.setLineWidth(0.5); c.setDash(3,3)
    c.rect(x-cut,y-cut,SW*scale+2*cut,SH*scale+2*cut,fill=0,stroke=1); c.setDash()
    c.saveState(); c.translate(x,y); c.scale(scale,scale); sticker(c); c.restoreState()
place(10*mm,PH-10*mm-SH,1.0)
s=0.4842
ys=PH-10*mm-SH-9*mm-SH*s
place(10*mm,ys,s); place(108*mm,ys,s)
c.setFillColor(colors.HexColor("#333333")); c.setFont("Helvetica-Bold",10); c.drawString(10*mm,ys-12*mm,"PRINT AND FIX")
c.setFont("Helvetica",9)
for i,l in enumerate([
 "1.  Print at 100% / Actual size (not 'fit to page'). Sticker paper is best; plain paper works with tape.",
 "2.  Cut along the dashed lines. If you can, laminate it with the shop laminator first.",
 "3.  Large sticker: back of the Grony 2 monitor, on the flat part BELOW the vent slots, facing customers.",
 "4.  Tape or stick all four edges. Never cover the monitor's vent slots.",
 "5.  Small copies: Grony 1 monitor, the counter, or spares.",
 "6.  Test the QR with a phone camera: it should open a WhatsApp chat with the company number."]):
    c.drawString(10*mm,ys-18*mm-i*5.2*mm,l)
c.save()
