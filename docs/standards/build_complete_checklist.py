from reportlab.lib.pagesizes import A4
from reportlab.platypus import (BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer, KeepTogether, Table, TableStyle, NextPageTemplate, PageBreak, CondPageBreak)
from reportlab.platypus.flowables import Flowable
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.graphics.shapes import Drawing, Rect, String, Circle
import sys
FS=float(sys.argv[1]) if len(sys.argv)>1 else 4.8
S3=float(sys.argv[2]) if len(sys.argv)>2 else 0.54
OUT=sys.argv[3] if len(sys.argv)>3 else "Grony_Multimedia_Complete_Checklist.pdf"
W,H=A4; M=5*mm; G=2.4*mm; TOP=10.5*mm; BOT=6*mm
cols=4; cw=(W-2*M-(cols-1)*G)/cols; FW=W-2*M; UH=H-TOP-BOT
NAVY=colors.HexColor("#14213D"); ORANGE=colors.HexColor("#E85D04"); LIGHT=colors.HexColor("#FDF0E6"); GREEN=colors.HexColor("#2D6A4F"); LGREEN=colors.HexColor("#E8F3EC"); RED=colors.HexColor("#B42318"); PURPLE=colors.HexColor("#5B3A8C")
def pageend(c,doc):
    c.saveState()
    c.setFillColor(NAVY); c.rect(0,H-8*mm,W,8*mm,fill=1,stroke=0)
    c.setFillColor(colors.white); c.setFont("Helvetica-Bold",9.5); c.drawString(M,H-4.6*mm,"GRONY MULTIMEDIA – COMPLETE CHECKLIST (Master + Grony 2 station pack)")
    c.setFont("Helvetica",5.4); c.drawString(M,H-7*mm,"Tick each box • “How:” = the procedure • Red tags (G2-1) = problems to fix • Page 3: diagrams, printer table, location chart, done log • Staff only – not for customers' view")
    c.setFont("Helvetica",6.4); c.drawRightString(W-M,H-4.6*mm,"Date: ____________   Checked by: ____________")
    c.setFillColor(ORANGE); c.rect(0,H-9*mm,W,1*mm,fill=1,stroke=0)
    c.setFillColor(colors.grey); c.setFont("Helvetica",4.8)
    c.drawString(M,2.6*mm,"Keep it clean. Keep it fast. Keep it professional.  Send shop photos monthly so this stays in sync.")
    c.drawRightString(W-M,2.6*mm,f"Page {doc.page}")
    c.restoreState()
F4=[Frame(M+i*(cw+G),BOT,cw,UH,leftPadding=0,rightPadding=0,topPadding=0,bottomPadding=0) for i in range(cols)]
F1=[Frame(M,BOT,FW,UH,leftPadding=0,rightPadding=0,topPadding=0,bottomPadding=0)]
doc=BaseDocTemplate(OUT,pagesize=A4,title="Grony Multimedia – Complete Checklist",author="Grony Multimedia")
doc.addPageTemplates([PageTemplate(id="c4",frames=F4,onPageEnd=pageend),PageTemplate(id="c1",frames=F1,onPageEnd=pageend)])
body=ParagraphStyle("b",fontName="Helvetica",fontSize=FS,leading=FS*1.13,leftIndent=FS*0.9,firstLineIndent=-FS*0.9)
hs=ParagraphStyle("h",fontName="Helvetica-Bold",fontSize=FS+0.6,textColor=colors.white,leading=FS+1.8)
sub=ParagraphStyle("s",fontName="Helvetica-Oblique",fontSize=FS-0.6,textColor=colors.HexColor("#555555"),leading=FS,spaceAfter=0.8)
svs=ParagraphStyle("sv",fontName="Helvetica",fontSize=FS,leading=FS*1.13,spaceAfter=1.8)
story=[]; n=[0]
def HOW(t,f=None): return f'<br/><font size="{FS-0.7:.1f}" color="#666666"><i>How: {t}</i></font>'
def TAG(t): return ' <font color="#B42318"><b>(%s)</b></font>'%t
class Box(Flowable):
    def __init__(s,k=1): Flowable.__init__(s); s.k=k; s.sz=FS*0.82; s.width=s.sz+(k-1)*FS*1.25; s.height=s.sz
    def draw(s):
        c=s.canv; c.setStrokeColor(NAVY); c.setLineWidth(0.6)
        for i in range(s.k): c.rect(i*FS*1.25,0,s.sz,s.sz)
