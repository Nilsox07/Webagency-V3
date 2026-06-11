#!/usr/bin/env python3
"""css-prune.py — entfernt tote Selektoren tranchenweise (Nacht-Aufräumlauf Phase 3).
Aufruf: css-prune.py <cssfile> <tranche-nr> <tranche-groesse>
Toter Selektor = kein Nicht-Zustands-Klassen/ID-Token kommt in irgendeinem HTML/JS vor.
Dynamik-Schutz: Präfixe aus Konkatenationen (z. B. "s-" in admin.html) gelten als lebendig.
"""
import re, sys, glob, os
os.chdir(os.path.join(os.path.dirname(__file__), '..'))

corpus = ''
for f in glob.glob('*.html') + glob.glob('*.js'):
    corpus += open(f, encoding='utf-8').read() + '\n'
# dynamische Präfixe: '<prefix-' + expr  → alle <prefix>-* leben
DYN = set(re.findall(r"""['"]([A-Za-z][A-Za-z0-9_-]*-)['"] ?\+""", corpus))
DYN |= set(re.findall(r"""[ "']([A-Za-z][A-Za-z0-9_-]*-)' ?\+""", corpus))
STATE = {'on', 'active', 'open', 'show', 'lock', 'hidden', 'error', 'visible', 'is-open', 'lb-anim-in'}

def parse(css):
    rules = []; i = 0; n = len(css); sel_start = 0
    while i < n:
        if css.startswith('/*', i):
            j = css.find('*/', i + 2); i = (j + 2) if j > -1 else n; sel_start = i; continue
        c = css[i]
        if c == '{':
            sel = css[sel_start:i].strip()
            if sel.startswith('@media') or sel.startswith('@supports'):
                sel_start = i + 1; i += 1; continue
            depth = 1; j = i + 1
            while j < n and depth:
                if css[j] == '{': depth += 1
                elif css[j] == '}': depth -= 1
                j += 1
            rules.append((sel, sel_start, j)); i = j; sel_start = i; continue
        if c == '}':
            i += 1; sel_start = i; continue
        i += 1
    return rules

def is_dead(sel):
    toks = set(re.findall(r'[.#]([A-Za-z][A-Za-z0-9_-]*)', sel))
    nonstate = [t for t in toks if t not in STATE]
    if not nonstate: return False
    for t in nonstate:
        if t in corpus: return False
        if any(t.startswith(p) for p in DYN): return False
    return True

cssfile, tranche, size = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
css = open(cssfile, encoding='utf-8').read()
rules = parse(css)
dead = [(s, a, b) for (s, a, b) in rules if not s.startswith('@') and s and is_dead(s)]
lo, hi = (tranche - 1) * size, tranche * size
batch = dead[lo:hi]
if not batch:
    print(f'{cssfile}: Tranche {tranche} leer (gesamt tot: {len(dead)})'); sys.exit(0)
for sel, a, b in sorted(batch, key=lambda x: -x[1]):
    css = css[:a] + css[b:]
# leere @media-Hüllen entfernen
css = re.sub(r'@media[^{}]*\{\s*\}', '', css)
css = re.sub(r'\n{3,}', '\n\n', css)
open(cssfile, 'w', encoding='utf-8').write(css)
print(f'{cssfile}: Tranche {tranche}: {len(batch)} Selektoren entfernt (gesamt tot: {len(dead)})')
for s, _, _ in batch: print('  -', s.replace(chr(10), ' ')[:90])
