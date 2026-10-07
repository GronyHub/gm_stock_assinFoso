from reportlab.lib.pagesizes import A4
from reportlab.platypus import FrameBreak, BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer, KeepTogether, Table, TableStyle, NextPageTemplate, PageBreak
from reportlab.platypus.flowables import Flowable
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.graphics.shapes import Drawing, Rect, String, Circle
import sys
F1=float(sys.argv[1]) if len(sys.argv)>1 else 9.4
F2=float(sys.argv[2]) if len(sys.argv)>2 else 8.3
W,H=A4; M=8*mm; G=4*mm; TOP=17*mm; BOT=9*mm
cols=3; cw=(W-2*M-(cols-1)*G)/cols; FW=W-2*M; UH=H-TOP-BOT
NAVY=colors.HexColor("#14213D"); ORANGE=colors.HexColor("#E85D04"); LIGHT=colors.HexColor("#FDF0E6"); GREEN=colors.HexColor("#2D6A4F"); RED=colors.HexColor("#B42318")
STATION="GRONY 2"
def pageend(c,doc):
    c.saveState()
    c.setFillColor(NAVY); c.rect(0,H-13*mm,W,13*mm,fill=1,stroke=0)
    c.setFillColor(colors.white); c.setFont("Helvetica-Bold",13)
    c.drawString(M,H-8.2*mm,STATION+" – STATION SHEET")
    c.setFont("Helvetica",7.2); c.drawString(M,H-11.4*mm,"Use only at "+STATION.title()+" • Tick when done • Fix it or tell Joe • Red tags = p2 • Easy methods = p3 • Drivers, inventory = p4 • Info stickers = p5 • Not for customers' view")
    c.setFont("Helvetica",8); c.drawRightString(W-M,H-8.2*mm,"Date: ____________   Checked by: ____________")
    c.setFillColor(ORANGE); c.rect(0,H-14*mm,W,1*mm,fill=1,stroke=0)
    c.setFillColor(colors.grey); c.setFont("Helvetica",6.5)
    c.drawString(M,4.5*mm,"General rules, social media, apps and projects are in the Master Checklist. Send new photos of this station and more red markers get added.")
    c.drawRightString(W-M,4.5*mm,f"Page {doc.page}")
    c.restoreState()
HD=236; TOPH=14.4+3+HD+2
F3=[Frame(M+i*(cw+G),BOT,cw,UH,leftPadding=0,rightPadding=0,topPadding=0,bottomPadding=0) for i in range(3)]
FT=[Frame(M,H-TOP-TOPH,FW,TOPH,leftPadding=0,rightPadding=0,topPadding=0,bottomPadding=0)]+[Frame(M+i*(cw+G),BOT,cw,UH-TOPH-4,leftPadding=0,rightPadding=0,topPadding=0,bottomPadding=0) for i in range(3)]
doc=BaseDocTemplate("Grony_2_Station_Sheet.pdf",pagesize=A4,title="Grony 2 – Station Sheet",author="Grony Multimedia")
B3=29
F33=[Frame(M,H-TOP-B3,FW,B3,leftPadding=0,rightPadding=0,topPadding=0,bottomPadding=0)]+[Frame(M+i*(cw+G),BOT,cw,UH-B3-4,leftPadding=0,rightPadding=0,topPadding=0,bottomPadding=0) for i in range(3)]
doc.addPageTemplates([PageTemplate(id="p1",frames=F3,onPageEnd=pageend),PageTemplate(id="p2",frames=FT,onPageEnd=pageend),PageTemplate(id="p3",frames=F33,onPageEnd=pageend)])
def mk(fs): return ParagraphStyle("b%s"%fs,fontName="Helvetica",fontSize=fs,leading=fs*1.2,leftIndent=11,firstLineIndent=-11)
def hsty(fs): return ParagraphStyle("h%s"%fs,fontName="Helvetica-Bold",fontSize=fs+0.6,textColor=colors.white,leading=fs+2.4)
def substy(fs): return ParagraphStyle("s%s"%fs,fontName="Helvetica-Oblique",fontSize=fs-0.8,textColor=colors.HexColor("#555555"),leading=fs,spaceAfter=1.5)
story=[]; n=[0]
def HOW(t,fs): return f'<br/><font size="{fs-1.1}" color="#666666"><i>How: {t}</i></font>'
def TAG(t): return f' <font color="#B42318"><b>({t})</b></font>'
class Box(Flowable):
    def __init__(s): Flowable.__init__(s); s.width=8; s.height=8
    def draw(s):
        c=s.canv; c.setStrokeColor(NAVY); c.setLineWidth(0.9); c.rect(0,0,8,8)
def head(t,bg,fs,w=None):
    tb=Table([[Paragraph(t,hsty(fs))]],colWidths=[w or cw])
    tb.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),bg),("LINEBEFORE",(0,0),(0,0),3,ORANGE if bg!=ORANGE else NAVY),("TOPPADDING",(0,0),(-1,-1),1.8),("BOTTOMPADDING",(0,0),(-1,-1),1.8),("LEFTPADDING",(0,0),(-1,-1),4)]))
    return tb