def head(t,bg=NAVY,w=None):
    tb=Table([[Paragraph(t,hs)]],colWidths=[w or cw])
    tb.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),bg),("LINEBEFORE",(0,0),(0,0),2,ORANGE if bg!=ORANGE else NAVY),("TOPPADDING",(0,0),(-1,-1),0.9),("BOTTOMPADDING",(0,0),(-1,-1),0.9),("LEFTPADDING",(0,0),(-1,-1),3)]))
    return tb
def check(title,note_,items,bg=NAVY,f=None,k=1,num=True,box=True):
    blk=[head(title,bg),Spacer(1,0.8)]
    if note_: blk.append(Paragraph(note_,sub))
    bw=FS*0.82+(k-1)*FS*1.25+FS*0.6
    for it in items:
        if box:
            if num: n[0]+=1
            pre=f"<b>{n[0]}.</b>&nbsp;" if num else ""
            t=Table([[Paragraph(pre+it,body),Box(k)]],colWidths=[cw-bw,bw])
            t.setStyle(TableStyle([("VALIGN",(0,0),(0,0),"TOP"),("VALIGN",(1,0),(1,0),"TOP"),("ALIGN",(1,0),(1,0),"RIGHT"),("LEFTPADDING",(0,0),(-1,-1),0),("RIGHTPADDING",(0,0),(-1,-1),0),("TOPPADDING",(0,0),(0,0),0),("TOPPADDING",(1,0),(1,0),0.5),("BOTTOMPADDING",(0,0),(-1,-1),0.9)]))
        else: t=Paragraph("•&nbsp;"+it,body)
        blk.append(t)
    story.append(KeepTogether(blk[:4])); story.extend(blk[4:]); story.append(Spacer(1,2.2))
def lines(title,k):
    st=ParagraphStyle("ln",fontName="Helvetica",fontSize=FS,leading=FS*1.9,textColor=colors.grey)
    story.append(KeepTogether([head(title),Paragraph("<br/>".join("%d. ________________________________"%i for i in range(1,k+1)),st)])); story.append(Spacer(1,2.2))
def note(t,bg=LIGHT,fg=colors.black,w=None):
    tb=Table([[Paragraph(t,ParagraphStyle("nt",fontName="Helvetica",fontSize=FS-0.3,leading=FS*1.12,textColor=fg))]],colWidths=[w or cw])
    tb.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),bg),("BOX",(0,0),(-1,-1),0.5,ORANGE),("TOPPADDING",(0,0),(-1,-1),1.5),("BOTTOMPADDING",(0,0),(-1,-1),1.5),("LEFTPADDING",(0,0),(-1,-1),3),("RIGHTPADDING",(0,0),(-1,-1),3)]))
    story.append(tb); story.append(Spacer(1,2.2))
def svc(title,steps,tip=None,bg=NAVY):
    hx='#'+bg.hexval()[2:]
    txt='<font color="%s"><b>%s:</b></font> '%(hx,title)+' '.join('<b>%d</b>&nbsp;%s'%(i,s) for i,s in enumerate(steps,1))
    if tip: txt+=' <font color="#666666"><i>Tip: %s</i></font>'%tip
    story.append(Paragraph(txt,svs))

