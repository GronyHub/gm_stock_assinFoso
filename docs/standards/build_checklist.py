from reportlab.lib.pagesizes import A4
from reportlab.platypus import (BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer, KeepTogether, Table, TableStyle, NextPageTemplate, PageBreak)
from reportlab.platypus.flowables import Flowable
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.graphics.shapes import Drawing, Rect, String
import sys
FS=float(sys.argv[1]) if len(sys.argv)>1 else 7.4
W,H=A4; M=8*mm; G=4*mm; TOP=17*mm; BOT=9*mm
cols=3; cw=(W-2*M-(cols-1)*G)/cols; FW=W-2*M
NAVY=colors.HexColor("#14213D"); ORANGE=colors.HexColor("#E85D04"); LIGHT=colors.HexColor("#FDF0E6"); GREEN=colors.HexColor("#2D6A4F"); LGREEN=colors.HexColor("#E8F3EC"); RED=colors.HexColor("#B42318"); PURPLE=colors.HexColor("#5B3A8C")
def pageend(c,doc):
    c.saveState()
    c.setFillColor(NAVY); c.rect(0,H-13*mm,W,13*mm,fill=1,stroke=0)
    c.setFillColor(colors.white); c.setFont("Helvetica-Bold",12.5)
    c.drawString(M,H-8.2*mm,"GRONY MULTIMEDIA – MASTER CHECKLIST")
    c.setFont("Helvetica",7.2); c.drawString(M,H-11.4*mm,"Assin Foso • Every line is a check: tick the box when done • Fix it or report it to Joe • Not for customers' view")
    c.setFont("Helvetica",8); c.drawRightString(W-M,H-8.2*mm,"Date: ____________   Checked by: ____________")
    c.setFillColor(ORANGE); c.rect(0,H-14*mm,W,1*mm,fill=1,stroke=0)
    c.setFillColor(colors.grey); c.setFont("Helvetica",6.5)
    c.drawString(M,4.5*mm,"Grey “How:” notes = the procedure. Rules not ticked are still rules. Send shop photos monthly so this checklist stays in sync.")
    c.drawRightString(W-M,4.5*mm,f"Page {doc.page}")
    c.restoreState()
F3=[Frame(M+i*(cw+G),BOT,cw,H-TOP-BOT,leftPadding=0,rightPadding=0,topPadding=0,bottomPadding=0) for i in range(cols)]
F1=[Frame(M,BOT,FW,H-TOP-BOT,leftPadding=0,rightPadding=0,topPadding=0,bottomPadding=0)]
doc=BaseDocTemplate("Grony_Multimedia_Master_Checklist.pdf",pagesize=A4,title="Grony Multimedia – Master Checklist",author="Grony Multimedia")
doc.addPageTemplates([PageTemplate(id="c3",frames=F3,onPageEnd=pageend),PageTemplate(id="c1",frames=F1,onPageEnd=pageend)])
body=ParagraphStyle("b",fontName="Helvetica",fontSize=FS,leading=FS*1.2,leftIndent=10,firstLineIndent=-10)
hs=ParagraphStyle("h",fontName="Helvetica-Bold",fontSize=FS+0.6,textColor=colors.white,leading=FS+2.4)
sub=ParagraphStyle("s",fontName="Helvetica-Oblique",fontSize=FS-0.8,textColor=colors.HexColor("#555555"),leading=FS,spaceAfter=1.5)
def HOW(t): return f'<br/><font size="{FS-1.1}" color="#666666"><i>How: {t}</i></font>'
story=[]; n=[0]
class Box(Flowable):
    def __init__(s,k=1): Flowable.__init__(s); s.k=k; s.width=7+(k-1)*11; s.height=7
    def draw(s):
        c=s.canv; c.setStrokeColor(NAVY); c.setLineWidth(0.8)
        for i in range(s.k): c.rect(i*11,0,7,7)
def head(t,bg=NAVY,w=None):
    tb=Table([[Paragraph(t,hs)]],colWidths=[w or cw])
    tb.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),bg),("LINEBEFORE",(0,0),(0,0),3,ORANGE if bg!=ORANGE else NAVY),
        ("TOPPADDING",(0,0),(-1,-1),1.8),("BOTTOMPADDING",(0,0),(-1,-1),1.8),("LEFTPADDING",(0,0),(-1,-1),4)]))
    return tb
def check(title,note,items,bg=NAVY,k=1):
    blk=[head(title,bg),Spacer(1,1.5)]
    if note: blk.append(Paragraph(note,sub))
    bw=10 if k==1 else 21
    for i in items:
        n[0]+=1
        t=Table([[Paragraph(f"<b>{n[0]}.</b>&nbsp;{i}",body),Box(k)]],colWidths=[cw-bw,bw])
        t.setStyle(TableStyle([("VALIGN",(0,0),(0,0),"TOP"),("VALIGN",(1,0),(1,0),"TOP"),("ALIGN",(1,0),(1,0),"RIGHT"),
            ("LEFTPADDING",(0,0),(-1,-1),0),("RIGHTPADDING",(0,0),(-1,-1),0),("TOPPADDING",(0,0),(0,0),0),("TOPPADDING",(1,0),(1,0),1),("BOTTOMPADDING",(0,0),(-1,-1),1.6)]))
        blk.append(t)
    story.append(KeepTogether(blk[:5])); story.extend(blk[5:]); story.append(Spacer(1,3.5))