def check(title,note,items,bg,fs,box=True,num=True):
    blk=[head(title,bg,fs),Spacer(1,1.5)]
    if note: blk.append(Paragraph(note,substy(fs)))
    bw=12 if box else 0
    for it in items:
        if box:
            if num: n[0]+=1
            pre=f"<b>{n[0]}.</b>&nbsp;" if num else ""
            t=Table([[Paragraph(pre+it,mk(fs)),Box()]],colWidths=[cw-bw,bw])
            t.setStyle(TableStyle([("VALIGN",(0,0),(0,0),"TOP"),("VALIGN",(1,0),(1,0),"TOP"),("ALIGN",(1,0),(1,0),"RIGHT"),("LEFTPADDING",(0,0),(-1,-1),0),("RIGHTPADDING",(0,0),(-1,-1),0),("TOPPADDING",(0,0),(0,0),0),("TOPPADDING",(1,0),(1,0),1),("BOTTOMPADDING",(0,0),(-1,-1),1.8)]))
        else:
            t=Paragraph("•&nbsp;"+it,mk(fs))
        blk.append(t)
        if not box: blk.append(Spacer(1,2))
    story.append(KeepTogether(blk[:5])); story.extend(blk[5:]); story.append(Spacer(1,4))

# ============ PAGE 1
f=F1
check("1. OPENING – at Grony 2","Before the first customer.",[
 "Grony 2 laptop on; wallpaper solid black; I'm in <b>my own Chrome profile</b>.",
 "<b>UPS</b> (TOP EDGE) on with its green light showing; Epson printers <b>B, D, F, G</b> on power.",
 "Every printer here is on <b>power and USB</b> to this computer – even the ones not in use."+HOW("Never unplug a printer to free a socket or cable.",f),
 "Each printer's <b>letter</b> matches its name on the screen."+HOW("Settings → Printers &amp; scanners → printer → Printer properties → General → type the name from the table on page 4 exactly, e.g. “B - Epson ET-2860”, then print a test page.",f),
 "Extension boards are <b>off the floor</b>; no board plugged into another; <b>no cable across the walkway</b> (wires may pass under the printers)."+TAG("G2-1"),
 "Laminator is off and cool; nothing rests on or beside it."+TAG("G2-4"),
 "Floor swept; printers dusted with rag and brush; ink tank and tubes dry."+TAG("G2-3"),
 "<b>Pen on a rope</b> is set up on the customers' table, the pen writes and the rope is secure."+HOW("Tie the pen to the table edge with a short rope so customers can write but cannot take it. Pen dry? Replace it.",f),
],NAVY,f)
check("2. DURING THE DAY","Ask yourself these all day, not once.",[
 "I used printers B, D, F and G first. The <b>HP M880m (C, E)</b> stay reserved – extreme cases only, and Joe told."+HOW("Log the date, job and pages. Afterwards leave it on standby, plugged in, on USB.",f),
 "I chose the right <b>letter</b> on screen for every job.",
 "Test and spoilt prints go in <b>WASTE PAPERS</b> only. A full document or customer paper is torn into the <b>BIN</b>."+TAG("G2-6"),
 "<b>PRINTING PAPERS</b> hold clean A4, 4×6, 5×7 only; the ream stays in its wrapper, upright. A3 flat – <b>never folded</b>."+TAG("G2-7"),
 "Finished jobs wait in <b>CUSTOMERS' WORK TO BE COLLECTED</b>, each in an envelope marked with the GM number and name; collected jobs removed."+TAG("G2-8"),
 "No notes, papers or bags on printer lids or tops; instructions pasted on a label board.",
 "Staplers, cutter, tapes, pens and scissors back in their place after use.",
 "Faulty machine or item: on the lower shelf of the Boys' showcase with a note (item, fault, date, name); Joe told the same day.",
 "Customer details private; files only in their GM-number folder. Replies, receipts and payments go in the customer's <b>WhatsApp chat</b>; no personal numbers given.",
 "<b>Complaints</b> (customer or staff) are written on the log on the <b>left of the glass showcase</b>, with date and details.",
 "Many files or copies: I checked the <b>quality and size of the first printout</b> before printing the rest.",
 "<b>Power cut:</b> UPS off when there is no work, on only when needed; back on charge when power returns.",
],NAVY,f)
check("3. CLOSING – at Grony 2","Before locking up.",[
 "<b>Laminator</b> off, unplugged and cooled."+TAG("G2-4"),
 "<b>Bin</b> emptied; WASTE PAPERS sorted – no full documents left."+TAG("G2-5, G2-6"),
 "Desktop, Documents and Downloads empty on the Grony 2 laptop.",
 "Printers off at their button but <b>still plugged in and on USB</b>; UPS charging.",
 "No socket overloaded; no loose paper near the wall socket or boards."+TAG("G2-1, G2-2"),
 "Pen drives, cards and routers back in the showcase or Grony 3/4.",
 "Everything needed for printing within reach; anything missing reported to Joe.",
],ORANGE,f)
check("4. GRONY 2 SHOWCASE LIST","Check all are available (as printed on the sticker).",[
 "Cellotapes","Brown envelopes","Polythene bags – in a brown envelope","Stapler","Staple pins – in a brown envelope",
 "Cuttings – in a brown envelope; a few ready, kept with rubber bands","Online forms – in a brown envelope","Scissors","Passport cutter","Passport envelopes – in a brown envelope",
],GREEN,f)
check("5. COMPANY NUMBER STICKER","On the back of the Grony 2 monitor – customers send their work on WhatsApp to this number.",[
 "Sticker is on the back of the monitor, <b>flat, clean and facing customers</b>; the number reads clearly from the customer side."+HOW("Torn, faded or peeling? Print a new one (Grony_Company_Number_Sticker.pdf), laminate, tape all four edges.",f)+TAG("G2-13"),
 "<b>Weekly:</b> I scanned the QR with my phone camera and it opened a WhatsApp chat with the company number."+HOW("Camera app → point at the QR → tap the link → WhatsApp opens.",f),
 "A customer who asks where to send work is shown the sticker and asked to send files on WhatsApp.",
],NAVY,f)