class Card(Flowable):
    def __init__(s,letter,title,sub,use,safe,strip,hdr=NAVY):
        Flowable.__init__(s); s.w=cw; s.letter=letter; s.title=title; s.sub=sub; s.use=use; s.safe=safe; s.strip=strip; s.hdr=hdr; s._built=False
    def _build(s):
        if s._built: return
        ins=3; s.ins=ins; wid=s.w-2*ins-8; CS=FS-0.8; s.CS=CS
        st=ParagraphStyle("cs",fontName="Helvetica",fontSize=CS,leading=CS*1.17)
        stb=ParagraphStyle("csb",parent=st,fontName="Helvetica-Bold",textColor=RED)
        bl=ParagraphStyle("cbl",parent=st,leftIndent=5,firstLineIndent=-5)
        ht=Paragraph(s.title,ParagraphStyle("cht",fontName="Helvetica-Bold",fontSize=CS+1.2,leading=(CS+1.2)*1.1,textColor=NAVY))
        hsb=Paragraph(s.sub,ParagraphStyle("chs",parent=st,textColor=colors.HexColor("#555555"),fontSize=CS-0.5,leading=(CS-0.5)*1.1))
        hw=wid-24
        tw,th=ht.wrap(hw,1000); sw,sh=hsb.wrap(hw,1000)
        s.hh=max(20,th+sh+2); s.ht=(ht,th); s.hsb=(hsb,sh)
        parts=[Paragraph("<b>USE FOR:</b> "+s.use,st),Paragraph("SAFE USE",stb)]+[Paragraph("•&nbsp;"+t,bl) for t in s.safe]+[Paragraph("<b>Claude chat:</b> “__________________”",st),Paragraph("<b>Serial:</b> _________ <b>Technician:</b> _______",st)]
        s.parts=[]; tot=0
        for p in parts:
            pw,ph=p.wrap(wid,1000); s.parts.append((p,ph)); tot+=ph+0.7
        s.stripH=8
        s.h=ins+2+s.hh+2+tot+2+s.stripH+ins
        s.wid=wid; s._built=True
    def wrap(s,aw,ah):
        s._build(); return (s.w,s.h)
    def draw(s):
        s._build(); c=s.canv; w,h=s.w,s.h; ins=s.ins
        c.setDash(2,2); c.setStrokeColor(colors.HexColor("#999999")); c.setLineWidth(0.4); c.rect(0,0,w,h); c.setDash()
        c.setStrokeColor(s.hdr); c.setLineWidth(1.0); c.roundRect(ins,ins,w-2*ins,h-2*ins,3,fill=0,stroke=1)
        bx=ins+3; by=h-ins-2-20
        c.setFillColor(s.hdr); c.roundRect(bx,by,20,20,3,fill=1,stroke=0)
        c.setFillColor(colors.white); c.setFont("Helvetica-Bold",14 if len(s.letter)==1 else 11); c.drawCentredString(bx+10,by+5.5,s.letter)
        y=h-ins-2
        pt,th=s.ht; pt.drawOn(c,bx+24,y-th); ps,sh=s.hsb; ps.drawOn(c,bx+24,y-th-sh-1)
        y=y-s.hh-2
        for p,ph in s.parts:
            y-=ph; p.drawOn(c,ins+4,y); y-=0.7
        c.setFillColor(LIGHT); c.rect(ins+0.8,ins+0.8,w-2*ins-1.6,s.stripH,fill=1,stroke=0)
        from reportlab.pdfbase.pdfmetrics import stringWidth as _sw
        fs_=min(FS-1.6,(w-2*ins-6)/_sw(s.strip,"Helvetica-Bold",1))
        c.setFillColor(NAVY); c.setFont("Helvetica-Bold",fs_); c.drawCentredString(w/2,ins+2.8,s.strip)
f=FS
mtxt=open('build_checklist.py').read(); stxt=open('build_station_sheet.py').read()
FIXES=[("as on the Grony 2 sheet (p4)","as in the printers table (page 3)"),("Printer Register (p4)","printers table (page 3)"),("Grony 2's are on its station sheet, p5","Grony 2's are in its Grony 2 section"),
 ("Done Log (p5)","Done Log (page 3)"),("Location chart and Printer Register (p5)","Location chart and printers table (page 3)"),("location chart and Printer Register (p5)","location chart and printers table (page 3)"),("Printer Register (p5)","printers table (page 3)"),("Chief Mason, section I","Chief Mason, section I below")]