def lines(title,k):
    st=ParagraphStyle("ln",fontName="Helvetica",fontSize=FS,leading=FS*2,textColor=colors.grey)
    story.append(KeepTogether([head(title),Paragraph("<br/>".join(f"{i}. ______________________________" for i in range(1,k+1)),st)])); story.append(Spacer(1,3.5))
def note(t,bg=LIGHT,fg=colors.black,w=None):
    tb=Table([[Paragraph(t,ParagraphStyle("nt",fontName="Helvetica",fontSize=FS-0.3,leading=FS*1.2,textColor=fg))]],colWidths=[w or cw])
    tb.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),bg),("BOX",(0,0),(-1,-1),0.6,ORANGE),("TOPPADDING",(0,0),(-1,-1),2.5),("BOTTOMPADDING",(0,0),(-1,-1),2.5),("LEFTPADDING",(0,0),(-1,-1),4),("RIGHTPADDING",(0,0),(-1,-1),4)]))
    story.append(tb); story.append(Spacer(1,3.5))

# ---------------- CONTENTS
note("<b>CONTENTS</b> &nbsp; <b>Daily</b> A–E (B2 = customer trust) p1–2 • <b>Weekly &amp; set days</b> F p2 • <b>Monthly/yearly sync</b> G p2 • <b>Know &amp; apply</b> H p2 • <b>RED MARKERS (fix first)</b> p2 • <b>One-off setup &amp; projects</b> I–Q p2–3 • <b>Approved apps</b> R–S p3 • <b>Location chart, Printer register, Done log</b> p4 • <b>Shop layout</b> p5.<br/>"
     "<b>Goal:</b> Grony 1 and Grony 2 each run as a <b>standalone printing press</b> – only large format means leaving your station.")

