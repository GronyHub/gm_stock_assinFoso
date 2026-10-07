"""Print one SQL INSERT for standards_items from standards_export.json (red-marker duplicates merged). Run export_standards.py first."""
import json, sys
d = json.load(open('standards_export.json', encoding='utf-8'))
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