# ============ PAGE 2
story.append(NextPageTemplate("p2")); story.append(PageBreak())
f=F2
story.append(head("GRONY 2 AT A GLANCE – draft from photos, not to scale. Red numbers = RED MARKERS list below.",NAVY,f,FW))
story.append(Spacer(1,3))
d=Drawing(FW,HD)
def rbox(x,y,w,h,lines,fill="#E8F0FA",stroke=NAVY,fs=7,dash=False):
    r=Rect(x,y,w,h,fillColor=colors.HexColor(fill) if isinstance(fill,str) else fill,strokeColor=stroke,strokeWidth=0.8)
    if dash: r.strokeDashArray=[3,2]
    d.add(r)
    for i,l in enumerate(lines):
        d.add(String(x+w/2,y+h-9-i*(fs+1.6),l,fontName="Helvetica-Bold" if i==0 else "Helvetica",fontSize=fs if i==0 else fs-0.7,fillColor=colors.HexColor("#14213D") if i==0 else colors.HexColor("#333333"),textAnchor="middle"))
def dot(x,y,k):
    d.add(Circle(x,y,6.6,fillColor=RED,strokeColor=colors.white,strokeWidth=0.8))
    d.add(String(x,y-2.6,str(k),fontName="Helvetica-Bold",fontSize=7.6,fillColor=colors.white,textAnchor="middle"))
GR=colors.HexColor("#999999")
rbox(0,176,400,56,["GLASS SHOWCASE – stock for sale + loose tools","sticker: “GRONY 2 ITEMS IN THIS SHOWCASE”","protective film still on the glass"],fill="#F4F4F4",stroke=GR)
for (x,y,w,h) in [(0,28,92,142),(98,28,162,142),(264,28,136,142)]:
    d.add(Rect(x,y,w,h,fillColor=None,strokeColor=GR,strokeWidth=0.6))
rbox(4,126,84,38,["LAMINATOR","hot – heater switch"],fill="#FDE9C8",stroke=ORANGE)
rbox(8,34,76,62,["BIN (ALL RUBBISH)","open cardboard box","plastic + paper"],fill="#EEEEEE",stroke=GR)
rbox(102,120,76,44,["D","Epson photo","note on lid"])
rbox(184,120,72,44,["UPS","(TOP EDGE)"],fill="#EEEEEE",stroke=GR)
rbox(230,76,28,38,["ink","tank +","tubes"],fill="#EEEEEE",stroke=GR,fs=6.2)
rbox(102,74,124,40,["F","Epson (cream)"])
rbox(108,34,104,34,["G","EcoTank L8050"])
rbox(300,124,94,40,["B","Epson ET-2860"])
rbox(268,124,28,40,["brown","env."],fill=LIGHT,stroke=ORANGE,fs=6.4)
rbox(268,100,128,20,["tools shelf + wall socket"],fill=LIGHT,stroke=ORANGE,fs=6.8)
rbox(268,34,40,56,["CUSTOMERS'","WORK"],fill=LIGHT,stroke=ORANGE,fs=6)
rbox(312,34,40,56,["PRINTING","PAPERS"],fill=LIGHT,stroke=ORANGE,fs=6)
rbox(356,34,40,56,["WASTE","PAPERS"],fill=LIGHT,stroke=ORANGE,fs=6)
rbox(412,106,138,62,["DESK (from photos)","laptop, monitor, HP B&W MFP","number sticker: monitor back"],fill="#FFFFFF",stroke=GR,dash=True)
rbox(412,30,138,70,["C and E","HP M880m (aisle)","on castors, HP COLOUR 1 / 2 tapes"],fs=7)
d.add(Rect(0,0,FW,22,fillColor=colors.HexColor("#E6E6E6"),strokeColor=None))
d.add(String(FW/2,8,"FLOOR – extension boards and loose cables",fontName="Helvetica-Bold",fontSize=7.4,fillColor=colors.HexColor("#333333"),textAnchor="middle"))
for (x,y,k) in [(22,212,10),(378,212,11),(82,158,4),(80,40,5),(250,81,3),(238,52,9),(388,110,2),(303,40,8),(347,40,7),(391,40,6),(540,92,12),(540,157,13),(420,38,1),(60,11,1),(140,11,1),(480,11,1)]:
    dot(x,y,k)
story.append(d)