# ---------------- A OPENING
check("A. OPENING – every day","Before the first customer.",[
 "Clocked in with the GM app, location ON."+HOW("Manage → Team Times → Clock in (first in = Opener). Breaks: Take a Break / End Break. Manual entry only if unable – with reason, max 5 a month. Absent or late? Post on the app announcement first."),
 "Floor mopped; printers, tables and showcases dusted with rag and brush.",
 "UPS ON, charging and connected to the Epson EcoTanks.",
 "Every printer on <b>power and USB</b> to its computer – even unused ones.",
 "Every printer's <b>letter sticker</b> matches its name on screen."+HOW("Settings → Printers &amp; scanners → printer → Printer properties → General → name it exactly as on the Grony 2 sheet (p4), e.g. “B - Epson ET-2860” (letter first, plain hyphen) → print a test page. Nothing in the queue; admin account. Same names on Grony 1 &amp; 2."),
 "Every printer tested. Faults reported."+HOW("Faulty item → lower shelf of Boys' showcase with a note (item, fault, date, name) → tell Joe same day → Joe informs the owner and arranges repair."),
 "Company phone charged and with <b>Joe</b>; on shop Wi-Fi with both EcoTanks."+HOW("Epson Smart Panel → add printer → select each EcoTank. To print: file → Share/Print → EcoTank."),
 "WhatsApp Business working; owner's UK devices still linked."+HOW("Menu (3 dots) → Linked devices. Never tap Log out on the owner's devices."),
 "My phone charging <b>only</b> at the back; bags, food and water kept at the back.",
 "Laptop wallpapers solid black; I'm in <b>my own Chrome profile</b> – company account only. <b>No personal email signed in on any browser.</b>"+HOW("Chrome profile icon → Add → Continue without an account → staff name."),
 "Anyone who <b>phoned about an appointment</b> is called back as soon as I reach the shop – never forgotten; that is customer dignity.",
 "32-inch TV on, company advert on repeat; jingle played at the roadside.",
 "<b>Joe:</b> CCTV app checked – every camera showing.",
 "Fire: extinguisher in place, unblocked, gauge in the green; gate and exits clear.",
])
# ---------------- B DURING DAY
check("B. DURING THE DAY – all day, not once","",[
 "No eating or drinking at the front panel; no food, water or bags on front tables.",
 "Customers kept out of the inner shop (staff only) – politely asked to step outside.",
 "Seated, standing only for passport photos or large format; assistant routes customers and passes items.",
 "Every new customer registered with a <b>GM number</b>."+HOW("Greeting message sends app.gronymultimedia.com/register automatically. If missed, send the link or add them in the app → New Customer."),
 "Each customer's files <b>only</b> in a folder named with their GM number; WhatsApp contact saved as “GM24 – Full Name”.",
 "Customer details and logins kept private – never shared or reused.",
 "<b>Every customer is taken seriously</b> – greeted, listened to, order written down, a time given – above all anyone who has <b>walked in to request work</b>.",
 "<b>Complaints logged:</b> every customer complaint and every case of staff incompetence is written on the complaint log on the <b>left of the glass showcase</b>, with date and details.",
 "Every message answered within <b>1 hour</b>; prices quoted only from the price list.",
 "Names, dates and index numbers proofread before printing. Many files or copies: check the <b>quality and size of the first printout</b> before printing the rest.",
 "Right Claude chat used for each job – an hour's work done in minutes.",
 "Only approved apps used (R–S); nothing new installed.",
 "Other printers used; <b>HP M880 reserved</b> – extreme cases only."+HOW("Try every other printer first → tell Joe → log date, job, pages → leave it on standby, plugged in, on USB."),
 "Every walk-in sale in <b>Live Sale</b> with <b>WIC</b> on (GMC only for the shop's own use)."+HOW("Item → type Qty (change Price only if this sale differs) → green tick. All walk-in sales go on one combined daily receipt. Mistake? Undo straight away and re-enter."),
 "Every bill: receipt attached (demand it from vendors), vendor name, full list of goods adding up to the total, canonical item names. Cuttings recorded as expenses.",
 "Every sellable item is on the item list; count exclusions entered as numbers – <b>blue</b> = safe, <b>red</b> = flag.",
 "<b>COUNT NOW</b> items counted; warning banners cleared."+HOW("Tap item → count the shelf → submit. Missing SP/CP/group → Edit → Save. Negative stock → look for an unentered bill. Net gain → check count history for a miscount, unrecorded receipt or duplicate."),
 "Pen drives, memory cards, routers back in the showcase or Grony 3/4 straight after use.",
 "Any setting or location I might forget is labelled; any new success procedure written down.",
 "Goods in <b>like terms</b> (same type, same side, label out); old goods in front, new behind; none on the floor.",
 "Grony 4 path clear; storage goods on the Grony 4 shelf; hanging items on the last shelf of the Boys' showcase; ceiling goods fastened.",
 "<b>No banners at Grony 6 &amp; 7</b>; no other company's logo, design or advert displayed anywhere.",
 "<b>No cable lies across any path or walkway</b> (extension-board wires may pass under printers); no extension board plugged into another; cables checked.",
 "No smoking or naked flame; ink and paper away from heat.",
 "<b>Power cut:</b> UPS <b>off</b> when there is no work, <b>on</b> only when needed; the moment power returns it goes back on charge – it must always be kept charging.",
])
# ---------------- C STATION
check("B2. CUSTOMER TRUST – COMPANY CHANNELS ONLY","The company number is also the Mobile Money number.",[
 "The customer's <b>WhatsApp chat is the source of truth</b>: reply there, send receipts there, put every conversation about their work and every payment there."+HOW("Rename the contact to their company code: “GM24 – Full Name”."),
 "Customer not sending work on WhatsApp? Ask them to send “<b>hi</b>” to the company number, then <b>save the contact</b> with their GM number.",
 "<b>Work goes only through official company channels</b> – the company number, email address and website – never to personal numbers or personal WhatsApp lines.",
 "<b>No personal phone number</b> – mine or any staff member's – is given to any customer.",
 "<b>No personal Mobile Money number</b> is given to customers; they pay to the company MoMo number.",
],bg=NAVY)
check("C. STATION CHECK – left box Grony 1, right box Grony 2","Each station must run standalone.",[
 "Laptop, printers and scanner working and clean.",
 "<b>BIN</b>: rubbish and unusable paper only; official documents torn into pieces first.",
 "<b>WASTE PAPERS</b>: spoilt or unused prints only.",
 "<b>PRINTING PAPERS</b> stocked and clean: A4, 4×6, 5×7.",
 "A3 sheets flat – <b>never folded</b>.",
 "Permanent marker present; chargers wrapped with 2–3 rubber bands.",
 "Everything for printing within reach; anything missing reported.",
 "Showcase list complete (per its sticker): cellotapes, brown envelopes, polythene bags, stapler, staple pins, cuttings, online forms, scissors, passport cutter, passport envelopes – small items inside brown envelopes.",
],bg=ORANGE,k=2)
# ---------------- D SOCIAL
check("D. SOCIAL MEDIA – every day","",[
 "At least <b>1 video clip</b> recorded and saved in the Drive Video folder."+HOW("Phone upright on tripod, facing the light, 10–30 s, result in first 3 s, clip-on mic if speaking. Film work, large format, neat goods, customers (with permission)."),
 "Posted: TikTok → Facebook Reel → WhatsApp Status &amp; group."+HOW("CapCut → Template → add clips → Auto captions → end text with the company number (on the monitor sticker) → Export."),
 "At least <b>1 service design photo advert</b> posted on WhatsApp (from Drive or the app's Photo Advert section).",
 "Ideas tried: banner printing out, before/after typing, customer collecting (with permission), admission reminders, stickers being applied.",
 "Company phone posted updates to the <b>WhatsApp group/Channel</b>; captions and replies drafted in the phone's own Claude chat.",
 "Shared by every staff member on personal pages."+HOW("Facebook: Share → Feed, then Share → Story. TikTok: Share → Repost."),
 "No customer face, CV or document posted without permission.",
 "Comments and messages on Facebook, TikTok and WhatsApp answered.",
 "Social media lead confirmed posting and replies done; more posts in busy seasons (WASSCE, admissions, reopening, church &amp; funeral events).",
 "Company passwords, emails and recovery details left unchanged.",
 "My personal Facebook workplace is set to Grony Multimedia and the company TikTok handle is in my bio (once).",
])
# ---------------- E CLOSING
check("E. CLOSING – every day","Before locking up.",[
 "Desktop, Documents and Downloads empty on both laptops."+HOW("Customer files → GM folders; everything else → delete; empty Recycle Bin."),
 "Pen drives, cards, routers and modems stored in the showcase or Grony 3/4.",
 "Tables decluttered; everything back in its labelled place.",
 "All sales, bills and expenses of the day recorded in the <b>GM app</b>.",
 "<b>Laminator</b> switched off, unplugged and cooled; bin emptied; WASTE PAPERS sorted – full documents torn into the BIN."+HOW("Waste-paper slot is for test prints only. Customer or official documents: tear into pieces, then BIN."),
 "Laptops shut down; TV off; printers off at their button but <b>still plugged in and on USB</b>; UPS charging.",
 "Sockets not overloaded; gate area clear; locked up.",
 "Clocked out; the Closer answered the closing questions in the app.",
])
# ---------------- F WEEKLY
check("F. WEEKLY &amp; SET DAYS","",[
 "<b>WEDNESDAY:</b> fire alarm tested."+HOW("Tell everyone → hold the test button until loud → no sound: new battery, retest → still faulty: report to Joe."),
 "<b>WEDNESDAY:</b> item groups checked – every good in the right group.",
 "<b>SATURDAY:</b> CAB officer confirmed cash at bank in the app.",
 "Week's clips edited in CapCut and scheduled (Meta Business Suite → Planner).",
 "Printer covers washed.",
 "Phone and both computers have <b>only approved apps</b>."+HOW("Phone: Settings → Apps → Uninstall. PC: Settings → Apps → Installed apps → 3 dots → Uninstall. Unsure? Ask Joe."),
 "TV advert updated with new work or offers.",
 "At least <b>5 new customers</b> registered and <b>5 added</b> to the WhatsApp group; bulk message sent about new products.",
 "CCTV recording; owner's devices still linked.",
 "<b>Windows USB</b> is present and in its place (always keep one).",
 "WhatsApp check-in with the owner: posts, enquiries, faults, stock needed.",
 "Sound card &amp; mic used only for jingles, voiceovers and info-centre adverts – recorded in batches, saved to Drive.",
])
# ---------------- G MONTHLY
check("G. MONTHLY &amp; YEARLY SYNC","Write the date beside each tick.",[
 "General staff meeting held; next date known a week ahead.",
 "<b>Shop photos</b> with descriptions sent to the owner."+HOW("Front &amp; signboard, Grony 1–7, large format, inner shop, both showcases, charging point. For each: area – what's there – what changed – any problem. Owner gives them to Claude to update this checklist and the layout."),
 "Printer drivers still work (test page from each printer); each printer's Claude chat and information sticker still in place."+HOW("A printer that fails a test page: open its Claude chat and re-follow the driver steps."),
 "Location chart and Printer Register (p5) correct; printer stickers updated and snapshots sent.",
 "Checklist posted at vantage points; sticker labels intact.",
 "Price list current and with all staff.",
 "Greeting message and registration link work (test from another phone).",
 "Facebook Page roles and Chrome profiles match current staff; leavers removed the same day.",
 "AnyDesk works; signboard and banner in good condition; M880 log reviewed.",
 "Every repair needed is listed as a task in the GM app with a deadline.",
 "<b>YEARLY</b> (and after any use): fire extinguisher serviced or refilled.",
])
# ---------------- H KNOW
check("H. KNOW &amp; APPLY – tick once you can do it","",[
 "I can use the extinguisher: <b>Pull, Aim, Squeeze, Sweep</b>; switch off at the mains if safe; never water on electrical fires; small fire only with a clear exit, else everyone out and call <b>192</b>.",
 "Two laptop setups serve every customer – speed comes from sharper skills.",
 "I report problems early – a small fault today saves a big cost tomorrow.",
 "I keep this checklist out of customers' view. Not knowing is no excuse.",
 "I know the app words: <b>SOH</b> stock on hand • <b>SP</b> selling price • <b>CP</b> cost price • <b>WIC</b> walk-in customer • <b>GMC</b> Grony Multimedia as customer • <b>CAB</b> cash at bank. I search the app's Handbook before asking.",
 "I can design a poster or flyer with Claude."+HOW("claude.ai → Settings → Connectors → Canva (shop account only) → new chat: purpose, exact text, size, “make it in Canva” → review and correct → download/print → save to Drive → display if it is a service design."),
],bg=GREEN)

