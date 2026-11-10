@AGENTS.md

## Standards documents

**Combined checklist:** `docs/standards/Grony_Multimedia_Complete_Checklist.pdf` — hard limit 3 A4 pages, 4 columns. Combines shop-wide checks (from `build_checklist.py`) with Grony 2 services and inventory (from `build_station_sheet.py`).

**Shop structure:** the shop is treated as ONE unit (no numbered Grony stations in the app; the shop is moving to a new location). The printed checklist PDFs and their build scripts still carry the old Grony 1 to 8 station sections and tags (G2-1 etc.); they are historical and will be rebuilt for the new location.

**Build:** `cd docs/standards && pip install reportlab pypdf && python build_complete_checklist.py [bodyFont] [diagramScale] [out.pdf]` — defaults: `bodyFont=4.7`, `diagramScale=0.54`. If page count exceeds 3, lower the font size.

**Format rules:**
- Every line is a tick-box check; procedures go inline as short grey "How:" notes.
- No emoji, tick marks, or box symbols (Helvetica constraint); use words.
- Preserve marker strings in `build_checklist.py` and `build_station_sheet.py`: `check("A. OPENING /`, `check("I. SHOP WORKS /`, `check("C. STATION CHECK /`, `check("RED MARKERS - FIX FIRST" /`, `svc("BEFORE EVERY JOB /`, `# ================= PAGE 4 /`, `Q=" (qty ___)`, `# ================= PAGE 5 /`, `STRIP="Keep on power`.
- No duplicates across checks.