check("RED MARKERS – GRONY 2","Numbers match the red circles. Fix, then tick.",[
 "<b>G2-1</b> Extension boards and cables on the floor by printers C, E and the shelf units."+HOW("One board per station, fixed off the floor, plugged straight into the wall. No board into another. Cables bundled off the walkway.",f),
 "<b>G2-2</b> Wall socket on the wooden unit, cables dangling right above the stationery."+HOW("Electrician secures socket and cables; keep paper and tapes away from it.",f),
 "<b>G2-3</b> External ink tank (CISS) and tubes loose beside the UPS."+HOW("Tanks in a tray away from the UPS; secure the tubes; wipe any spill.",f),
 "<b>G2-4</b> Hot laminator on the shelf directly above the bin."+HOW("Off and unplugged at closing; cool before leaving; keep paper and bin away.",f),
 "<b>G2-5</b> Bin is an open cardboard box of plastic and paper, with a second box under it."+HOW("Proper lidded bin, emptied daily at closing.",f),
 "<b>G2-6</b> WASTE PAPERS slot overflowing, with full printed documents inside."+HOW("Empty daily; tear documents into the BIN; test prints only.",f),
 "<b>G2-7</b> PRINTING PAPERS slot: ream torn open, wrapper crumpled, sheets spilling."+HOW("Keep the ream in its wrapper, upright and flat.",f),
 "<b>G2-8</b> CUSTOMERS' WORK slot: prints and posters stuffed in loose."+HOW("Each job in an envelope marked with GM number and name; remove collected jobs daily; never fold A3.",f),
 "<b>G2-9</b> Printers D, F and G stacked on one thin shelf."+HOW("Keep vents uncovered and tops clear; check the shelf takes the weight.",f),
 "<b>G2-10</b> Glass showcase: stock mixed with loose tools and wires; film still on the glass."+HOW("Sort stock by type; tools into a toolbox; peel the film.",f),
 "<b>G2-11</b> Showcase sticker lists work items, but they sit on the wooden unit."+HOW("Move the sticker to the unit, or the items into the showcase.",f),
 "<b>G2-12</b> Faded tape labels and torn sticker residue on the HP printers."+HOW("Clean off; one permanent info sticker per printer (letter, model, rule).",f),
 "<b>G2-13</b> Paper company-number sticker is taped across the top vent slots of the Philips monitor."+HOW("Fix the new sticker on the flat back panel below the vents; tape all four edges; keep vents clear.",f),
],RED,f,num=False)
check("PRINTERS AT GRONY 2","Tick when its information sticker is written and a snapshot sent to the owner.",[
 "<b>B</b> Epson EcoTank ET-2860 – Wi-Fi + USB – top of the wooden unit.",
 "<b>C</b> HP Color LaserJet Managed flow MFP M880m (“HP COLOUR 1”) – aisle, on castors. <b>Reserved</b> – owner to confirm which M880. Service sticker: D.A.L Divine Anchor Ltd.",
 "<b>D</b> Epson photo printer (Wi-Fi/Ethernet) – top of the white shelf, beside the UPS.",
 "<b>E</b> HP Color LaserJet Managed flow MFP M880m (“HP COLOUR 2”) – aisle. <b>Reserved</b> – owner to confirm which M880.",
 "<b>F</b> Epson (cream) with external ink tank – middle shelf.",
 "<b>G</b> Epson EcoTank L8050 – bottom shelf.",
 "<b>A</b> Not yet seen – tell Claude where it is.",
],ORANGE,f,num=False)
check("LABELLED PLACES","What each place holds – only that.",[
 "<b>BIN (ALL RUBBISH)</b> – lower-left shelf. Rubbish and unusable paper; official documents torn first.",
 "<b>WASTE PAPERS (for test prints)</b> – test and spoilt prints only.",
 "<b>PRINTING PAPERS (A4 sheet, 4×6, 5×7, etc.)</b> – clean paper only.",
 "<b>CUSTOMERS' WORK TO BE COLLECTED</b> – finished jobs in marked envelopes.",
 "<b>Tools shelf</b> – tapes, staplers, correction pens, markers, cutter, stamp.",
 "<b>Glass showcase</b> – stock for sale; tools do not belong here.",
],NAVY,f,box=False)
story.append(FrameBreak())
lines=ParagraphStyle("ln",fontName="Helvetica",fontSize=f+1,leading=(f+1)*2.1,textColor=colors.grey)
story.append(head("NOTES – new problems seen at Grony 2",NAVY,f))
story.append(Spacer(1,2))
story.append(Paragraph("Write the date, what you saw and your name. Send a photo to the owner so it becomes a red marker.",substy(f)))
story.append(Paragraph("<br/>".join("_"*34 for _ in range(14)),lines))
story.append(NextPageTemplate("p3")); story.append(PageBreak())
f=8.8
bn=Table([[Paragraph("EASY WAYS TO DO EVERY SERVICE AT GRONY 2 – <b>DRAFT: owner to confirm each method before it is posted.</b> Claude chat names are in quotes.",ParagraphStyle("bn",fontName="Helvetica-Bold",fontSize=8.4,leading=10,textColor=colors.white))]],colWidths=[FW])
bn.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),ORANGE),("TOPPADDING",(0,0),(-1,-1),3),("BOTTOMPADDING",(0,0),(-1,-1),3),("LEFTPADDING",(0,0),(-1,-1),6)]))
story.append(bn); story.append(FrameBreak())
sv=ParagraphStyle("sv",fontName="Helvetica",fontSize=f,leading=f*1.2,leftIndent=11,firstLineIndent=-11,spaceAfter=1.8)
tp=ParagraphStyle("tp",fontName="Helvetica-Oblique",fontSize=f-1,leading=(f-1)*1.2,textColor=colors.HexColor("#666666"),spaceAfter=1)
def svc(title,steps,tip=None,bg=NAVY):
    blk=[head(title,bg,f),Spacer(1,2)]
    for i,t in enumerate(steps,1): blk.append(Paragraph(f"<b>{i}.</b>&nbsp;{t}",sv))
    if tip: blk.append(Paragraph("Tip: "+tip,tp))
    story.append(KeepTogether(blk)); story.append(Spacer(1,5))