# ================= ONE-OFF
check("RED MARKERS – FIX FIRST","Problems seen in the shop photos. Tag = station (G2 = Grony 2). Fix, then tick. Send new photos and more markers get added.",[
 "<b>G2-1</b> Extension boards and cables on the floor by printers C, E and the shelf units."+HOW("One board per station, fixed off the floor, plugged straight into the wall. No board into another board. Cables bundled off the walkway."),
 "<b>G2-2</b> Wall socket on the wooden unit with cables dangling right above the stationery."+HOW("Electrician secures socket and cables; keep paper and tapes away from it."),
 "<b>G2-3</b> External ink tank (CISS) and tubes loose beside the UPS."+HOW("Stand tanks in a tray away from the UPS; secure the tubes; wipe any spill."),
 "<b>G2-4</b> Hot laminator on the shelf directly above the bin."+HOW("Off and unplugged at closing; cool before leaving; keep paper and bin away from it."),
 "<b>G2-5</b> Bin is an open cardboard box of plastic and paper, with a second box under it."+HOW("Proper lidded bin; emptied daily at closing."),
 "<b>G2-6</b> WASTE PAPERS slot overflowing, with full printed documents inside."+HOW("Empty daily; tear documents into the BIN; test prints only."),
 "<b>G2-7</b> PRINTING PAPERS slot: ream torn open, wrapper crumpled, sheets spilling."+HOW("Keep the ream in its wrapper, upright and flat."),
 "<b>G2-8</b> CUSTOMERS' WORK slot: prints and posters stuffed in loose."+HOW("Each job in an envelope marked with GM number and name; collected jobs removed daily; never fold A3."),
 "<b>G2-9</b> Printers D, F and G stacked on one thin shelf."+HOW("Keep vents uncovered and tops clear; check the shelf takes the weight."),
 "<b>G2-10</b> Glass showcase: stock mixed with loose tools and wires; protective film still on the glass."+HOW("Sort stock by type; tools into a toolbox; peel the film off."),
 "<b>G2-11</b> Showcase sticker lists work items, but they sit on the wooden unit."+HOW("Move the sticker to the unit, or the items into the showcase."),
 "<b>G2-12</b> Faded tape labels and torn sticker residue on the HP printers."+HOW("Clean off; one permanent info sticker per printer (letter, model, rule)."),
 "<b>G2-13</b> Paper company-number sticker taped across the top vent slots of the Philips monitor."+HOW("Fix the new sticker on the flat back panel below the vents; tape all four edges; keep vents clear."),
 "<b>G1-1</b> Cables across the floor under the desk; papers piled on the desk and printers."+HOW("Bundle cables off the floor; clear the desk daily."),
 "<b>G5-1</b> Open cartons and loose cloth on the work table."+HOW("Store or arrange them; keep the table and walkway clear."),
 "<b>G7-1</b> Plywood leaning outside and a banner hanging across the opening."+HOW("Store the plywood for the mason's job; take the banner down."),
 "<b>G8-1</b> Other organisations' posters on the compound wall beside Grony 8."+HOW("Fine if the wall is not ours; none inside the shop."),
 "<b>ALL-1</b> Ceiling plywood water-stained (Grony 1, 5) with wiring and the CCTV above it."+HOW("Mason fixes the leak and replaces panels; electrician checks the wiring is dry and secured."),
 "<b>ALL-2</b> Handwritten notes and loose papers on printer lids."+HOW("Paste notes on a label board; keep lids and tops clear."),
 "<b>ALL-3</b> Two HP M880m printers (C and E), each also taped “HP COLOUR 1/2”."+HOW("Owner confirms which one is reserved; one sticker per printer."),
],bg=RED)
check("I. SHOP WORKS – CHIEF MASON","One-off. When done, write it in the Done Log (p5).",[
 "Signboard fixed; banner mounted in it with <b>GRONY MULTIMEDIA</b> in bold.",
 "Ceiling plywood changed; Grony 2 plywood raised to the top.",
 "Holes sealed with mortar: Grony 4 floor and top of the gate; all floor holes cemented/patched.",
],bg=PURPLE)
check("J. POWER, SECURITY &amp; FIRE","",[
 "Fire alarm installed and tested; extinguisher placed within easy reach.",
 "Fire Service <b>192</b> and Joe's number posted where everyone can see.",
 "ECG meter change completed in Grony's number.",
 "CCTV app installed on Joe's phone and tested.",
],bg=PURPLE)
check("K. EQUIPMENT &amp; PRINTERS","",[
 "Epson EcoTank L8050 and all other faulty printers repaired; Nesco repairs done.",
 "Bought: XLR pins, soldering iron, LEDs, screws, small syringes (ink).",
 "Owner's MTN SIM card sorted.",
 "Wireless printing set up on the company phone (both EcoTanks).",
 "Every printer has a <b>letter sticker</b> and is renamed with that letter on both computers.",
 "Every printer has an <b>information sticker</b>; snapshot sent to the owner."+HOW("Letter, make/model, serial no., station, USB/Wi-Fi + IP, ink/toner numbers, paper sizes, date bought, supplier, technician &amp; phone, last service, faults, special rule (e.g. M880 reserved). Photo of sticker + whole printer → owner."),
 "Every printer has its correct <b>driver installed</b> on the Grony 1 and Grony 2 computers."+HOW("Open that printer's Claude chat, follow its driver and set-up steps, then print a test page from the right letter."),
 "Every printer has its own <b>Claude chat</b> (instructions + drivers). <b>Flag any printer without one</b> to the owner."+HOW("Write the chat name in the Printer Register (p4); no chat: tick FLAG and tell the owner."),
 "Every printer and device has an <b>information sticker</b> with safe-use rules (Grony 2's are on its station sheet, p5)."+HOW("Print, cut, fill in serial no., chat name and technician, stick where it can be read."),
 "Printer names in the <b>GM app</b> match the letters and each has a location (the app has “HP 880 A3 PRINTER B” at Grony 2 and “HP M880 PRINTER 1” at Grony 3)."+HOW("GM app → Properties → rename to the letter and model, set the location."),
 "Printer Register (p5) completed; HP A3 printer's correct toner identified and stocked; all printers listed in the GM app.",
 "Permanent markers at Grony 1 &amp; 2; printer covers washed.",
],bg=PURPLE)
check("L. DISPLAY &amp; ARRANGEMENT","",[
 "32-inch TV mounted, playing the company advert (made with Claude Design) non-stop.",
 "Hanging items on the Boys' showcase last shelf; lower shelf kept for faulty items.",
 "Remaining boards pasted on walls; goods on ceiling arranged and fastened; all goods in like terms.",
 "Banners removed from Grony 6 &amp; 7; sticker labels pasted at Grony 1 &amp; 2.",
 "Every service has its own design displayed; trending services near customer seats.",
 "Printed list of items with selling price and count.",
 "<b>Pen on a rope</b> set up on the customers' table at Grony 2 so customers can write; rope secure."+HOW("Tie the pen to the table edge with a short rope; replace the pen when it dries."),
 "QR code of the company number for sending files and MoMo (Joe).",
 "New <b>company-number sticker with WhatsApp QR</b> printed, laminated and fixed on the back of the Grony 2 monitor (below the vents), with copies at Grony 1 and the counter."+HOW("File: Grony_Company_Number_Sticker.pdf. Print at 100%, cut on the dashed lines, laminate, tape all four edges. Scan the QR to test."),
],bg=PURPLE)
check("M. SYSTEMS &amp; CUSTOMER REGISTRATION","",[
 "<b>Registration form live</b> at app.gronymultimedia.com/register (Claude Code: CLAUDE_CODE_PROMPT.md) and tested.",
 "Greeting message saved – only after the form is live."+HOW("Message = intro + services + registration link + website, Facebook, TikTok, professional email, phone &amp; hours. WhatsApp Business → Business tools → Greeting message → paste → Recipients: Everyone → Save."),
 "Quick reply <b>/jingle</b> saved with the jingle audio."+HOW("Business tools → Quick replies → + → shortcut /jingle → attach audio → Save."),
 "Existing customer folders <b>and WhatsApp contacts</b> renamed to the new GM format (GM24, not GM0024)."+HOW("One-time: rename each “GM0024 – Name” contact and folder to “GM24 – Name”. Numbers have no leading zeros."),
 "Each staff member has their own Chrome profile.",
 "AnyDesk on Grony 1 &amp; 2; address sent to owner."+HOW("anydesk.com → install → send the address. Accept only when the owner has called first."),
 "Fast-pace processes written and pasted at the stations; this checklist printed and posted.",
],bg=PURPLE)
check("N. FACEBOOK PAGE &amp; META BUSINESS SUITE","",[
 "<b>Retry renaming</b> Grony TV → <b>Grony Multimedia</b> (first try failed)."+HOW("Page → Settings → Page setup → Name. If refused: wait 7 days, post a few times, then retry; or request via Meta Business Suite → Settings → Business assets."),
 "Logo, cover photo, shop address, company number, WhatsApp button and @username set.",
 "Joe given <b>full control</b> as backup."+HOW("Owner's phone: Page profile → Settings → Page setup → Page access → Add new → Joe → turn on full control → Give access → Joe accepts."),
 "Meta Business Suite on the company phone, logged in as Joe."+HOW("Play Store → Meta Business Suite → log in with Joe's Facebook → choose the Page → allow notifications."),
 "Staff who post have <b>task access</b> only (content + messages). Staff who prefer not to use their own Facebook post from the company phone; sharing a Page post needs no access.",
 "Friends invited by owner and staff; Page link and QR at the counter.",
],bg=PURPLE)
check("O. TRAINING","",[
 "Joe shown how to sell the 6ft material.",
 "Advertisement tutorial: recording, CapCut, posting, sharing.",
 "Every staff member taken through this checklist, the extinguisher and the alarm test.",
 "Claude tutorials written and given; clock-in, Live Sale and COUNT NOW shown.",
],bg=PURPLE)
check("P. ADVERTS","",[
 "Services advert recorded: photocopy, printing, passport photos, large format, posters, banners, stickers.",
 "New <b>jingle</b> made, played at the roadside and saved as /jingle.",
 "Domain-change &amp; website-creation advert recorded; website &amp; app development jingle made.",
 "Video Recording Plan followed: arrange goods → film display → one item at a time → ongoing work → ask permission → interview customers.",
 "Video advert made from the Video folder clips with Claude (Joe); TV advert loaded.",
],bg=PURPLE)
check("Q. BUSINESS EXPANSION","",[
 "DTF machine: current price and profitability enquired.",
 "Price list for all goods and services created and given to staff.",
],bg=PURPLE)
lines("STRATEGIES – FEWER THE MERRIER",2)
lines("STRATEGIES – FAST WORK ON ALL SERVICES",2)
check("R. APPROVED APPS – COMPANY PHONE","Only these. Remove anything else.",[
 "Claude • WhatsApp Business • Epson Smart Panel (both EcoTanks)",
 "Microsoft Word/Office • Google Drive • Gmail (company)",
 "Facebook • Meta Business Suite • TikTok • YouTube + YouTube Studio",
 "CapCut • Google Maps (Business Profile)",
 "All other apps removed.",
],bg=GREEN)
check("S. APPROVED APPS – GRONY 1 | GRONY 2","Left box Grony 1, right box Grony 2.",[
 "Claude desktop • Microsoft Office (Word, Excel, PowerPoint)",
 "Chrome with a profile per staff member",
 "Adobe Acrobat Reader • 7-Zip • Google Drive for desktop",
 "Drivers for every printer at the station (from its Claude chat) + Epson Scan 2",
 "WhatsApp Business desktop (linked) • passport photo editor",
 "AnyDesk • Windows Security on and updated",
 "All other apps removed.",
],bg=GREEN,k=2)