def seg(txt,a,b):
    t=txt[txt.index(a):txt.index(b)]
    for x,y in FIXES: t=t.replace(x,y)
    return t

# ---------- pages 1-2: master checklist (flows in 4 columns)

note("<b>HOW TO USE:</b> every line is a check – tick the box when done; fix it or report it to Joe. <b>RED MARKERS</b> are problems seen in the shop photos; tags (G2-1) match the Grony 2 diagram on page 3. Grony 1 and Grony 2 each run as a <b>standalone printing press</b> – only large format (Grony 5) means leaving your station. <b>SECTIONS:</b> shop-wide rules → Grony 1 → Grony 2 → Grony 3 → Grony 4 → Grony 5 → Grony 6 → Grony 7 &amp; 8 → shop-wide red markers, projects and apps → page 3 (diagrams, printers, location chart, done log). Each station reads on its own.")
mtxt=open('build_checklist.py').read(); stxt=open('build_station_sheet.py').read()
m_all=seg(mtxt,'check("A. OPENING','# ================= TABLES PAGE')
cut=m_all.index('check("I. SHOP WORKS')
part1=m_all[:cut]; part2=m_all[cut:]
capt={}
def _cap(key,title,note_,items,bg=None,k=1,**kw): capt[key]=items
part1=part1.replace('check("C. STATION CHECK','_cap("C","C. STATION CHECK').replace('check("RED MARKERS – FIX FIRST"','_cap("R","RED MARKERS – FIX FIRST"')
exec(part1,globals())
C7=capt["C"][:7]
def REDS(prefixes): return [it for it in capt["R"] if any(it.startswith('<b>'+p) for p in prefixes)]
def banner(title,sub,col):
    story.append(CondPageBreak(60))
    t=Table([[Paragraph(title,ParagraphStyle("bt",fontName="Helvetica-Bold",fontSize=FS+4,leading=FS+5,textColor=colors.white))],[Paragraph(sub,ParagraphStyle("bs",fontName="Helvetica",fontSize=FS-0.5,leading=FS,textColor=colors.HexColor("#FDF0E6")))]],colWidths=[cw])
    t.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),col),("TOPPADDING",(0,0),(-1,-1),1.2),("BOTTOMPADDING",(0,0),(-1,-1),1.2),("LEFTPADDING",(0,0),(-1,-1),3),("LINEBELOW",(0,-1),(-1,-1),1.6,ORANGE)]))
    story.append(t); story.append(Spacer(1,1.5))
def snote(t): story.append(Paragraph(t,sub)); 
C1=colors.HexColor('#C2410C'); C3=colors.HexColor('#0F766E'); C6=PURPLE; C78=colors.HexColor('#4B5563')

# ======== GRONY 1
banner("GRONY 1","Standalone printing press • window counter, right side • Samsung monitor • HP laptop",C1)
snote("<b>Seen in photos / GM app:</b> HP Elitebook 840 G8 (1); Samsung S22B350H monitor; HP black-and-white MFP (“HP BLACK AND WHITE 1”); an Epson printer (letter to confirm); grey photocopier; stapler; paper reams; wall “Staff note” sticker.")
check("GRONY 1 – DAILY STATION CHECKS","The station must run standalone.",C7+[
 "Laptop name is <b>Grony-1</b> and Bluetooth is on; for a customer sending a file by Bluetooth: Win+R → <b>fsquirt</b> → Receive files."+HOW("Settings → System → About → Rename this PC → Grony-1 (no spaces) → restart."),
 "<b>Company-number sticker</b> (A4 landscape) on the back of the Samsung monitor is flat, clean, facing customers; <b>weekly:</b> scan both QR codes (WhatsApp, registration) with a phone."+HOW("Grony_1_Monitor_Sticker_A4.pdf. The registration QR works only once the form is live."),
 "Wall <b>“Staff note”</b> sticker (keep WASTE PAPERS, CUSTOMER DOCUMENTS, TEMPLATES neat) is still in place.",
 "Every printer here has its letter sticker, driver, Claude chat and information sticker (printers table, page 3).",
 "No cable across the walkway; desk and printer tops clear of loose papers."+TAG("G1-1"),
],C1)
check("GRONY 1 – RED MARKERS","Fix, then tick.",REDS(["G1-"]),RED)
snote("<i>To complete this section, send close-ups of each Grony 1 printer (letter, model plate), the shelves or slots, the floor and the sockets.</i>")
story.append(Spacer(1,2))