svc("BEFORE EVERY JOB",[
 "New customer? Make sure they are registered and have a <b>GM number</b>; open their GM folder.",
 "Save every file in that GM folder – never on the Desktop or Downloads.",
 "Choose the printer by its <b>letter</b> (see “Which printer?”).",
 "Quote from the price list; record the sale in <b>Live Sale</b> (WIC on) before handing over. Replies, receipts and payments go in the customer's WhatsApp chat – company number only.",
],bg=GREEN)
svc("WHICH PRINTER?",[
 "<b>B</b> – scanning, copying, quick A4 colour.",
 "<b>G</b> (or <b>D</b>) – photos and passport photos.",
 "<b>HP black-and-white MFP</b> – black-and-white copies and documents.",
 "A3, or anything else: ask Joe first – the <b>HP M880m (C, E)</b> is reserved for extreme cases.",
 "Large format, binding, stickers: <b>Grony 5</b>.",
],bg=ORANGE)
svc("TYPING – from handwriting",[
 "Lay the pages flat on printer <b>B</b> and scan them (Epson Scan 2, 300 dpi) into the customer's GM folder.",
 "Open the Claude chat <b>“Handwritten transcript”</b>, upload the scan and ask for a <b>Word document</b>.",
 "Check every name, date and number against the handwriting; ask the customer about words you cannot read.",
 "Open it in Word, fix the layout, save it in the GM folder.",
 "Print by letter and hand over with the original.",
],tip="straight, flat scans transcribe best.")
svc("TYPING – from a file or message",[
 "Save the customer's file in the GM folder; <b>Save As</b> a new name – never change the original.",
 "Edit in Word (PDF: open it in Word, or ask Claude to convert it).",
 "Check, print by letter, save.",
])
svc("CV · LETTER · FORM · INVITATION",[
 "Get the customer's details (WhatsApp or in person); ask for anything missing.",
 "Paste them into the matching Claude chat and ask for a <b>Word document</b> in a clean layout.",
 "Check spelling, names, dates and phone numbers with the customer.",
 "Print on B (colour) or the HP black-and-white MFP; save the Word file in the GM folder.",
])
svc("SCAN",[
 "Place the document flat on <b>B</b>; scan to PDF (Epson Scan 2).",
 "Name it with the GM number and what it is, e.g. “GM0024 – results slip”.",
 "Send on WhatsApp or email if asked; keep a copy in the GM folder.",
])
svc("PHOTOCOPY",[
 "Few or colour copies: copy on <b>B</b>. Many black-and-white copies: the HP black-and-white MFP.",
 "Make one copy and check its <b>quality and size</b>, then the rest. Spoilt copies go in WASTE PAPERS.",
 "Staple or sort; hand over with the original.",
])
svc("PRINT A CUSTOMER'S FILE",[
 "WhatsApp file: save it from the company WhatsApp on the laptop into the GM folder. Pen drive: scan it with Windows Security, copy the file in, give the drive back.",
 "Open it; check page size, orientation and page count.",
 "Print preview, pick the printer by letter; print the <b>first page</b> and check its quality and size before the rest.",
 "Put the job in a marked envelope in CUSTOMERS' WORK.",
])
svc("PHOTO PRINTS",[
 "Photo paper in <b>G</b> (or D); make sure the paper size on screen matches (4×6, 5×7…).",
 "Open the photo and print at best photo quality, no scaling.",
 "Let it dry before touching; hand over in an envelope.",
])
svc("PASSPORT PHOTOS",[
 "Plain background, face straight, shoulders level; stand to snap.",
 "Size and crop with the shop's passport photo editor.",
 "Print on 4×6 photo paper (G or D).",
 "Cut with the <b>passport cutter</b>; hand over in a passport envelope.",
])
svc("LAMINATION",[
 "Switch the laminator <b>ON</b>, set the heater and wait for the ready light.",
 "Put the document inside the right-size pouch; feed the sealed edge first.",
 "Catch it and lay it flat to cool.",
 "At closing: switch off, unplug, let it cool.",
])
svc("DESIGN – poster, flyer, invitation, ID card",[
 "In Claude (design chat) say what it is, the size, the exact wording and colours; ask for it in Canva.",
 "Review it and ask for changes in plain words until it is right.",
 "Download the PDF; print a test on B; check spelling and numbers with the customer.",
 "Bigger than A3: take it to <b>Grony 5</b>.",
])
svc("ONLINE ADMISSION APPLICATION",[
 "Check the portal is open and what it needs (documents, photo, results).",
 "Scan the applicant's documents on <b>B</b> into their GM folder.",
 "Fill the form with the applicant beside you; they check every detail <b>before</b> you submit. Never save their password in the browser.",
 "Print the confirmation or payment slip; record the sale in Live Sale.",
])
svc("LARGE FORMAT · BINDING · STICKERS",[
 "Go to Grony 5 with the file – the assisting staff covers your counter and fetches what you cannot reach.",
 "Bring the finished job back to the customer's envelope or hand it over.",
])
svc("A PRINTER FAILS MID-JOB",[
 "Stop sending the job; clear a simple jam.",
 "Open that printer's <b>Claude chat</b> (instructions + drivers) and follow it. No chat? Flag it to the owner.",
 "Send it again on another letter (not the M880m unless extreme).",
 "Faulty machine: lower shelf of the Boys' showcase with a note; tell Joe.",
],bg=RED)

