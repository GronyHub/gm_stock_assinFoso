Context: I'm Grony, owner of Grony Multimedia (printing, tech and media shop, Assin Foso, Ghana). I live in the UK; staff are in Ghana; Joe is the manager. I've been building our staff documents and shop tools in a claude.ai chat and I'm continuing here, in the repo that holds the GM app (app.gronymultimedia.com, Next.js, hosted on our DigitalOcean droplet - not Vercel).

I've unzipped grony-handoff.zip into the repo root. It adds:
- docs/standards/ - PDF generators (Python, ReportLab) plus the built PDFs
- app/register/page.tsx and app/api/public/register/route.ts - public customer registration form (not deployed yet)

STANDARDS DOCUMENT RULES
- ONE combined document: Grony_Multimedia_Complete_Checklist.pdf. Hard limit 3 A4 pages, 4 columns, tiny type. Never split it into separate files.
- Keep the station sections (Grony 1, 2, 3, 4, 5, 6, 7 & 8), each with its own checks and red markers (tags like G2-1).
- Every line is a tick-box check; procedures go inside the line as a short grey "How:" note. Don't duplicate checks.
- Build: cd docs/standards; pip install reportlab pypdf; python build_complete_checklist.py [bodyFont] [diagramScale] [out.pdf] (defaults 4.8 0.54). If the page count goes over 3, lower the font until it fits.
- build_complete_checklist.py reads build_checklist.py (shop-wide content) and build_station_sheet.py (Grony 2 services, inventory, printer info stickers) as TEXT and execs slices between marker strings. Keep these intact: check("A. OPENING / # ================= TABLES PAGE / check("I. SHOP WORKS / check("C. STATION CHECK / check("RED MARKERS - FIX FIRST" / svc("BEFORE EVERY JOB" / # ================= PAGE 4 / Q=" (qty ___)" / # ================= PAGE 5 / STRIP="Keep on power / ct=Table(. Red markers are tagged G1-, G2-, G5-, G7-, G8-, ALL- and are routed to their station sections by tag. If you would rather move the content into one data file, propose it first.
- Avoid characters Helvetica cannot print (emoji, tick marks, box symbols); use words.

DECISIONS ALREADY MADE (do not change)
- Official company number for calls, WhatsApp and Mobile Money: 053 432 8977 (wa.me/233534328977). The old number 024 853 3826 is discarded everywhere.
- Written work forms no longer exist; all sales, bills and expenses are recorded in the GM app.
- Customers register at app.gronymultimedia.com/register and get a GM number (e.g. GM0024); their folders and WhatsApp contacts use it; it qualifies them for raffles after a certain amount of work (threshold not set yet).
- Printers have letter names on screen: B - Epson ET-2860, C and E - HP M880m RESERVED, D - Epson Photo, F - Epson Cream, G - Epson L8050. The HP M880m is reserved for extreme cases; I have not said which one (C or E).
- No personal phone numbers, MoMo numbers or personal emails given to customers or signed in on browsers; the customer's WhatsApp chat is the source of truth.

TASKS - go step by step; stop for my confirmation before any data change or deploy
1. Set up docs/standards: confirm the three builders run and the combined PDF is 3 pages. Add a short "Standards documents" section to CLAUDE.md with the rules above. Commit the scripts (PDFs optional).
2. Registration form: review both files against our conventions (lib/db, logActivity, GM-number logic). Edit proxy.ts so /register and /api/public/* skip login: matcher ['/((?!api/auth|api/public|login|register|_next/static|_next/image|favicon.ico).*)']. Replace the old number everywhere in the repo, including public-site/index.html. Build, deploy to the droplet, test logged out, delete the test customer.
3. GM app Properties: list them. The app has printers named "HP 880 A3 PRINTER B" (Grony 2) and "HP M880 PRINTER 1" (Grony 3) that do not match our letters, and only 7 of 197 properties have a location. Propose renames and locations (the Grony 2 inventory is in build_station_sheet.py) and wait for my approval. The Neon database hit free-tier limits earlier, so check connectivity before running queries.
4. Handbook laws (page_laws): show the full list of stale or unfinished laws; propose removals and adding the 13 newer standards (see sections A, B, B2 and F in build_checklist.py). Wait for my approval.
5. Ask me first: recurring tasks in custom_tasks (Wednesday fire-alarm test, Saturday cash-at-bank confirmation, weekly "5 new customers").

OPEN ITEMS you may need from me: which M880 is reserved (C or E); the Claude chat name for each printer; the exact Bluetooth name set on the Grony 1 laptop (the Grony 1 sticker says GRONY 1, but Windows cannot use a space, so it will be regenerated); photos of Grony 1, 3, 4, 5, 6; the raffle threshold.
