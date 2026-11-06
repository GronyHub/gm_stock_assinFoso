# Advert scripts. Item lists come from the shop's active items (Neon, active_items, 2026-11-06).
# Each scene: heading, bullets shown on screen, words spoken, photos (banner/<file> or commons/<file>).
PHONE_SAY = "zero five three, four three two, eight nine seven seven"
CONTACT = dict(heading="Visit Grony Multimedia", bullets=[
    "053 432 8977  (Call / WhatsApp / MoMo)", "Between GCB & ADB Bank, Assin Foso", "www.gronymultimedia.com",
    "TikTok: @grony.multimedia", "Facebook: Grony Multimedia"], contact=True,
    say=f"Visit Grony Multimedia, between G C B and A D B Bank, in Assin Foso. Or call, WhatsApp, or MoMo us on {PHONE_SAY}. We look forward to serving you.",
    photos=[])

B = lambda *n: [f"banner/{x}.jpg" for x in n]
C = lambda *n: [f"commons/{x}.jpg" for x in n]

ADS = {
 "computers": dict(title="Computers, Accessories & Repairs", colour=(20, 60, 170), scenes=[
   dict(heading="Computers, Accessories & Repairs", sub="Sales, repairs and everyday computer services",
        say="At Grony Multimedia in Assin Foso, we sell computer accessories, and we repair laptops and desktops. Here is some of what we have in the shop.",
        photos=B("computers_0", "computers_1", "computers_2", "computers_3")),
   dict(heading="Laptop chargers", bullets=["HP, Dell and Lenovo: big pin and small pin", "Lenovo and Type C chargers", "Asus, Acer, Samsung", "Toshiba and Sony, 15 and 19 volts", "MacBook Air and MacBook Pro", "Phone chargers and a 30,000 mAh power bank"],
        say="Laptop chargers for H P, Dell and Lenovo, with big pin and small pin. Type C chargers. Chargers for Asus, Acer, Samsung, Toshiba and Sony, and for MacBook Air and MacBook Pro. We also have phone chargers, and a thirty thousand milliamp power bank.",
        photos=C("charger_1") + B("computers_0")),
   dict(heading="Mouse & keyboards", bullets=["Wireless and wired mouse: HP, Dell, Logitech", "Chargeable mouse", "Wireless, wired and Bluetooth keyboards", "Long, mini and flexible keyboards", "Mouse pads, laptop stands, cooling pads"],
        say="Wireless and wired mouse from H P, Dell and Logitech, and chargeable mouse. Wireless, wired and Bluetooth keyboards, in long, mini and flexible types. Plus mouse pads, laptop stands and cooling pads.",
        photos=C("mouse_2") + B("computers_3")),
   dict(heading="Cables", bullets=["HDMI: 1.5 m, 3 m, 5 m, 10 m, 20 m, 30 m", "Fibre optic HDMI: 50 m and 100 m", "VGA: 1.8 m up to 50 m", "Network cable: 1.5 m up to 30 m", "Printer cable, power cable, USB extension", "Type C and iPhone cables"],
        say="Cables of every length. H D M I cables from one and a half metres up to thirty metres, and fibre optic H D M I for fifty and one hundred metres. V G A cables up to fifty metres. Network cables, printer cables, power cables, U S B extensions, and Type C and iPhone cables.",
        photos=C("hdmi_2", "hdmi_0")),
   dict(heading="Connectors & converters", bullets=["HDMI splitters: 4 and 8 ports", "VGA to HDMI, HDMI to VGA, USB to HDMI", "Type C 8 in 1 converter", "USB hubs: 4 and 7 ports, OTG", "Bluetooth and WiFi adapters", "MiFi, routers and modems"],
        say="Connectors and converters. H D M I splitters with four or eight ports. V G A to H D M I, H D M I to V G A, and U S B to H D M I. Type C eight in one converters, U S B hubs, Bluetooth and WiFi adapters, MiFi, routers and modems.",
        photos=C("hdmi_2") + B("software_3")),
   dict(heading="Storage", bullets=["Pen drives: 4, 8, 16, 32 and 64 GB", "64 GB Type C + USB pen drive", "Memory cards: 32 and 64 GB", "Hard disks, external cases, SATA to USB", "Multi card readers"],
        say="Storage. Pen drives from four to sixty four gigabytes, memory cards for phones and cameras, hard disks, external hard disk cases, and card readers.",
        photos=C("usb_0", "usb_1")),
   dict(heading="Gaming, sound & batteries", bullets=["PS4 and Xbox 360 gamepads", "Phone and wireless gamepads", "Speakers", "Laptop batteries: Dell, HP, Toshiba", "CMOS batteries"],
        say="Gamepads for P S 4, Xbox three sixty and phones. Speakers. Laptop batteries for Dell, H P and Toshiba, and C MOS batteries.",
        photos=C("gamepad_0") + B("hiring_2")),
   dict(heading="Repairs", bullets=["Laptop and desktop repairs", "Hardware fixing and upgrades", "Data recovery", "Printer repairs", "Cooling paste and cleaning"],
        say="And when something breaks, bring it to us. We repair laptops and desktops, fix hardware, recover lost data, and repair printers.",
        photos=B("computers_1", "computers_2")),
   CONTACT]),

 "materials": dict(title="Printing Materials, Toner & Ink", colour=(70, 40, 160), scenes=[
   dict(heading="Printing Materials, Toner & Ink", sub="Supplies for your office, school and shop",
        say="Grony Multimedia, Assin Foso, supplies printing materials, toner and ink for offices, schools and shops. Here is what we stock.",
        photos=B("materials_0", "materials_1", "materials_2", "materials_3")),
   dict(heading="Toner cartridges", bullets=["HP: 05A, 12A, 17A, 26A, 55A, 83A, 85A", "HP: 87A, 90A, 106A, 107A, 150A, 151A", "Colour: 131A and 827A", "Canon C-EXV 28 and C-EXV 33", "Canon 1435i, 2025, 2206, 2870, 3300", "Canon 3225N, 5235, 6780x, and Brother"],
        say="Toner cartridges for H P printers: zero five A, twelve A, seventeen A, twenty six A, fifty five A, eighty three A, eighty five A, and many more. Colour cartridges, one three one A and eight two seven A. And Canon toner for the C E X V twenty eight, the C E X V thirty three, and most Canon photocopiers. We also have Brother toner.",
        photos=C("toner_1") + B("materials_3")),
   dict(heading="Toner refills", bullets=["Best Print: 250 g, 500 g, 1 kg", "Colour refills: black, cyan, magenta, yellow", "Golden Crown and Best Colour", "SX toner refill"],
        say="Toner refill powder. Best Print in two hundred and fifty grams, five hundred grams, and one kilo. And colour refills in black, cyan, magenta and yellow, from Golden Crown and Best Colour.",
        photos=B("materials_0")),
   dict(heading="Drums, blades & parts", bullets=["Canon drums and blades", "HP drums and blades", "M880 drum and chip", "HP P1155 fuser film"],
        say="Spare parts for your printer and photocopier: drums and blades for Canon and H P, the M eight eighty drum and chip, and fuser film.",
        photos=B("printing_1", "printing_3")),
   dict(heading="Inks", bullets=["Advance, Bulk, Aplus and Perfect ink", "100 ml and 250 ml bottles", "Black, cyan, magenta, yellow", "Light cyan and light magenta", "Epson tank: 4 and 6 colours"],
        say="Ink for inkjet printers. Advance, Bulk, Aplus and Perfect ink, in one hundred and two hundred and fifty millilitre bottles. Black, cyan, magenta, yellow, light cyan and light magenta. And Epson tank ink sets.",
        photos=C("ink_0") + B("materials_1")),
   dict(heading="Paper & cardboard", bullets=["A4 sheets: Double A, Mambo, Bestprint", "A3 sheets and coloured sheets", "Cardboard: blue, green, pink, yellow, white", "Photo paper: 4x6, 5x7, A4, A3", "120 g up to 300 g, single or double side", "A4 and A3 sticker paper"],
        say="Paper. A4 sheets from Double A, Mambo and Bestprint, A3 sheets, and coloured sheets. Cardboard in blue, green, pink, yellow and white. Photo paper in four by six, five by seven, A4 and A3, from one hundred and twenty up to three hundred grams. And sticker paper.",
        photos=B("materials_2", "printing_2")),
   dict(heading="Stationery", bullets=["Lamination: A4, A3 and ID", "Binding slides 6 to 16 mm, PVC rings and covers", "Envelopes: brown A4 and A3, white DL, quarto", "Staplers, staple pins, hole punchers", "Pens, cellotape, correction pens, files", "ID card holders and ropes, scissors"],
        say="And stationery. Lamination sheets, binding slides and rings, P V C covers, brown and white envelopes, staplers and pins, hole punchers, pens, cellotape, files, and I D card holders.",
        photos=C("stapler_0")),
   CONTACT]),

 "printing": dict(title="Printing Press & Internet Cafe", colour=(110, 30, 120), scenes=[
   dict(heading="Printing Press & Internet Cafe", sub="Print, photocopy, scan and browse",
        say="Grony Multimedia is your printing press and internet cafe in Assin Foso. Print, photocopy, scan, and get your online work done.",
        photos=B("printing_0", "printing_1", "printing_2", "printing_3")),
   dict(heading="Everyday printing", bullets=["Printing and photocopy: A4 and A3", "Colour printing", "Scanning, typing and document editing", "CVs, testimonials, payslips", "Ghana Card copies", "Email sending"],
        say="Everyday printing. Black and colour printing, photocopies in A4 and A3, scanning, typing and document editing. C Vs, testimonials, payslips, Ghana Card copies, and email sending.",
        photos=B("printing_1", "printing_3")),
   dict(heading="Pictures", bullets=["Passport pictures", "4x6 and 5x7 pictures", "A4 and A3 photo printing", "Picture editing", "Lamination and binding"],
        say="Pictures. Passport pictures, four by six and five by seven prints, and A4 and A3 photo printing. We edit pictures, laminate, and bind.",
        photos=B("printing_2", "media_0")),
   dict(heading="Banners, posters & stickers", bullets=["Banners: 3, 4, 5 and 6 feet", "Posters and stickers", "Funeral banners and posters", "Wedding banners", "Large format printing"],
        say="Large format printing. Banners from three to six feet, posters, and stickers. Funeral banners and posters, and wedding banners.",
        photos=B("printing_0")),
   dict(heading="Cards, books & design", bullets=["Wedding and funeral invitation cards", "Certificates and brochures", "Receipt books, invoices, dues books", "Book printing", "Envelope printing", "Design"],
        say="Cards and books. Wedding and funeral invitation cards, certificates, brochures, receipt books, invoices, dues books and book printing. And we design them for you.",
        photos=B("printing_3")),
   dict(heading="Online registration", bullets=["WAEC registration, BECE and WASSCE checkers", "KNUST, UCC, UEW, CCTU, AAMUSTED", "Nursing and Colleges of Education", "NSS registration and evaluation", "GETFund, NTC, Ghana Armed Forces", "School placement"],
        say="Online registration, done for you. WAEC registration, and BECE and WASSCE result checkers. University forms for KNUST, U C C, U E W, C C T U and AAMUSTED. Nursing, Colleges of Education, N S S, GETFund, N T C, the Ghana Armed Forces, and school placement.",
        photos=B("software_1")),
   CONTACT]),

 "training": dict(title="Computer Training", colour=(10, 90, 90), scenes=[
   dict(heading="Computer Training", sub="Learn the skills for school and work",
        say="Want to use a computer with confidence? Grony Multimedia in Assin Foso offers computer training, for the skills you need at school and at work.",
        photos=B("training_0", "training_1", "training_2", "training_3")),
   dict(heading="What you can learn", bullets=["Using a computer from the start", "Typing", "Microsoft Word", "Microsoft Excel", "PowerPoint", "Internet and email"],
        say="Start from the beginning, and learn how to use a computer. Then typing, Microsoft Word, Excel, and PowerPoint. And how to use the internet and email.",
        photos=B("training_0", "training_1")),
   dict(heading="Who it is for", bullets=["Students", "Workers and job seekers", "Shop and business owners", "Complete beginners"],
        say="It is for students, workers and job seekers, business owners, and complete beginners. Call us to ask about class times and fees.",
        photos=B("training_3")),
   CONTACT]),

 "software": dict(title="Software & App Development", colour=(20, 70, 140), scenes=[
   dict(heading="Software & App Development", sub="Custom software and mobile apps",
        say="Grony Multimedia builds software and mobile apps, made for the way you work.",
        photos=B("software_0", "software_1", "software_2", "software_3")),
   dict(heading="What we build", bullets=["Software for your business", "Mobile apps", "Stock and sales records", "Customer lists and records", "Websites"],
        say="We build software for your business, and mobile apps. For example, stock and sales records, and customer lists. We run our own shop on software we built.",
        photos=B("software_0", "software_2")),
   dict(heading="How it works", bullets=["Tell us what you need", "We design it", "We build it", "We help you and your staff use it"],
        say="Tell us what you need. We design it, we build it, and we help you and your staff use it.",
        photos=B("software_1")),
   CONTACT]),

 "website": dict(title="Website Design & Hosting", colour=(15, 90, 70), scenes=[
   dict(heading="Website Design & Hosting", sub="Get your business online",
        say="Get your business online with Grony Multimedia. We design websites and host them.",
        photos=B("website_0", "website_1", "website_2", "website_3")),
   dict(heading="What you get", bullets=["A website for your business, school or church", "Works on phones and computers", "Hosting: we keep it online", "Your phone, location and services", "Changes when you need them"],
        say="A website for your business, school or church, that works on phones and computers. We host it and keep it online, and show your phone number, location and services, so customers can find you.",
        photos=B("website_0", "website_1")),
   CONTACT]),

 "media": dict(title="Photo, Sound & Video Production", colour=(120, 30, 60), scenes=[
   dict(heading="Photo, Sound & Video Production", sub="Photoshoots, video, adverts and music",
        say="Grony Multimedia does photo, sound and video production in Assin Foso.",
        photos=B("media_0", "media_1", "media_2", "media_3")),
   dict(heading="Photos", bullets=["Photoshoots", "Passport pictures", "Picture editing", "Photo framing", "Photo printing"],
        say="Photos. Photoshoots, passport pictures, picture editing, photo framing and photo printing.",
        photos=B("media_0", "media_2")),
   dict(heading="Video & sound", bullets=["Video editing", "Video adverts", "Audio adverts and jingles", "Music download"],
        say="Video and sound. Video editing, video adverts for your business, audio adverts and jingles, and music download.",
        photos=B("media_1", "media_3")),
   dict(heading="Equipment to hire", bullets=["Camera hire", "Camera flash hire"],
        say="And if you want to shoot it yourself, you can hire a camera and a camera flash.",
        photos=B("hiring_0")),
   CONTACT]),

 "hiring": dict(title="Hiring Services", colour=(120, 80, 20), scenes=[
   dict(heading="Hiring Services", sub="Equipment and services, when you need them",
        say="Need equipment for a day? Grony Multimedia in Assin Foso hires it out.",
        photos=B("hiring_0", "hiring_1", "hiring_2", "hiring_3")),
   dict(heading="What you can hire", bullets=["Cameras", "Camera flash", "Printers", "Ask us about other equipment"],
        say="Hire a camera, a camera flash, or a printer for your event or your office. Ask us about other equipment.",
        photos=B("hiring_0", "hiring_1")),
   CONTACT]),
}

