from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.graphics import renderPDF
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
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


REG_URL="https://app.gronymultimedia.com/register"
BLUE=colors.HexColor("#1F5FBF"); PALEBLUE=colors.HexColor("#EEF4FD"); GOLD=colors.HexColor("#F2A900")
def X(v): return v*mm
def bt_icon(c,cx,cy,r,col):
    c.setFillColor(col); c.circle(cx,cy,r,fill=1,stroke=0)
    u=r/13.0
    pts=[(-4.5,-3.5),(4.5,3.5),(0,8),(0,-8),(4.5,-3.5),(-4.5,3.5)]
    c.setStrokeColor(colors.white); c.setLineWidth(2.3*u); c.setLineJoin(1); c.setLineCap(1)
    p=c.beginPath(); p.moveTo(cx+pts[0][0]*u,cy+pts[0][1]*u)
    for (px,py) in pts[1:]: p.lineTo(cx+px*u,cy+py*u)
    c.drawPath(p,fill=0,stroke=1)
def panel(c,x,y,w,h,r,border,fill,band,band_h):
    c.saveState()
    p=c.beginPath(); p.roundRect(X(x),X(y),X(w),X(h),X(r)); c.clipPath(p,stroke=0,fill=0)
    c.setFillColor(fill); c.rect(X(x),X(y),X(w),X(h),fill=1,stroke=0)
    c.setFillColor(band); c.rect(X(x),X(y+h-band_h),X(w),X(band_h),fill=1,stroke=0)
    c.restoreState()
    c.setStrokeColor(border); c.setLineWidth(2.2); c.roundRect(X(x),X(y),X(w),X(h),X(r),fill=0,stroke=1)

out=sys.argv[1] if len(sys.argv)>1 else "Grony_1_Monitor_Sticker_A4.pdf"
PW,PH=landscape(A4)
c=canvas.Canvas(out,pagesize=(PW,PH)); c.setTitle("Grony Multimedia - Grony 1 monitor sticker (A4 landscape)")
c.setStrokeColor(colors.HexColor("#999999")); c.setLineWidth(0.5); c.setDash(3,3); c.rect(X(4),X(4),PW-X(8),PH-X(8),fill=0,stroke=1); c.setDash()
# body
c.saveState()
p=c.beginPath(); p.roundRect(X(7),X(7),X(283),X(196),X(8)); c.clipPath(p,stroke=0,fill=0)
c.setFillColor(colors.white); c.rect(X(7),X(7),X(283),X(196),fill=1,stroke=0)
c.setFillColor(NAVY); c.rect(X(7),X(173),X(283),X(30),fill=1,stroke=0)
c.setFillColor(ORANGE); c.rect(X(7),X(170),X(283),X(3),fill=1,stroke=0)
c.setFillColor(LIGHT); c.rect(X(7),X(7),X(283),X(14),fill=1,stroke=0)
c.setStrokeColor(ORANGE); c.setLineWidth(1.6); c.line(X(7),X(21),X(290),X(21))
c.restoreState()
# heading
head="SEND YOUR WORK TO GRONY 1"; fs=fit(head,"Helvetica-Bold",X(253),46)
c.setFillColor(colors.white); c.setFont("Helvetica-Bold",fs); c.drawCentredString(PW/2,X(188)-fs*0.36,head)
# row 1: number
lab="COMPANY NUMBER  -  CALLS, WHATSAPP & MOBILE MONEY"; lf=fit(lab,"Helvetica-Bold",X(215),13)
c.setFillColor(NAVY); c.setFont("Helvetica-Bold",lf); c.drawString(X(14),X(163.5),lab)
nf=fit(NUMBER_DISPLAY,"Helvetica-Bold",X(212),110)
c.setFont("Helvetica-Bold",nf); c.drawString(X(12.5),X(134),NUMBER_DISPLAY)
chips=[("CALL",BLUE,colors.white,phone_icon),("WhatsApp",GREEN,colors.white,chat_icon),("MOBILE MONEY",GOLD,NAVY,momo_icon)]
for i,(lb,col,tc,icon) in enumerate(chips):
    x=X(14+i*70); y=X(116); w=X(66); h=X(13)
    c.setFillColor(col); c.roundRect(x,y,w,h,h/2,fill=1,stroke=0)
    cx,cy=x+h/2+1,y+h/2; r=h/2-3
    c.setFillColor(colors.white); c.circle(cx,cy,r,fill=1,stroke=0)
    c.saveState(); c.translate(cx,cy); c.scale(r/12.0,r/12.0); icon(c,0,0,col); c.restoreState()
    f_=fit(lb,"Helvetica-Bold",w-h-14,19); c.setFillColor(tc); c.setFont("Helvetica-Bold",f_); c.drawString(x+h+4,cy-f_*0.35,lb)