# ================= TABLES PAGE
story.append(NextPageTemplate("c1")); story.append(PageBreak())
cell=ParagraphStyle("c",fontName="Helvetica",fontSize=7.2,leading=8.6)
cellb=ParagraphStyle("cb",parent=cell,fontName="Helvetica-Bold",textColor=colors.white)
def tbl(rows,widths,bg,zebra=None):
    t=Table(rows,colWidths=[FW*w for w in widths],repeatRows=1)
    st=[("BACKGROUND",(0,0),(-1,0),bg),("GRID",(0,0),(-1,-1),0.35,colors.HexColor("#BBBBBB")),("VALIGN",(0,0),(-1,-1),"MIDDLE"),("TOPPADDING",(0,0),(-1,-1),1.4),("BOTTOMPADDING",(0,0),(-1,-1),1.4)]
    if zebra: st.append(("ROWBACKGROUNDS",(0,1),(-1,-1),[colors.white,zebra]))
    t.setStyle(TableStyle(st)); return t
story.append(head("T. LOCATION CHART – write locations in pencil; tick when present; report anything missing",NAVY,FW)); story.append(Spacer(1,2))
items=[("Laptop + charger","",""),("UPS","",""),("B&amp;W printer","",""),("Colour EcoTank (Wi-Fi)","",""),("Photo/passport printer","",""),("Scanner/copier","",""),
 ("Wi-Fi printer name &amp; password","",""),("A4 / 4×6 / 5×7 paper","PRINTING PAPERS","PRINTING PAPERS"),("A3 (flat)","",""),("Waste papers","WASTE PAPERS","WASTE PAPERS"),("Bin","BIN","BIN"),
 ("Cellotapes, envelopes, polythene","","Showcase"),("Stapler + pins","","Showcase"),("Passport covers","","Showcase"),("Customer documents","","Showcase"),
 ("Scissors / cutter","",""),("Permanent marker","",""),("Ink + syringes","",""),("Rags &amp; brush","",""),("Fire extinguisher","",""),
 ("Pen drives / cards","Showcase / G3–4","Showcase / G3–4"),("Windows USB","",""),("Router / modem","Showcase / G3–4","Showcase / G3–4"),("Phone charging","Back of shop","Back of shop")]