ADS["main"] = dict(title="Everything in one place", colour=(30, 50, 140), scenes=[
   dict(heading="Grony Multimedia", sub="Everything in one place, Assin Foso",
        say="Grony Multimedia, Assin Foso. Printing, computers, software, photo, sound and video, all in one place.",
        photos=B("computers_0", "printing_0", "materials_3", "media_0")),
   dict(heading="Printing & internet cafe", bullets=["Printing, photocopy, scanning", "Passport pictures and photo prints", "Banners, posters, stickers", "Invitation cards, certificates", "Online registration and result checkers"],
        say="Printing, photocopy and scanning. Passport pictures and photo prints. Banners, posters and stickers. Invitation cards and certificates. And online registration and result checkers.",
        photos=B("printing_0", "printing_2")),
   dict(heading="Toner, ink & paper", bullets=["HP and Canon toner cartridges", "Toner refills, drums and blades", "Inks: 100 ml and 250 ml", "A4 and A3 sheets, photo paper, cardboard", "Stationery"],
        say="Toner cartridges for H P and Canon, toner refills, drums and blades, ink, paper, photo paper, cardboard and stationery.",
        photos=B("materials_3", "materials_1")),
   dict(heading="Computers & accessories", bullets=["Laptop chargers for all brands", "Mouse and keyboards", "HDMI, VGA and network cables", "Pen drives and memory cards", "Repairs and data recovery"],
        say="Laptop chargers for all brands, mouse and keyboards, cables, pen drives and memory cards. And repairs and data recovery.",
        photos=B("computers_0", "computers_1")),
   dict(heading="Software, websites & media", bullets=["Software and mobile apps", "Website design and hosting", "Computer training", "Photoshoots and video editing", "Camera and printer hire"],
        say="Software, mobile apps and websites. Computer training. Photoshoots and video editing. And camera and printer hire.",
        photos=B("software_0", "media_0")),
   CONTACT])