# ================= PAGE 4: setup table + inventory
from reportlab.platypus import FrameBreak as _FB
story.append(NextPageTemplate("p4")); story.append(PageBreak())
f=8.4
cellp=ParagraphStyle("cp",fontName="Helvetica",fontSize=7.8,leading=9.2)
cellh=ParagraphStyle("ch",parent=cellp,fontName="Helvetica-Bold",textColor=colors.white,alignment=1,fontSize=7.2,leading=8.4)
cellhl=ParagraphStyle("chl",parent=cellh,alignment=0)
class RBox(Flowable):
    def __init__(s,col=NAVY): Flowable.__init__(s); s.width=9; s.height=9; s.col=col
    def draw(s):
        c=s.canv; c.setStrokeColor(s.col); c.setLineWidth(1.0); c.rect(0,0,9,9)
NAMES={"B":"B - Epson ET-2860","C":"C - HP M880m RESERVED","D":"D - Epson Photo","E":"E - HP M880m RESERVED","F":"F - Epson Cream","G":"G - Epson L8050","?":"(letter to confirm)","–":"n/a"}
setup_rows=[
 ("B","Epson EcoTank ET-2860 – A4 colour, scan/copy, Wi-Fi"),
 ("C","HP Color LaserJet MFP M880m – RESERVED"),
 ("D","Epson photo printer (Wi-Fi/Ethernet)"),
 ("E","HP Color LaserJet MFP M880m – RESERVED"),
 ("F","Epson (cream) with external ink tank"),
 ("G","Epson EcoTank L8050 – A4 photo, 6 colours"),
 ("?","HP black-and-white MFP (desk) – letter to confirm"),
 ("–","Laminator (device – no driver)"),
]
hdr=[Paragraph("LTR",cellh),Paragraph("PRINTER / DEVICE",cellhl),Paragraph("NAME ON SCREEN (type exactly)",cellhl),Paragraph("DRIVER INSTALLED",cellh),Paragraph("CLAUDE CHAT NAME (write it)",cellhl),Paragraph("NO CHAT – FLAG",cellh),Paragraph("INFO STICKER ON IT",cellh),Paragraph("POWER + USB ON",cellh)]
rows=[hdr]
for l,nm in setup_rows:
    na = nm.startswith("Laminator")
    rows.append([Paragraph("<b>%s</b>"%l,ParagraphStyle("lt",parent=cellp,alignment=1,fontSize=10)),Paragraph(nm,cellp),Paragraph("<b>%s</b>"%NAMES[l],cellp),
                 Paragraph("n/a",ParagraphStyle("na",parent=cellp,alignment=1)) if na else RBox(),"",RBox(RED),RBox(),RBox()])
tw=[30,120,96,58,92,48,52,50]
sc=FW/sum(tw); tw=[x*sc for x in tw]
setup=Table(rows,colWidths=tw,rowHeights=[26]+[22]*len(setup_rows))
setup.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,0),NAVY),("GRID",(0,0),(-1,-1),0.4,colors.HexColor("#BBBBBB")),("VALIGN",(0,0),(-1,-1),"MIDDLE"),
    ("ALIGN",(3,1),(3,-1),"CENTER"),("ALIGN",(5,1),(-1,-1),"CENTER"),("ROWBACKGROUNDS",(0,1),(-1,-1),[colors.white,LIGHT]),("LINEBELOW",(4,1),(4,-1),0.6,colors.HexColor("#999999"))]))
h6=head("6. PRINTER DRIVERS, CLAUDE CHATS & INFORMATION STICKERS",ORANGE,f,FW)
n6=Paragraph("Every printer needs: <b>(1)</b> its correct <b>driver</b> installed on the Grony 2 computer; <b>(2)</b> its own <b>Claude chat</b> that gives the instructions and drivers for that printer – write its name; <b>if a printer has NO chat, tick FLAG and tell the owner</b>; <b>(3)</b> an <b>information sticker</b> on it (page 5). "
             "<font color='#B42318'><b>GM app:</b></font> printer properties use other names (e.g. “HP 880 A3 PRINTER B” at Grony 2) – rename them to these letters.",ParagraphStyle("n6",fontName="Helvetica",fontSize=8,leading=9.6))
h7=head("7. GRONY 2 INVENTORY – properties, tools and materials",GREEN,f,FW)
n7=Paragraph("Count each item, write the number, tick when it is present and in good condition; report anything missing to Joe. The GM app gives most properties no location (190 of 197) – when this list is checked, set each item's location to Grony 2 in the app.",ParagraphStyle("n7",fontName="Helvetica",fontSize=8,leading=9.6))
top=[h6,Spacer(1,3),n6,Spacer(1,4),setup,Spacer(1,6),h7,Spacer(1,3),n7]
th=0
for fl in top:
    w_,h_=fl.wrap(FW,10000); th+=h_