# two side-by-side halves to save space
half=(len(items)+1)//2
hdr=[Paragraph(x,cellb) for x in ["ITEM","GRONY 1","OK","GRONY 2","OK"]]
rows=[hdr*2]
for i in range(half):
    r=[]
    for it in (items[i], items[i+half] if i+half<len(items) else ("","","")):
        r+= [Paragraph(it[0],cell),Paragraph(it[1],cell),"",Paragraph(it[2],cell),""]
    rows.append(r)
story.append(tbl(rows,[0.13,0.1,0.025,0.1,0.025]*2,NAVY,LIGHT)); story.append(Spacer(1,6))
story.append(head("U. PRINTER REGISTER – fill from each printer's information sticker; send snapshots to the owner",ORANGE,FW)); story.append(Spacer(1,2))
rh=[Paragraph(x,cellb) for x in ["LTR","PRINTER","STATION","LINK","USE RULE","DRIVER OK","CLAUDE CHAT (name)","NO CHAT: FLAG","STICKER OK"]]
prs=[("A","(not yet seen)","","","",""),("B","Epson EcoTank ET-2860","Grony 2","Wi-Fi + USB","",""),
 ("C","HP Color LaserJet Managed flow MFP M880m (HP COLOUR 1)","Aisle","USB","","M880: reserve ONE – owner to confirm"),
 ("D","Epson photo printer (Wi-Fi/Ethernet)","Grony 2","USB","",""),
 ("E","HP Color LaserJet Managed flow MFP M880m (HP COLOUR 2)","Aisle","USB","","M880: reserve ONE – owner to confirm"),
 ("F","Epson (cream) with external ink tank","Grony 2","USB","CISS",""),("G","Epson EcoTank L8050","Grony 2","Wi-Fi + USB","",""),
 ("-","HP LaserJet 500 MFP (HP BLACK AND WHITE 1)","Grony 1","USB","",""),("-","Canon imageRUNNER ADV C5045i","","USB","",""),
 ("-","Large-format (XP600 head)","Grony 5","","","")]