# All services: one short scene per service, then contact.
ADS["all"] = dict(title="All our services", colour=(40, 40, 120), scenes=[
   dict(heading="Our Services", sub="Grony Multimedia, Assin Foso",
        say="Welcome to Grony Multimedia, between G C B and A D B Bank in Assin Foso. Here are all our services.",
        photos=B("computers_0", "printing_0", "materials_3", "media_0"))] + [
   dict(heading=ADS[k]["title"], bullets=ADS[k]["scenes"][1]["bullets"], say=s, photos=ADS[k]["scenes"][0]["photos"][:2]) for k, s in [
     ("computers", "Computers, accessories and repairs. Laptop chargers for every brand, mouse, keyboards, cables, pen drives, and repairs."),
     ("training", "Computer training. Typing, Word, Excel, PowerPoint, the internet and email."),
     ("printing", "Our printing press and internet cafe. Printing, photocopy, scanning, pictures, banners, cards, and online registration."),
     ("materials", "Printing materials. H P and Canon toner, refills, ink, paper and stationery."),
     ("software", "Software and mobile app development, made for your business."),
     ("website", "Website design and hosting, to get your business online."),
     ("media", "Photo, sound and video production. Photoshoots, video editing, adverts and jingles."),
     ("hiring", "And hiring. Cameras, camera flash and printers."),
   ]] + [CONTACT])
