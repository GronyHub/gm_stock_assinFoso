"""Print one SQL INSERT for standards_items from standards_export.json (red-marker duplicates merged). Run export_standards.py first."""
import json, sys
d = json.load(open('standards_export.json', encoding='utf-8'))
FIXES = [("as on the Grony 2 sheet (p4)", "as in the Grony 2 printers list"), ("Location chart and Printer Register (p5)", "Location chart and printers list"),
 ("location chart and Printer Register (p5)", "location chart and printers list"), ("Printer Register (p4)", "printers list"), ("Printer Register (p5)", "printers list"),
 ("Done Log (p5)", "Done Log"), ("the table on page 4", "the printers list in this section"), ("Grony 2's are on its station sheet, p5", "Grony 2's are in its Grony 2 section")]
for x in d:
    for k in ('text', 'how', 'note'):
        for a, b in FIXES: x[k] = x[k].replace(a, b)
    if x['text'].startswith('printers list completed'): x['text'] = 'Printers' + x['text'][len('printers'):]
seen = {}
rows = []
for x in d:
    if x['tag']:
        k = (x['station'], x['text'].lower())
        if k in seen:
            if len(x['how']) > len(rows[seen[k]]['how']): rows[seen[k]] = x
            continue
        seen[k] = len(rows)
    rows.append(x)
def q(s): return "NULL" if not s else "$q$" + s + "$q$"
vals = ",\n".join(f"({q(r['station'])},{q(r['section'])},{q(r['note'])},{r['position']},{q(r['text'])},{q(r['how'])},{q(r['tag'])},'{r['frequency']}','{r['kind']}')" for r in rows)
sys.stdout.write("INSERT INTO standards_items (station, section, section_note, position, text, how, tag, frequency, kind) VALUES\n" + vals)
sys.stderr.write(f"{len(rows)} rows after merging {len(d)-len(rows)} duplicates\n")
