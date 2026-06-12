/* smoke.js — Selbsttest für den Nacht-Aufräumlauf (webagency-v3)
   Checks:
   a) HTML: je Seite genau 1 <title>, 1 <h1>; alle lokalen script-src/link-href existieren
   b) JSON-LD aller Seiten: JSON.parse fehlerfrei
   c) interne Links (ohne http/#/mailto/tel) zeigen auf existierende Seiten/Anker
   d) node --check über alle JS-Dateien (Repo-Root)
   e) pricing.js + pricing-calc.js byte-identisch zu main (git diff)
   f) Lumi-Durchlauf in jsdom (geführter Flow für „Komplette Website" und
      „Website-Redesign" bis zur Zusammenfassung + Submit) — kein window-error, Payload-Beleg
   g) Marker-Grep (Schutz-Stichproben)
   Exit-Code 0 = grün (bzw. nur vorbestehend rote Checks, siehe BASELINE). */
'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = path.resolve(__dirname, '..');
const BASELINE_FILE = path.join(__dirname, 'smoke-baseline.json');
const results = []; // {check, name, ok, msg}
function rec(check, name, ok, msg) { results.push({ check, name, ok, msg: msg || '' }); }

function htmlPages() {
  return fs.readdirSync(ROOT).filter(f => f.endsWith('.html')).sort();
}
function read(f) { return fs.readFileSync(path.join(ROOT, f), 'utf8'); }