TOPH4=th+3
FT4=[Frame(M,H-TOP-TOPH4,FW,TOPH4,leftPadding=0,rightPadding=0,topPadding=0,bottomPadding=0)]+[Frame(M+i*(cw+G),BOT,cw,UH-TOPH4-4,leftPadding=0,rightPadding=0,topPadding=0,bottomPadding=0) for i in range(3)]
doc.addPageTemplates([PageTemplate(id="p4",frames=FT4,onPageEnd=pageend),PageTemplate(id="p5",frames=[Frame(M,BOT,FW,UH,leftPadding=0,rightPadding=0,topPadding=0,bottomPadding=0)],onPageEnd=pageend)])
story.extend(top); story.append(FrameBreak())
Q=" (qty ___)"
check("COMPUTER & POWER","",[
 "Grony 2 laptop + charger","Philips monitor + power and video cables","Mouse, mouse pad (and keyboard if separate)","UPS (TOP EDGE) + its cable",
 "Extension boards"+Q+" – none on the floor","USB cable for every printer"+Q,"Power cable for every printer"+Q,"USB hub / adapters on the desk","Wall socket on the wooden unit – secure",
],NAVY,f,num=False)
check("PRINTERS & MACHINES","Each with its letter sticker and information sticker.",[
 "B Epson EcoTank ET-2860","C HP M880m (“HP COLOUR 1”)","D Epson photo printer","E HP M880m (“HP COLOUR 2”)","F Epson (cream) + external ink tank + tubes",
 "G Epson EcoTank L8050","HP black-and-white MFP (desk)","Laminator","Printer covers"+Q,
],ORANGE,f,num=False)
check("FURNITURE & FIXTURES","",[
 "Desk with printed mat; chairs"+Q,"White shelf unit (laminator + bin); white shelf unit (D, F, G)","Wooden unit: 3 slots + tools shelf","Glass showcase",
 "Lidded bin (replaces the cardboard box)","<b>Pen on a rope</b> on the customers' table","Light bulb(s) working"+Q,"Window banners and posters in good condition – none from other companies",
 "Stickers in place: BIN, WASTE PAPERS, PRINTING PAPERS, CUSTOMERS' WORK, showcase list, company number, staff note, printer letters and info stickers",
],NAVY,f,num=False)
check("TOOLS","",[
 "Staplers"+Q+" (incl. giant / long-arm if kept here)","Scissors"+Q,"Passport cutter","Cutter / knife"+Q,"A3 paper cutter (if kept here)","Correction pens"+Q,
 "Pens and markers incl. permanent marker"+Q,"Date stamp","Cellotapes"+Q,"Pins / thumbtacks","Rubber bands (in a wallet)","Rags and brush","Mop / broom","Toolbox with screwdrivers – out of the showcase",
],ORANGE,f,num=False)
check("MATERIALS","",[
 "A4 paper"+Q+" reams","A3 paper"+Q+" – flat","4×6 photo paper","5×7 photo paper","A4 photo paper","Brown envelopes"+Q,"Passport envelopes"+Q,"Polythene bags (in a brown envelope)","Staple pins (in a brown envelope)",
 "Laminating pouches A4 / A3"+Q,"Ink bottles for B, G, F/D – every colour"+Q,"Spare toner for the HP printers"+Q,"Cuttings – a few ready, rubber-banded","Online forms (in a brown envelope)",
 "Company cards / flyers in the yellow wallet","Customer jobs in marked envelopes in CUSTOMERS' WORK",
],GREEN,f,num=False)
check("STOCK IN THE GLASS SHOWCASE","Count against the item list in the GM app.",[
 "Game pads / controllers"+Q,"Wireless mice"+Q,"4G Wi-Fi router"+Q,"Laptop batteries, adapters and chargers"+Q,"Other accessories as on the item list",
],NAVY,f,num=False)

# ================= PAGE 5: information stickers
story.append(NextPageTemplate("p5")); story.append(PageBreak())
story.append(head("PRINTER & DEVICE INFORMATION STICKERS – GRONY 2",NAVY,10,FW))
story.append(Spacer(1,3))
story.append(Paragraph("Print at 100%, cut on the dashed lines and stick each one on its printer where it can be read without moving the machine. Fill in the blanks (serial number, Claude chat name, technician). Safe-use lines are general – the owner confirms them for each model.",ParagraphStyle("n5",fontName="Helvetica",fontSize=8.4,leading=10)))
story.append(Spacer(1,5))
CW=(FW-8)/2; CH=176
class Card(Flowable):
    def __init__(s,letter,title,sub,use,safe,strip,hdr=NAVY):
        Flowable.__init__(s); s.w=CW; s.h=CH; s.letter=letter; s.title=title; s.sub=sub; s.use=use; s.safe=safe; s.strip=strip; s.hdr=hdr
    def wrap(s,aw,ah): return (s.w,s.h)
    def draw(s):
        c=s.canv; w,h=s.w,s.h; ins=5
        c.setDash(3,3); c.setStrokeColor(colors.HexColor("#999999")); c.setLineWidth(0.6); c.rect(0,0,w,h); c.setDash()
        c.setStrokeColor(s.hdr); c.setLineWidth(1.6); c.roundRect(ins,ins,w-2*ins,h-2*ins,6)
        bx=ins+4; by=h-ins-4-34
        c.setFillColor(s.hdr); c.roundRect(bx,by,34,34,5,fill=1,stroke=0)
        c.setFillColor(colors.white); c.setFont("Helvetica-Bold",24 if len(s.letter)==1 else 18); c.drawCentredString(bx+17,by+9,s.letter)
        c.setFillColor(NAVY); c.setFont("Helvetica-Bold",9.4); c.drawString(bx+42,by+21,s.title)
        c.setFillColor(colors.HexColor("#555555")); c.setFont("Helvetica",7.2); c.drawString(bx+42,by+9,s.sub)
        y=by-4; x0=ins+8; wid=w-2*ins-16
        st=ParagraphStyle("cs",fontName="Helvetica",fontSize=7.3,leading=8.6)
        stb=ParagraphStyle("csb",parent=st,fontName="Helvetica-Bold")
        def para(t,style,extra=0):
            nonlocal y
            p=Paragraph(t,style); pw,ph=p.wrap(wid,1000); y-=ph; p.drawOn(c,x0,y); y-=extra
        para("<b>USE FOR:</b> "+s.use,st,2)
        para("<b>SAFE USE</b>",ParagraphStyle("sh",parent=stb,textColor=RED),0.5)
        bl=ParagraphStyle("bl",parent=st,leftIndent=7,firstLineIndent=-7)
        for t in s.safe: para("•&nbsp;"+t,bl,0.6)
        y-=2
        para("<b>Driver &amp; help – Claude chat:</b> “______________________________”",st,1)
        para("<b>Serial no.:</b> __________ &nbsp;<b>Bought:</b> ________ &nbsp;<b>Technician:</b> __________",st,0)
        c.setFillColor(LIGHT); c.rect(ins+1,ins+1,w-2*ins-2,13,fill=1,stroke=0)
        from reportlab.pdfbase.pdfmetrics import stringWidth as _sw
        fs_=min(6.8,(w-2*ins-10)/_sw(s.strip,"Helvetica-Bold",1))
        c.setFillColor(NAVY); c.setFont("Helvetica-Bold",fs_); c.drawCentredString(w/2,ins+5,s.strip)
