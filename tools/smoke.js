/* smoke.js — Selbsttest für den Nacht-Aufräumlauf (webagency-v3)
   Checks:
   a) HTML: je Seite genau 1 <title>, 1 <h1>; alle lokalen script-src/link-href existieren
   b) JSON-LD aller Seiten: JSON.parse fehlerfrei
   c) interne Links (ohne http/#/mailto/tel) zeigen auf existierende Seiten/Anker
   d) node --check über alle JS-Dateien (Repo-Root)
   e) pricing.js + pricing-calc.js byte-identisch zu main (git diff)
   f) Lumi-Durchlauf in jsdom (Pfad A: Konfigurator + Paketwechsel + Extra-Toggle;
      Pfad B: "Nur ein Design" bis Kontakt-Screen) — kein window-error, Preisleiste zeigt €
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

/* ---------- e) Schutzliste byte-identisch zu main ---------- */
function checkE() {
  for (const f of ['pricing.js', 'pricing-calc.js']) {
    const r = cp.spawnSync('git', ['diff', 'main', '--', f], { cwd: ROOT, encoding: 'utf8' });
    rec('e', `${f} identisch zu main`, r.stdout.trim() === '', 'Diff vorhanden');
  }
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
  w.fetch = () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}), text: () => Promise.resolve('') });
  // Seiten-Skripte in Dokumentreihenfolge ausführen
  const srcs = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1].split('?')[0]);
  for (const s of srcs) {
    const code = fs.readFileSync(path.join(ROOT, s), 'utf8');
    try { w.eval(code); } catch (e) { errors.push(s + ': ' + e.message); }
  }
  w.document.dispatchEvent(new w.Event('DOMContentLoaded', { bubbles: true }));
  return { dom, w, errors };
}
const click = (w, elm) => elm.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true, view: w }));
const q = (w, sel) => w.document.querySelector(sel);
const qa = (w, sel) => [...w.document.querySelectorAll(sel)];

function checkF() {
  // --- Pfad A: Komplette Website -> direkt zum Konfigurator ---
  try {
    const { w, errors } = lumiDom();
    const step = (sel, idx, label) => {
      const els = qa(w, sel);
      if (!els[idx || 0]) throw new Error(`Element fehlt: ${label || sel}`);
      click(w, els[idx || 0]);
    };
    step('.lb-start', 0, 'Start-Button');
    step('.lb-path-card', 0, 'Komplette Website');
    step('.lb-path-card', 0, 'direkt zum Konfigurator');
    const bar = q(w, '#lumiPriceBar');
    rec('f', 'A: Preisleiste sichtbar', !!bar && !bar.hidden, bar ? 'hidden' : 'fehlt');
    const sums = () => { const s = q(w, '#lumiPriceBar .lb-pricebar-sums'); return s ? s.textContent : ''; };
    const sum1 = sums();
    rec('f', 'A: Preisleiste zeigt €', /\d[\d.,]*\s*€/.test(sum1), `Inhalt: "${sum1}"`);
    // Paket wechseln (zweite Karte)
    const pkgs = qa(w, '.lb-pkg');
    rec('f', 'A: Paketkarten vorhanden', pkgs.length >= 2, `gefunden: ${pkgs.length}`);
    if (pkgs[1]) click(w, pkgs[1]);
    const sum2 = sums();
    rec('f', 'A: Preis nach Paketwechsel zeigt €', /\d[\d.,]*\s*€/.test(sum2), `Inhalt: "${sum2}"`);
    // Extra togglen
    const addon = q(w, '.lb-addon-toggle');
    rec('f', 'A: Extra-Toggle vorhanden', !!addon, '');
    if (addon) click(w, addon);
    const sum3 = sums();
    rec('f', 'A: Preis nach Extra-Toggle zeigt €', /\d[\d.,]*\s*€/.test(sum3), `Inhalt: "${sum3}"`);
    rec('f', 'A: keine window-errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  } catch (e) {
    rec('f', 'A: Durchlauf', false, e.message);
  }
  // --- Pfad B: Nur ein Design -> bis Kontakt-Screen ---
  try {
    const { w, errors } = lumiDom();
    click(w, q(w, '.lb-start'));
    click(w, qa(w, '.lb-path-card')[1]);                    // Nur ein Design -> d_branche
    click(w, q(w, '.lb-skip') || q(w, '.lb-next'));         // d_branche überspringen -> design
    click(w, q(w, '.lb-skip') || q(w, '.lb-next'));         // design-Screen weiter -> d_umfang
    // Produkt wählen: erster Options-Button im Stage (kein back/skip/next)
    const opt = qa(w, '#lumiStage button').find(b => !/lb-(back|skip|next)/.test(b.className) && !/btn-primary/.test(b.className));
    if (opt) click(w, opt);
    const sEl = q(w, '#lumiPriceBar .lb-pricebar-sums');
    const sum = sEl ? sEl.textContent : '';
    rec('f', 'B: Design-Preis in Leiste (€)', /\d[\d.,]*\s*€/.test(sum), `Inhalt: "${sum}"`);
    click(w, q(w, '.lb-next'));                             // -> contact
    const stageTxt = q(w, '#lumiStage').textContent;
    rec('f', 'B: Kontakt-Screen erreicht', /wohin darf Sartu dein Angebot/i.test(stageTxt), stageTxt.slice(0, 80));
    rec('f', 'B: keine window-errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  } catch (e) {
    rec('f', 'B: Durchlauf', false, e.message);
  }
}

/* ---------- g) Marker-Grep ---------- */
function checkG() {
  const markers = ['1.290', '2.990', '5.990', '9.990', '150 €/Std', 'Gefunden-werden-Programm', '[DOMAIN]', 'GO-LIVE', 'noindex'];
  const all = htmlPages().map(read).join('\n') + fs.readFileSync(path.join(ROOT, 'GO-LIVE-TODO.md'), 'utf8');
  for (const m of markers) rec('g', `Marker "${m}"`, all.includes(m), 'fehlt site-weit');
}

/* ---------- Lauf + Baseline-Logik ---------- */
checkA(); checkB(); checkC(); checkD(); checkE(); checkF(); checkG();

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