/* ---------- a) Struktur + Asset-Referenzen ---------- */
function checkA() {
  for (const page of htmlPages()) {
    const html = read(page);
    const titles = (html.match(/<title[\s>]/g) || []).length;
    const h1s = (html.match(/<h1[\s>]/g) || []).length;
    rec('a', `${page}: title==1`, titles === 1, `gefunden: ${titles}`);
    rec('a', `${page}: h1==1`, h1s === 1, `gefunden: ${h1s}`);
    const refs = [...html.matchAll(/(?:<script[^>]+src|<link[^>]+href|<img[^>]+src)="([^"]+)"/g)].map(m => m[1]);
    for (const r of refs) {
      if (/^(https?:)?\/\//.test(r) || r.startsWith('data:')) continue;
      const clean = r.split('?')[0].replace(/^\//, '');
      if (!clean) continue;
      rec('a', `${page}: asset ${clean}`, fs.existsSync(path.join(ROOT, clean)), 'Datei fehlt');
    }
  }
}

/* ---------- b) JSON-LD ---------- */
function checkB() {
  for (const page of htmlPages()) {
    const html = read(page);
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    blocks.forEach((b, i) => {
      let ok = true, msg = '';
      try { JSON.parse(b[1]); } catch (e) { ok = false; msg = e.message; }
      rec('b', `${page}: json-ld #${i + 1}`, ok, msg);
    });
  }
}

/* ---------- c) interne Links ---------- */
function checkC() {
  const ids = {}; // page -> Set(ids)
  for (const page of htmlPages()) {
    const html = read(page);
    ids[page] = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
  }
  for (const page of htmlPages()) {
    const html = read(page);
    const hrefs = [...html.matchAll(/<a[^>]+href="([^"]+)"/g)].map(m => m[1]);
    for (const h of hrefs) {
      if (/^(https?:|mailto:|tel:|#|javascript:)/.test(h)) continue;
      const [p, anchor] = h.split('#');
      const q = p.split('?')[0].replace(/^\//, '');
      const target = q === '' ? 'index.html' : (q.endsWith('.html') ? q : q + '.html');
      const exists = fs.existsSync(path.join(ROOT, target));
      rec('c', `${page}: link ${h}`, exists, `Ziel ${target} fehlt`);
      if (exists && anchor) {
        rec('c', `${page}: anker ${h}`, ids[target] && ids[target].has(anchor), `id="${anchor}" fehlt in ${target}`);
      }
    }
  }
}

/* ---------- d) node --check ---------- */
function checkD() {
  const js = fs.readdirSync(ROOT).filter(f => f.endsWith('.js'));
  for (const f of js) {
    const r = cp.spawnSync('node', ['--check', path.join(ROOT, f)], { encoding: 'utf8' });
    rec('d', `node --check ${f}`, r.status === 0, (r.stderr || '').split('\n')[0]);
  }
}

/* ---------- e) Schutzliste: pricing-calc.js byte-identisch; pricing.js IDs+Preise unverändert ---------- */
function checkE() {
  const r0 = cp.spawnSync('git', ['diff', 'main', '--', 'pricing-calc.js'], { cwd: ROOT, encoding: 'utf8' });
  rec('e', 'pricing-calc.js identisch zu main', r0.stdout.trim() === '', 'Diff vorhanden');
  // pricing.js: IDs und Preise müssen identisch zu main bleiben (Texte/Labels dürfen sich ändern)
  const base = cp.spawnSync('git', ['show', 'main:pricing.js'], { cwd: ROOT, encoding: 'utf8' }).stdout;
  const cur = read('pricing.js');
  const ids = s => (s.match(/id:\s*'[^']+'/g) || []).sort();
  const prices = s => (s.match(/(?:price|minPrice|pct):\s*'?\d+'?/g) || []).sort();
  rec('e', 'pricing.js: IDs unverändert', JSON.stringify(ids(cur)) === JSON.stringify(ids(base)), 'ID-Menge geändert');
  rec('e', 'pricing.js: Preise unverändert', JSON.stringify(prices(cur)) === JSON.stringify(prices(base)), 'Preis-Menge geändert');
}

/* ---------- f) Lumi-Durchlauf in jsdom ---------- */
const JSDOM_KNOWN = /Cannot create property '(value|checked)' on string/; // HTMLFormElement [OverrideBuiltins] fehlt in jsdom
function lumiDom() {
  const html = read('briefing.html');
  const vc = new VirtualConsole(); // schluckt CSS-Parse-Warnungen etc.
  vc.on('jsdomError', () => {});
  const dom = new JSDOM(html, { url: 'https://example.test/briefing', runScripts: 'outside-only', virtualConsole: vc, pretendToBeVisual: true });
  const w = dom.window;
  const errors = [];
  w.addEventListener('error', e => { const m = String(e.message || e.error); if (!JSDOM_KNOWN.test(m)) errors.push(m); });
  // Polyfills VOR den Seiten-Skripten
  w.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  w.Element.prototype.scrollIntoView = function () {};
  w.HTMLElement.prototype.scrollTo = function () {};
  w.scrollTo = function () {};
  // Browser-treuer Polyfill: benannter Formular-Control-Zugriff (form.name/email/telefon/dsgvo).
  // jsdom implementiert die benannten HTMLFormElement-Properties nicht — echte Browser schon.
  ['name', 'email', 'telefon', 'dsgvo'].forEach((fld) => {
    Object.defineProperty(w.HTMLFormElement.prototype, fld, {
      configurable: true,
      get() { return this.querySelector('[name="' + fld + '"]') || (fld === 'name' ? (this.getAttribute('name') || '') : undefined); },
    });
  });
  const fetchCalls = [];
  w.fetch = (url, opts) => { fetchCalls.push({ url: String(url), body: opts && opts.body }); return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}), text: () => Promise.resolve('') }); };
  // Seiten-Skripte in Dokumentreihenfolge ausführen
  const srcs = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1].split('?')[0]);
  for (const s of srcs) {
    const code = fs.readFileSync(path.join(ROOT, s), 'utf8');
    try { w.eval(code); } catch (e) { errors.push(s + ': ' + e.message); }
  }
  w.document.dispatchEvent(new w.Event('DOMContentLoaded', { bubbles: true }));
  return { dom, w, errors, fetchCalls };
}
const click = (w, elm) => elm.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true, view: w }));
// Treibt den geführten Flow bis zum Kontakt-Screen, füllt das Formular und sendet ab.
// Liefert das via fetch (Supabase-POST) erfasste Payload-Objekt zurück (oder null).
async function driveToSubmit(w, fetchCalls) {
  const qq = (s) => w.document.querySelector(s);
  const qaa = (s) => [...w.document.querySelectorAll(s)];
  let guard = 0;
  while (!/wohin darf Sartu dein Angebot/i.test(qq('#lumiStage').textContent) && guard++ < 30) {
    const cta = qq('#lumiPriceBar:not([hidden]) .lb-pricebar-cta');
    const next = qq('.lb-next'), skip = qq('.lb-skip');
    if (next) { click(w, next); continue; }
    if (cta) { click(w, cta); continue; }
    if (skip) { click(w, skip); continue; }
    const opt = qaa('#lumiStage button').find(b => !/lb-(back|skip|next|pricebar|addon-toggle|pkg)/.test(b.className));
    if (opt) { click(w, opt); continue; }
    break;
  }
  const form = qq('.lb-form');
  if (form) {
    form.querySelector('[name="name"]').value = 'Testnutzer';
    form.querySelector('[name="email"]').value = 'test@example.de';
    form.querySelector('[name="dsgvo"]').checked = true;
    form.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 0)); // async persist()/fetch() abwarten
  }
  const post = fetchCalls.find(c => /\/rest\/v1\/briefings/.test(c.url));
  if (!post || !post.body) return null;
  try { return JSON.parse(post.body).payload || null; } catch (e) { return null; }
}
const q = (w, sel) => w.document.querySelector(sel);
const qa = (w, sel) => [...w.document.querySelectorAll(sel)];

