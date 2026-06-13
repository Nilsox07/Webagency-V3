'use strict';
// Reine Projekt-Logik (gut unit-testbar): Phasen-Timeline, Blocker-Box, Liefertermin-Countdown,
// Vollständigkeit der Inhalte. Keine DB-Zugriffe hier.

const PHASES = [
  { key: 'angebot', label: 'Angebot' },
  { key: 'angenommen', label: 'Angenommen' },
  { key: 'inhalte', label: 'Inhalte' },
  { key: 'design', label: 'Design' },
  { key: 'korrektur', label: 'Korrektur' },     // deckt korrektur_1..4 ab
  { key: 'finalisierung', label: 'Finalisierung' },
  { key: 'abnahme', label: 'Abnahme' },
  { key: 'live', label: 'Live' },
];

function canonical(status) { return String(status || '').startsWith('korrektur') ? 'korrektur' : status; }
function phaseIndex(status) { return PHASES.findIndex((p) => p.key === canonical(status)); }

// Timeline mit Zustand je Phase: done | current | todo.
function timeline(status) {
  const i = phaseIndex(status);
  return PHASES.map((p, idx) => ({ key: p.key, label: p.label, state: idx < i ? 'done' : idx === i ? 'current' : 'todo' }));
}

// Nicht-leere Stichpunkt-Zeilen.
function stichpunkteLines(text) {
  return String(text || '').split('\n').map((l) => l.trim()).filter(Boolean);
}
const MIN_LINES = 5;
function seiteReady(seite) { return stichpunkteLines(seite.stichpunkte).length >= MIN_LINES; }

// Sind ALLE Pflichtteile der Inhalte-Strecke da? Redesign = Kurz-Strecke (Alt-URL + Zugänge).
function inhalteReady(projekt, seiten, opts) {
  opts = opts || {};
  if (projekt.is_redesign) {
    return !!(String(projekt.alt_url || '').trim()) && !!opts.zugaengeVorhanden;
  }
  if (!seiten.length) return false;
  return seiten.every(seiteReady);
}

// Blocker-Box „Das fehlt gerade von dir" — abgeleitet, nie geraten.
function blockers(projekt, ctx) {
  ctx = ctx || {};
  const out = [];
  const base = '/portal/projekt/' + projekt.id;
  if (projekt.status === 'angebot') {
    out.push({ text: 'Dein Angebot wartet auf deine Zusage.', href: base + '/dokumente' });
  }
  const offene = (ctx.offeneSeiten || []);
  if (projekt.status === 'inhalte' && offene.length) {
    out.push({ text: 'Stichpunkte fehlen noch für: ' + offene.map((s) => s.seitenname).join(', '), href: base + '/inhalte' });
  }
  if (projekt.is_redesign && projekt.status === 'inhalte' && !String(projekt.alt_url || '').trim()) {
    out.push({ text: 'Bitte hinterlege die Adresse deiner bestehenden Website.', href: base + '/inhalte' });
  }
  (ctx.offeneSchaetzungen || []).forEach((k) => {
    out.push({ text: 'Kostenschätzung freigeben: ' + (k.beschreibung || 'offene Schätzung'), href: base });
  });
  if (ctx.offeneRunde) {
    out.push({ text: 'Du kannst deine Korrekturrunde einreichen.', href: base + '/vorschau' });
  }
  return out;
}

// Liefertermin-Countdown startet ERST, wenn die Inhalte vollständig sind.
function countdownDays(projekt, now) {
  if (!projekt.inhalte_vollstaendig_am || !projekt.liefertermin) return null;
  const today = now ? new Date(now) : new Date();
  const ziel = new Date(projekt.liefertermin);
  return Math.ceil((ziel - today) / 86400000);
}

module.exports = { PHASES, MIN_LINES, timeline, phaseIndex, stichpunkteLines, seiteReady, inhalteReady, blockers, countdownDays };