story.append(tbl([rh]+[[Paragraph(r[0],cell),Paragraph(r[1],cell),Paragraph(r[2],cell),Paragraph(r[3],cell),Paragraph(r[5],cell),"","","",""] for r in prs],[0.05,0.25,0.08,0.08,0.15,0.08,0.14,0.08,0.09],ORANGE))
story.append(head("V. DONE LOG – already completed. Do NOT repeat; only re-check as shown. Add each finished one-off task here.",GREEN,FW)); story.append(Spacer(1,2))
dh=[Paragraph(x,cellb) for x in ["DONE","DATE","BY","RE-CHECK","LAST CHECK"]]
done=[("Staff standards pasted at vantage points","Monthly – visible?"),("Small table placed near the Grony 2 table","Monthly – in place?"),
 ("Shop working times refined","Monthly – followed?"),("Sticker names chosen (BIN, WASTE PAPERS, PRINTING PAPERS, showcase)","After pasting – monthly"),
 ("Grony 2 showcase contents decided","Monthly – arranged?"),("Location chart created","Monthly – correct?"),
 ("Joe shown the Drive Video folder","Monthly – being filled?"),("Company laws written in the GM app Handbook","When laws are revised"),
 ("Grony TV Facebook Page exists (≈60 followers) – rename pending (N)","After rename")]