# ======== GRONY 2
banner("GRONY 2","Standalone printing press • window counter, left side • Philips monitor • printers B, D, F, G, the HP black-and-white MFP and the laminator",NAVY)
snote("<b>GM app:</b> HP Elitebook 840 G8 (2) and “HP 880 A3 PRINTER B” (rename it to match the letters).")
check("GRONY 2 – DAILY STATION CHECKS","The station must run standalone. Other checks are in the shop-wide rules.",C7+[
 "<b>Pen on a rope</b> is on the customers' table, the pen writes and the rope is secure."+HOW("Tie the pen to the table edge with a short rope; replace it when it dries."),
 "<b>Company-number sticker</b> on the back of the Philips monitor is flat, clean and facing customers; <b>weekly:</b> scan its QR with a phone – it opens a WhatsApp chat with the company number."+HOW("Torn or faded? Print a new one (Grony_Company_Number_Sticker.pdf), laminate, tape all four edges, below the vents."),
 "<b>UPS</b> (TOP EDGE) is on with its <b>green light</b> showing; Epson printers <b>B, D, F, G</b> are on power and USB to this computer."+TAG("G2-1"),
 "<b>Laminator</b> is off and cool; nothing rests on or beside it. Ink tank and tubes dry (no leaks)."+TAG("G2-3, G2-4"),
 "I chose the right <b>letter</b> on screen for every job.",
 "Finished jobs wait in <b>CUSTOMERS' WORK TO BE COLLECTED</b>, each in an envelope marked with the GM number and name; collected jobs removed."+TAG("G2-8"),
 "Staplers, cutter, tapes, pens and scissors are back in their place after use.",
 "No socket overloaded; no loose paper near the wall socket or boards."+TAG("G2-1, G2-2"),
],NAVY)
check("GRONY 2 – SHOWCASE LIST","Check all are available (as printed on the sticker).",[
 "Cellotapes","Brown envelopes","Polythene bags – in a brown envelope","Stapler","Staple pins – in a brown envelope","Cuttings – in a brown envelope; a few ready, rubber-banded","Online forms – in a brown envelope","Scissors","Passport cutter","Passport envelopes – in a brown envelope",
],GREEN)
check("GRONY 2 – WHAT EACH PLACE HOLDS","BIN, WASTE PAPERS and PRINTING PAPERS are in the daily checks above.",[
 "<b>Tools shelf</b> – tapes, staplers, correction pens, markers, cutter, stamp.","<b>Glass showcase</b> – stock for sale; tools do not belong here."+TAG("G2-10"),"<b>CUSTOMERS' WORK TO BE COLLECTED</b> – finished jobs in marked envelopes only.",
],NAVY,box=False)
check("GRONY 2 – RED MARKERS","Numbers match the red circles on the Grony 2 diagram (page 3). Fix, then tick.",REDS(["G2-"]),RED)
story.append(head("GRONY 2 – EASY WAYS TO DO EVERY SERVICE (DRAFT: owner to confirm each method)",ORANGE,cw)); story.append(Spacer(1,1))
exec(seg(stxt,'svc("BEFORE EVERY JOB"','# ================= PAGE 4'),globals())
story.append(Spacer(1,2))
story.append(head("GRONY 2 – INVENTORY: properties, tools & materials",GREEN,cw)); story.append(Spacer(1,1))
story.append(Paragraph("Count each item, write the number, tick when present and in good condition; report anything missing to Joe. The GM app gives 190 of 197 properties no location – set each checked item's location to Grony 2 in the app.",sub))
exec(seg(stxt,'Q=" (qty ___)"','# ================= PAGE 5'),globals())
lines("GRONY 2 – NOTES: new problems seen (date, what, name)",3)
story.append(Spacer(1,2))
story.append(head("GRONY 2 – PRINTER & DEVICE INFORMATION STICKERS (cut out; stick on each printer)",ORANGE,cw)); story.append(Spacer(1,1))
story.append(Paragraph("Print at 100%. Fill the blanks (Claude chat name, serial no., technician). Safe-use lines are general – the owner confirms them for each model.",sub))
exec(seg(stxt,'STRIP="Keep on power','ct=Table('),globals())
for _c in cards: story.append(_c); story.append(Spacer(1,2))