STRIP="Keep on power + USB  •  Fault: lower shelf of the Boys' showcase + note, tell Joe"
INK=["Switch off with the power button – leave it plugged in and on USB.","Refill only the matching colour; bottles upright; fill to the upper line; wipe spills at once.","Keep it level – never tilt it or carry it with ink in the tanks.","No food or drink near it; keep vents and top clear."]
LAS=["The fuser inside is HOT – never touch it; let it cool before clearing a deep jam.","Feed A3 flat, never folded; right tray and paper size.","Not on the small UPS. Vents clear; nothing on top; no liquids.","Correct toner cartridge only."]
cards=[
 Card("B","Epson EcoTank ET-2860","Grony 2 • A4 colour printer, scanner, copier • Wi-Fi + USB","Scanning, copying, quick A4 colour prints.",INK+["Lift the scanner lid gently; wipe the glass with a soft dry cloth only."],STRIP),
 Card("C","HP Color LaserJet Managed flow MFP M880m","“HP COLOUR 1” • aisle • on castors • service sticker on front","<font color='#B42318'><b>RESERVED</b></font> – A3 / extreme cases only. Tell Joe first; log date, job and pages.",LAS+["Heavy, on castors – do not move it alone."],STRIP,RED),
 Card("D","Epson photo printer","Grony 2 • top of the white shelf, beside the UPS","Colour and photo prints (owner to confirm paper sizes).",["Switch off with the power button – leave it plugged in and on USB.","Use the correct ink only; wipe spills at once.","No notes or papers on the lid; remove memory cards after use.","Shares a shelf with F and G – keep vents uncovered."],STRIP),
 Card("E","HP Color LaserJet Managed flow MFP M880m","“HP COLOUR 2” • aisle","<font color='#B42318'><b>RESERVED</b></font> – A3 / extreme cases only. Tell Joe first; log date, job and pages.",LAS+["Heavy – do not move it alone."],STRIP,RED),
 Card("F","Epson (cream) with external ink tank","Grony 2 • middle shelf","Colour and photo prints (owner to confirm paper sizes).",["External ink tank stays upright, in a tray, away from the UPS and sockets.","Never pull or kink the ink tubes – do not move this printer without telling Joe.","Wipe ink spills at once; keep ink bottles closed.","Switch off with the power button – leave it plugged in and on USB."],STRIP),
 Card("G","Epson EcoTank L8050","Grony 2 • bottom shelf • A4 photo, 6 colours • Wi-Fi + USB","Photos, passport photos and photo prints (4×6, 5×7, A4).",["Photo paper: print side up, one sheet at a time; let prints dry before touching."]+INK[:3]+["No food or drink; keep vents and top clear."],STRIP),
 Card("?","HP black-and-white MFP","Grony 2 desk • letter to confirm","Black-and-white copies and documents (many pages).",["The fuser inside is HOT – let it cool before clearing a deep jam; clear jams gently.","No staples or paper clips in the document feeder.","Do not plug it into the small UPS. Keep vents clear; nothing on top; no liquids."],STRIP),
 Card("–","Laminator","Grony 2 • top of the white shelf","Laminating documents and ID cards in pouches (A4 / A3).",["The rollers are HOT – never touch them or push metal inside.","Switch ON, set the heater and wait for the ready light before feeding.","Feed the sealed edge first; never force a jam – switch off and let it cool.","Switch OFF and unplug at closing; keep paper, plastic and the bin away from it."],"Off and unplugged at closing  •  Fault: lower shelf of the Boys' showcase, tell Joe",ORANGE),
]
ct=Table([[cards[i],cards[i+1]] for i in range(0,8,2)],colWidths=[CW+8,CW],rowHeights=[CH+2]*4)
ct.setStyle(TableStyle([("LEFTPADDING",(0,0),(-1,-1),0),("RIGHTPADDING",(0,0),(-1,-1),0),("TOPPADDING",(0,0),(-1,-1),0),("BOTTOMPADDING",(0,0),(-1,-1),0),("VALIGN",(0,0),(-1,-1),"TOP"),("COLPADDING",(0,0),(-1,-1),0)] if False else [("LEFTPADDING",(0,0),(-1,-1),0),("RIGHTPADDING",(0,0),(-1,-1),0),("TOPPADDING",(0,0),(-1,-1),0),("BOTTOMPADDING",(0,0),(-1,-1),2),("VALIGN",(0,0),(-1,-1),"TOP")]))
story.append(ct)
doc.build(story)