rows=[dh]+[[Paragraph(a,cell),"","",Paragraph(b,cell),""] for a,b in done]+[[Paragraph("",cell),"","","",""] for _ in range(5)]
story.append(tbl(rows,[0.45,0.1,0.12,0.2,0.13],GREEN,LGREEN))

# ================= LAYOUT
story.append(NextPageTemplate("c1")); story.append(PageBreak())
story.append(head("W. SHOP LAYOUT – DRAFT (not to scale; corrected from monthly photos)",NAVY,FW)); story.append(Spacer(1,3))
dw=FW; dh_=330
d=Drawing(dw,dh_); U=dw/100.0
def bx(x,y,w,h,title,ls=(),fill=LIGHT,stroke=NAVY,tc=NAVY):
    d.add(Rect(x,y,w,h,fillColor=fill,strokeColor=stroke,strokeWidth=1))
    d.add(String(x+w/2,y+h-10,title,fontName="Helvetica-Bold",fontSize=7.6,fillColor=tc,textAnchor="middle"))
    for i,l in enumerate(ls): d.add(String(x+w/2,y+h-19-i*8,l,fontName="Helvetica",fontSize=6.3,fillColor=colors.HexColor("#333333"),textAnchor="middle"))
d.add(Rect(0,20,dw,dh_-22,fillColor=None,strokeColor=NAVY,strokeWidth=1.6))
top=dh_-50
bx(1*U,top,31*U,44,"INNER SHOP – STAFF ONLY",["Grony 3 | Grony 4 • routers, pen drives","Customers NOT allowed"],fill=colors.HexColor("#FDE7E7"),stroke=RED,tc=RED)
bx(34*U,top,32*U,44,"LARGE-FORMAT AREA",["XP600 printer • banners, stickers","Only reason to leave a station"])
bx(68*U,top,31*U,44,"BACK – STAFF AREA",["Phone charging • bags, food","Extinguisher: ________"])
mid=top-48
bx(1*U,mid,31*U,44,"BOYS' SHOWCASE",["Last shelf: hanging items","Lower shelf: faulty items"])
bx(34*U,mid,32*U,44,"32-INCH TV",["Advert on repeat","CCTV covers this area"])
bx(68*U,mid,31*U,44,"GRONY 2 SHOWCASE",["Tapes, envelopes, polythene","Stapler, pins, passport covers"])
st=mid-48
bx(1*U,st,48.5*U,44,"GRONY 1 – STATION",["Laptop + printers • BIN | WASTE | PRINTING PAPERS","Marker • chargers wrapped • A3 flat"],fill=colors.HexColor("#FFF4EC"),stroke=ORANGE,tc=ORANGE)
bx(50.5*U,st,48.5*U,44,"GRONY 2 – STATION",["Laptop + printers • BIN | WASTE | PRINTING PAPERS","Small table beside • EcoTanks Wi-Fi + UPS"],fill=colors.HexColor("#FFF4EC"),stroke=ORANGE,tc=ORANGE)
fp=st-18
bx(1*U,fp,98*U,14,"FRONT PANEL – no food, drinks, bags or phone charging",fill=colors.white)
fr=fp-32
bx(1*U,fr,31*U,28,"GRONY 6",["NO banners – front view clear"],fill=LGREEN,stroke=GREEN,tc=GREEN)
bx(34*U,fr,32*U,28,"GATE / ENTRANCE",["Keep clear (fire exit)"],fill=colors.white)
bx(68*U,fr,31*U,28,"GRONY 7",["NO banners – front view clear"],fill=LGREEN,stroke=GREEN,tc=GREEN)
d.add(Rect(0,0,dw,17,fillColor=colors.HexColor("#555555"),strokeColor=None))
d.add(String(dw/2,5.5,"ROADSIDE • Signboard with GRONY MULTIMEDIA banner • Jingle played here",fontName="Helvetica-Bold",fontSize=7.4,fillColor=colors.white,textAnchor="middle"))
from reportlab.graphics.shapes import Circle
def flag(x,y):
    d.add(Circle(x,y,6,fillColor=RED,strokeColor=None)); d.add(String(x,y-3,"!",fontName="Helvetica-Bold",fontSize=9,fillColor=colors.white,textAnchor="middle"))
flag(1*U+48.5*U-9,st+44-9); flag(50.5*U+48.5*U-9,st+44-9)
flag(1*U+31*U-9,fr+28-9); flag(68*U+31*U-9,fr+28-9)
flag(34*U+32*U-9,mid+44-9); flag(1*U+31*U-9,top+44-9)
d.add(Circle(dw-120,8.5,5,fillColor=RED,strokeColor=None)); d.add(String(dw-111,5.5,"red marker = see the RED MARKERS list",fontName="Helvetica",fontSize=7,fillColor=colors.white))
story.append(d)
doc.build(story)