qr(c,X(243),X(121),X(42),WA_URL)
c.setFillColor(NAVY); c.setFont("Helvetica-Bold",8); c.drawCentredString(X(264),X(116.5),"SCAN TO CHAT ON WHATSAPP")
# row 2 left: bluetooth
panel(c,14,26,125,84,5,BLUE,PALEBLUE,BLUE,12)
t="SEND BY BLUETOOTH"; tf=fit(t,"Helvetica-Bold",X(110),22)
c.setFillColor(colors.white); c.setFont("Helvetica-Bold",tf); c.drawCentredString(X(76.5),X(104)-tf*0.35,t)
bt_icon(c,X(31),X(70),X(13),BLUE)
c.setFillColor(GREY); c.setFont("Helvetica",12); c.drawString(X(48),X(84),"Bluetooth name:")
nm=fit("GRONY 1","Helvetica-Bold",X(85),64); c.setFillColor(BLUE); c.setFont("Helvetica-Bold",nm); c.drawString(X(47.5),X(66),"GRONY 1")
c.setFillColor(NAVY); c.setFont("Helvetica-Bold",15)
for i,l in enumerate(["1.  Turn on Bluetooth","2.  Choose “Grony 1”","3.  Send your file"]): c.drawString(X(20),X(52-i*8.6),l)
# row 2 right: register
panel(c,146,26,137,84,5,ORANGE,LIGHT,ORANGE,12)
t="REGISTER - GET YOUR CUSTOMER NUMBER"; tf=fit(t,"Helvetica-Bold",X(125),19)
c.setFillColor(colors.white); c.setFont("Helvetica-Bold",tf); c.drawCentredString(X(146+137/2),X(104)-tf*0.35,t)
qr(c,X(151),X(41),X(52),REG_URL)
c.setFillColor(NAVY); c.setFont("Helvetica-Bold",9); c.drawCentredString(X(177),X(36),"SCAN TO REGISTER")
c.setFont("Helvetica",7.4); c.setFillColor(GREY); c.drawCentredString(X(177),X(31.5),"app.gronymultimedia.com/register")
st=ParagraphStyle("bl",fontName="Helvetica",fontSize=12.8,leading=15.6,leftIndent=10,bulletIndent=0,spaceAfter=5,textColor=NAVY)
y=X(95)
for txt in ["<b>Fill the form</b> at the link we send you on WhatsApp – or scan this code.",
            "You get your own <b>unique customer number</b>.",
            "It helps you <font color='#B34700'><b>win raffles</b></font> after a certain amount of work with us.",
            "We can <b>find your work quickly</b>."]:
    p=Paragraph(txt,st,bulletText="•"); w_,h_=p.wrap(X(72),1000); y-=h_; p.drawOn(c,X(208),y); y-=5
# bottom strip
c.setFillColor(NAVY); c.setFont("Helvetica-Bold",14); c.drawCentredString(PW/2,X(11.5),"GRONY MULTIMEDIA   •   ASSIN FOSO   •   NEAR GCB BANK")
c.setStrokeColor(NAVY); c.setLineWidth(4); c.roundRect(X(7),X(7),X(283),X(196),X(8),fill=0,stroke=1)
c.save()