async function checkF() {
  // --- Weg 1: Komplette Website -> geführter Flow -> Zusammenfassung -> Submit ---
  try {
    const { w, errors, fetchCalls } = lumiDom();
    click(w, q(w, '.lb-start'));
    click(w, qa(w, '.lb-path-card')[0]);                    // "Komplette Website"
    const q1 = q(w, '.lb-q') ? q(w, '.lb-q').textContent : '';
    rec('f', 'Website -> Branche-Frage', /Branche/i.test(q1), `Frage: "${q1.slice(0, 50)}"`);
    const payA = await driveToSubmit(w, fetchCalls);
    rec('f', 'Website: Kontakt erreicht + abgesendet', !!payA, payA ? 'ok' : 'kein Payload');
    rec('f', 'Website: Submit-Payload produkt_typ=website', !!payA && payA.produkt_typ === 'website', payA ? `typ=${payA.produkt_typ}` : 'kein Payload');
    rec('f', 'Website: keine window-errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  } catch (e) {
    rec('f', 'Website: Durchlauf', false, e.message);
  }
  // --- Weg 2: Website-Redesign -> geführter Flow -> Kontakt + Submit ---
  try {
    const { w, errors, fetchCalls } = lumiDom();
    click(w, q(w, '.lb-start'));
    click(w, qa(w, '.lb-path-card')[1]);                    // Option B = Redesign
    const q1 = q(w, '.lb-q') ? q(w, '.lb-q').textContent : '';
    rec('f', 'Redesign -> Website-Flow (Branche-Frage)', /Branche/i.test(q1), `Frage: "${q1.slice(0, 50)}"`);
    const payB = await driveToSubmit(w, fetchCalls);
    rec('f', 'Redesign: Kontakt erreicht + abgesendet', !!payB, payB ? 'ok' : 'kein Payload');
    rec('f', 'Redesign: Submit-Payload produkt_typ=redesign', !!payB && payB.produkt_typ === 'redesign', payB ? `typ=${payB.produkt_typ}` : 'kein Payload');
    rec('f', 'Redesign: Material „Bestehende Website“ vorbelegt', !!payB && payB.briefing && (payB.briefing.material || []).indexOf('website') > -1, payB && payB.briefing ? JSON.stringify(payB.briefing.material) : '—');
    rec('f', 'Redesign: keine window-errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  } catch (e) {
    rec('f', 'Redesign: Durchlauf', false, e.message);
  }
}

/* ---------- g) Marker-Grep ---------- */
function checkG() {
  const markers = ['1.290', '2.990', '5.990', '9.990', '150 €/Std', 'SEO-Betreuung', '[DOMAIN]', 'GO-LIVE', 'noindex'];
  const all = htmlPages().map(read).join('\n') + fs.readFileSync(path.join(ROOT, 'GO-LIVE-TODO.md'), 'utf8');
  for (const m of markers) rec('g', `Marker "${m}"`, all.includes(m), 'fehlt site-weit');
}

/* ---------- Lauf + Baseline-Logik ---------- */
(async () => {
  checkA(); checkB(); checkC(); checkD(); checkE(); await checkF(); checkG();

  const failures = results.filter(r => !r.ok);
  let baseline = [];
  if (fs.existsSync(BASELINE_FILE)) baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
  const baseSet = new Set(baseline.map(b => b.check + '|' + b.name));
  const newFailures = failures.filter(f => !baseSet.has(f.check + '|' + f.name));

  if (process.argv.includes('--write-baseline')) {
    fs.writeFileSync(BASELINE_FILE, JSON.stringify(failures.map(({ check, name, msg }) => ({ check, name, msg })), null, 2));
    console.log(`Baseline geschrieben: ${failures.length} vorbestehend rote Checks.`);
  }
  console.log(`smoke: ${results.length} Checks · ${failures.length} rot (${failures.length - newFailures.length} vorbestehend) · ${newFailures.length} NEU rot`);
  for (const f of newFailures) console.log(`  NEU ROT [${f.check}] ${f.name} — ${f.msg}`);
  if (process.argv.includes('--verbose')) for (const f of failures) console.log(`  rot [${f.check}] ${f.name} — ${f.msg}`);
  process.exit(newFailures.length ? 1 : 0);
})();