# ======== GRONY 3
banner("GRONY 3","Work area in the inner shop • staff only • GM app: a laptop and “HP M880 PRINTER 1”",C3)
check("GRONY 3 – DAILY STATION CHECKS","Owner to confirm what else is here – send photos.",[
 "Customers kept out – staff only; floor clear; no cable across the path.",
 "The laptop and the printer here work; every printer has its letter sticker, driver, Claude chat and information sticker (printers table, page 3).",
 "Routers, modems, pen drives and memory cards not in use are kept here (or in the showcase) – counted, never left out.",
],C3)
# ======== GRONY 4
banner("GRONY 4","Storage and work area • staff only • GM app: a laptop / PC",C3)
check("GRONY 4 – DAILY STATION CHECKS","Owner to confirm what else is here – send photos.",[
 "The <b>path through Grony 4 is always clear</b>.",
 "All goods for storage are on the <b>Grony 4 shelf</b> – none on the floor.",
 "The holes in the Grony 4 floor and at the top of the gate are sealed (Chief Mason, section I).",
 "Routers, modems, pen drives and memory cards not in use are kept here (or in the showcase) after use.",
 "The laptop / PC works; any printer here has its letter sticker, driver, Claude chat and information sticker.",
],C3)
# ======== GRONY 5
banner("GRONY 5","Large format • XP600-head printer • comb binder • Dell PC + UPS",GREEN)
snote("<b>Seen in photos:</b> large-format printer, comb-binding machine, Dell PC and monitor with a UPS, Double A and Mambo paper, a wall of cables and chargers, a roll of paper towel, cartons and a cutting machine.")
check("GRONY 5 – DAILY STATION CHECKS","Standing up to come here is allowed; the assisting staff covers the counter.",[
 "Large-format printer is on and working; <b>test print</b> before a big job.",
 "Dell PC and monitor are on; the <b>UPS</b> is on and charging; no cable across the path.",
 "Comb-binding machine is clean and ready.",
 "Paper stock and the cable / charger wall are arranged in <b>like terms</b>; <b>no cartons or cloth on the work table</b>."+TAG("G5-1"),
 "Banners, stickers and finished jobs are handed over or put in the customer's envelope – never left on the floor.",
 "Ceiling plywood and the wiring above are dry and secure (mason and electrician)."+TAG("ALL-1"),
 "The large-format printer has its letter, driver, Claude chat and information sticker (printers table, page 3).",
],GREEN)
check("GRONY 5 – RED MARKERS","Fix, then tick.",REDS(["G5-"]),RED)
# ======== GRONY 6
banner("GRONY 6","Shop front • GM app: a light bulb",C6)
check("GRONY 6 – DAILY STATION CHECKS","Owner to confirm what else is here – send photos.",[
 "<b>No banners hang here</b> – the shop's front view must stay clear.",
 "The light bulb works; nothing blocks the gate or entrance (fire exit).",
],C6)
# ======== GRONY 7 & 8
banner("GRONY 7 & 8","Open fronts: side alley (7) and compound (8) • customer benches",C78)
check("GRONY 7 & 8 – DAILY STATION CHECKS","No banners at Grony 7.",[
 "<b>No banner</b> hangs across the opening at Grony 7; plywood and boards leaning outside are stored away."+TAG("G7-1"),
 "Customer benches and chairs are neat and clean.",
 "The passport sample poster is in good condition; no other organisation's advert on our walls."+TAG("G8-1"),
],C78)
check("GRONY 7 & 8 – RED MARKERS","Fix, then tick.",REDS(["G7-","G8-"]),RED)

