"""Extract checklist lines from the PDF builders into standards_export.json (no PDF is built)."""
import ast, json, re, html, sys

def load(path):
    src = open(path, encoding='utf-8').read()
    tree = ast.parse(src)
    consts = {}
    for n in tree.body:
        if isinstance(n, ast.Assign) and len(n.targets) == 1 and isinstance(n.targets[0], ast.Name):
            try: consts[n.targets[0].id] = ev(n.value, consts)
            except Exception: pass
    calls = [n.value for n in ast.walk(tree) if isinstance(n, ast.Expr) and isinstance(n.value, ast.Call)
             and isinstance(n.value.func, ast.Name) and n.value.func.id in ('check', 'svc')]
    calls.sort(key=lambda c: c.lineno)
    return calls, consts

def ev(n, consts):
    if isinstance(n, ast.Constant): return n.value
    if isinstance(n, ast.JoinedStr): return ''.join(str(ev(v, consts)) if isinstance(v, ast.FormattedValue) else v.value for v in n.values)
    if isinstance(n, ast.FormattedValue): return ''
    if isinstance(n, ast.Name): return consts.get(n.id, '')
    if isinstance(n, ast.BinOp) and isinstance(n.op, ast.Add): return ev(n.left, consts) + ev(n.right, consts)
    if isinstance(n, ast.Call) and isinstance(n.func, ast.Name):
        if n.func.id == 'HOW': return '\x01' + ev(n.args[0], consts) + '\x02'
        if n.func.id == 'TAG': return '\x03' + ev(n.args[0], consts) + '\x04'
    if isinstance(n, (ast.List, ast.Tuple)): return [ev(e, consts) for e in n.elts]
    raise ValueError(ast.dump(n)[:80])

def clean(t): return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', '', t.replace('<br/>', ' ')))).strip()

def split_item(raw):
    how = ' '.join(re.findall('\x01(.*?)\x02', raw)); tag = (re.findall('\x03(.*?)\x04', raw) or [''])[0]
    body = re.sub('\x01.*?\x02|\x03.*?\x04', '', raw)
    m = re.match(r'\s*<b>((?:G\d+|ALL)-\d+)</b>\s*(.*)', body, re.S)
    if m: tag, body = m.group(1), m.group(2)
    return clean(body), clean(how), tag

SHOP = [
 ('A.', 'daily'), ('B2.', 'daily'), ('B.', 'daily'), ('C.', 'daily'), ('D.', 'daily'), ('E.', 'daily'),
 ('F.', 'weekly'), ('G.', 'monthly'), ('H.', 'once'), ('RED', 'once'), ('I.', 'once'), ('J.', 'weekly'),
 ('K.', 'weekly'), ('L.', 'daily'), ('M.', 'once'), ('N.', 'weekly'), ('O.', 'once'), ('P.', 'weekly'),
 ('Q.', 'once'), ('R.', 'weekly'), ('S.', 'weekly')]
G2 = [('1.', 'daily'), ('2.', 'daily'), ('3.', 'daily'), ('4.', 'daily'), ('5.', 'weekly'), ('RED', 'once'),
      ('PRINTERS AT', 'once'), ('LABELLED', 'weekly'), ('COMPUTER', 'monthly'), ('PRINTERS &', 'monthly'),
      ('FURNITURE', 'monthly'), ('TOOLS', 'monthly'), ('MATERIALS', 'monthly'), ('STOCK IN', 'daily')]

def freq(title, table, is_svc):
    if is_svc: return 'daily'
    for p, f in table:
        if title.startswith(p): return f
    return 'weekly'

def item_freq(text, base):
    u = text.upper()
    if re.match(r'(MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY)\b', u): return 'weekly'
    if base == 'monthly' and re.search(r'\b(YEAR|ANNUAL|YEARLY)\b', u): return 'yearly'
    return base

out = []
for path, table, default_station in (('build_checklist.py', SHOP, 'Shop'), ('build_station_sheet.py', G2, 'Grony 2')):
    calls, consts = load(path)
    for c in calls:
        is_svc = c.func.id == 'svc'
        title = clean(ev(c.args[0], consts)); items = ev(c.args[1] if is_svc else c.args[2], consts)
        note = '' if is_svc else clean(ev(c.args[1], consts))
        if is_svc and len(c.args) > 2:
            try: note = clean(ev(c.args[2], consts))
            except Exception: pass
        base = freq(title, table, is_svc)
        for pos, raw in enumerate(items):
            if not isinstance(raw, str): continue
            text, how, tag = split_item(raw)
            st = default_station
            if tag:
                st = {'ALL': 'All stations'}.get(tag.split('-')[0], 'Grony ' + tag.split('-')[0][1:])
            elif title.startswith('C. STATION'): st = 'Grony 1 & 2'
            elif title.startswith('S. APPROVED'): st = 'Grony 1 & 2'
            out.append(dict(source=path, station=st, section=title, note=note, position=pos, text=text, how=how, tag=tag,
                            frequency=item_freq(text, base), kind='procedure' if is_svc else 'check'))
json.dump(out, open('standards_export.json', 'w'), indent=1, ensure_ascii=False)
print(len(out), 'lines')