# ======== SHOP-WIDE
story.append(head("SHOP-WIDE – RED MARKERS, PROJECTS & APPS",NAVY,cw)); story.append(Spacer(1,1.5))
check("SHOP-WIDE RED MARKERS","Problems that are not tied to one station.",REDS(["ALL-"]),RED)
exec(part2,globals())

# ---------- page 3: diagrams + tables (full width)
story.append(NextPageTemplate("c1")); story.append(PageBreak())
FS3=FS+0.1
cell=ParagraphStyle("c",fontName="Helvetica",fontSize=FS3,leading=FS3*1.12)
cellb=ParagraphStyle("cb",parent=cell,fontName="Helvetica-Bold",textColor=colors.white,fontSize=FS3-0.3,leading=FS3*1.05)
def scaled(dr,s):
    dd=Drawing(dr.width*s,dr.height*s,transform=[s,0,0,s,0,0])
    for o in list(dr.contents): dd.add(o)
    return dd
HD=236
_s=story; story=[]
exec(seg(stxt,'d=Drawing(FW,HD)','story.append(d)\n'),globals())
g2d=d
story=_s
lay=seg(mtxt,'dw=FW; dh_=330','story.append(d)\ndoc.build(story)').replace('dh_=330','dh_=215')
_s=story; story=[]
exec(lay,globals())
shopd=d
story=_s
story.append(head("GRONY 2 AT A GLANCE (draft from photos, not to scale) – red numbers = RED MARKERS G2-n",NAVY,FW)); story.append(Spacer(1,1.5))
story.append(scaled(g2d,S3))
story.append(Spacer(1,3))
story.append(head("SHOP LAYOUT (draft, not to scale) – red ! = see RED MARKERS",NAVY,FW)); story.append(Spacer(1,1.5))
story.append(scaled(shopd,S3*0.92))
story.append(Spacer(1,3))
class RBox(Flowable):
    def __init__(s,col=NAVY): Flowable.__init__(s); s.width=FS3*0.9; s.height=FS3*0.9; s.col=col
    def draw(s): s.canv.setStrokeColor(s.col); s.canv.setLineWidth(0.7); s.canv.rect(0,0,s.width,s.height)
def tbl(rows,widths,bg,zebra=None,pad=0.9):
    t=Table(rows,colWidths=[FW*w for w in widths],repeatRows=1)
    st=[("BACKGROUND",(0,0),(-1,0),bg),("GRID",(0,0),(-1,-1),0.3,colors.HexColor("#BBBBBB")),("VALIGN",(0,0),(-1,-1),"MIDDLE"),("TOPPADDING",(0,0),(-1,-1),pad),("BOTTOMPADDING",(0,0),(-1,-1),pad),("LEFTPADDING",(0,0),(-1,-1),2),("RIGHTPADDING",(0,0),(-1,-1),2)]
    if zebra: st.append(("ROWBACKGROUNDS",(0,1),(-1,-1),[colors.white,zebra]))
    t.setStyle(TableStyle(st)); return t
story.append(head("PRINTERS & DEVICES – driver, Claude chat (flag any printer with NO chat), information sticker, power + USB",ORANGE,FW)); story.append(Spacer(1,1.5))
P=[("A","(not yet seen)","","","",None),
 ("B","Epson EcoTank ET-2860","Grony 2","B - Epson ET-2860","Scan, copy, A4 colour. Wi-Fi + USB.",1),
 ("C","HP Color LaserJet MFP M880m (“HP COLOUR 1”)","Aisle","C - HP M880m RESERVED","RESERVED: extreme cases only; tell Joe; log it. USB. Service: D.A.L Divine Anchor Ltd.",1),
 ("D","Epson photo printer (Wi-Fi/Ethernet)","Grony 2","D - Epson Photo","Colour and photo prints. USB.",1),
 ("E","HP Color LaserJet MFP M880m (“HP COLOUR 2”)","Aisle","E - HP M880m RESERVED","RESERVED – as C. USB.",1),
 ("F","Epson (cream) + external ink tank","Grony 2","F - Epson Cream","Colour/photo prints (ink tank). USB. Do not move.",1),
 ("G","Epson EcoTank L8050","Grony 2","G - Epson L8050","Photos, passport photos. Wi-Fi + USB.",1),
 ("?","HP black-and-white MFP (desk)","Grony 2","(letter to confirm)","Bulk black-and-white copies. USB.",1),
 ("?","HP LaserJet 500 MFP (“HP B&W 1”)","Grony 1","(letter to confirm)","Bulk black-and-white copies. USB.",1),
 ("–","Canon imageRUNNER ADV C5045i (copier)","","","Copier. USB.",1),
 ("–","Large-format printer (XP600 head)","Grony 5","","Banners, posters, stickers.",1),
 ("–","Laminator","Grony 2","n/a","Hot rollers; off and unplugged at closing.",0)]
hdr=[Paragraph(x,cellb) for x in ["LTR","PRINTER / DEVICE","WHERE","NAME ON SCREEN (type exactly)","USE / RULE","DRIVER","CLAUDE CHAT NAME (write it)","NO CHAT – FLAG","STICKER","POWER + USB"]]
rows=[hdr]
for l,nm,wh,name,rule,drv in P:
    rows.append([Paragraph("<b>%s</b>"%l,cell),Paragraph(nm,cell),Paragraph(wh,cell),Paragraph("<b>%s</b>"%name if name else "",cell),Paragraph(rule,cell),
        (Paragraph("n/a",cell) if drv==0 else RBox()) if drv is not None else RBox(),"",RBox(RED),RBox(),RBox()])
pt=tbl(rows,[0.03,0.2,0.055,0.13,0.2,0.05,0.14,0.06,0.06,0.075],ORANGE,LIGHT)
pt.setStyle(TableStyle([("ALIGN",(5,1),(5,-1),"CENTER"),("ALIGN",(7,1),(-1,-1),"CENTER"),("LINEBELOW",(6,1),(6,-1),0.5,colors.HexColor("#999999"))]))
story.append(pt); story.append(Spacer(1,3))
story.append(head("LOCATION CHART – Grony 1 & Grony 2 (write the location in pencil; tick when present; report anything missing)",NAVY,FW)); story.append(Spacer(1,1.5))
exec(seg(mtxt,'items=[("Laptop + charger"','# two side-by-side halves'),globals())
per=(len(items)+2)//3
hdl=[Paragraph(x,cellb) for x in ["ITEM","GRONY 1","OK","GRONY 2","OK"]]
rows=[hdl*3]
for i in range(per):
    r=[]
    for j in range(3):
        k=i+j*per
        it=items[k] if k<len(items) else ("","","")
        r+=[Paragraph(it[0],cell),Paragraph(it[1],cell),"",Paragraph(it[2],cell),""]
    rows.append(r)
story.append(tbl(rows,[0.13,0.09,0.0165,0.09,0.0165]*3,NAVY,LIGHT,pad=1.0)); story.append(Spacer(1,3))
story.append(head("DONE LOG – already completed: do NOT repeat, only re-check as shown. Add each finished one-off task here.",GREEN,FW)); story.append(Spacer(1,1.5))
exec(seg(mtxt,'done=[(','\nrows=[dh]'),globals())
dh=[Paragraph(x,cellb) for x in ["DONE","DATE","BY","RE-CHECK","LAST CHECK"]]
rows=[dh]+[[Paragraph(a,cell),"","",Paragraph(b,cell),""] for a,b in done]+[[Paragraph("",cell),"","","",""] for _ in range(3)]
story.append(tbl(rows,[0.45,0.1,0.12,0.2,0.13],GREEN,LGREEN,pad=1.0))
doc.build(story)
from pypdf import PdfReader
print(len(PdfReader(OUT).pages))
