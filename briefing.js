/* ============================================================
   Sartu · Lumi — EIN Tool, ZWEI Pfade, mit Live-Preisberechnung
   ------------------------------------------------------------
   Einstieg: "Weißt du schon, welches Paket du möchtest?"
     • Pfad A (Konfigurator direkt): Paket → Wartung → Add-ons → Preis
     • Pfad B (Lumi-Flow, 8 Schritte): geführte Beratung → mündet in
       DENSELBEN Konfigurator-/Ergebnis-Screen (Paket vorausgewählt,
       aber jederzeit änderbar).

   Beide Pfade enden im Konfigurator mit immer sichtbarer Live-Preisleiste
   (zwei getrennte Summen: einmalig / monatlich), Zahlungsstaffelung als
   reine ANZEIGE und einer UNVERBINDLICHEN Angebotsanfrage am Ende.

   • Live-Berechnung rein im Frontend (pricing.js + pricing-calc.js).
   • KEINE Bezahlung. Abschluss = Angebotsanfrage, kein Vertrag.
   • Optionaler LLM-Call nur in Pfad B (Briefing-Zusammenfassung).
   • Stufe 2 (Detail-Onboarding nach Buchung) bleibt getrennt → onboarding-stage2.js
   ============================================================ */
(function () {
  'use strict';

  var SCHEMA = window.SARTU_BRIEFING_SCHEMA;
  var PRICING = window.SARTU_PRICING;
  var PAY = window.SARTU_PAYMENT_TERMS;
  var CALC = window.SARTU_PRICING_CALC;
  var stage = document.getElementById('lumiStage');
  if (!SCHEMA || !PRICING || !PAY || !CALC || !stage) return;

  var OPT = SCHEMA.options;
  var REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ============================================================
     KONFIGURATION — Platzhalter in [KLAMMERN] später füllen
     ============================================================ */
  var CONFIG = {
    useLLM: false,                                   // EINEN LLM-Call (nur Pfad B) aktivieren
    llmEndpoint: '[LLM_BRIEFING_ENDPOINT]',
    formEndpoint: '[FORMSPREE_ODER_RESEND_ENDPOINT]',
    supabaseUrl: '[SUPABASE_URL]',
    supabaseKey: '[SUPABASE_ANON_KEY]',
    notifyEmail: '[SARTU-EMAIL]',
    datenschutzUrl: 'datenschutz.html',
  };
  var isPlaceholder = function (v) { return !v || /^\[.*\]$/.test(v); };

  /* ============================================================
     ZUSTAND — eine Quelle, bleibt über beide Pfade & Zurück erhalten
     ============================================================ */
  var A = {
    pfad: null,                       // 'A' | 'B'
    // Lumi-Flow (Pfad B)
    branche: null, branche_sonstiges: '',
    ziele: [], umfang: null, seiten: [],
    features: [], stil: [], hauptfarbe: null, nebenfarbe: null, markenfarben_hex: '',
    material: [], uploads: { logo: [], fotos: [], texte: [], texte_notiz: '', website_link: '' },
    zeitrahmen: null,
    // Konfigurator
    paket_gewaehlt: null,
    paket_empfohlen: null,
    wartung: null,
    extraPages: 0,                    // Seiten über dem Inklusiv-Kontingent (Variante A)
    addons: {},                       // { addonId: {selected:bool, qty:int} }
    _prefilled: false,                // Pfad-B-Vorbefüllung nur einmal anwenden
    // Enterprise-Abzweig (strukturierte Anfrage statt Fixpreis)
    enterprise: { sonderfunktionen: [], seitenzahl: null, shopGroesse: null, sprachen: '', schnittstellen: '', zeithorizont: null, notiz: '' },
    // Abschluss
    kontakt: { name: '', email: '', telefon: '', dsgvo: false },
  };
  var ui = { askedClarification: false };

  /* ============================================================
     DOM-HELFER
     ============================================================ */
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function clearStage() { stage.textContent = ''; }
  function fmtEUR(n) { return (Math.round(n) || 0).toLocaleString('de-DE') + ' €'; }

  function lumiSays(question, hint) {
    var row = el('div', 'lb-say');
    row.appendChild(el('span', 'lb-avatar', 'L'));
    var bubble = el('div', 'lb-bubble');
    var h = el('h2', 'lb-q');
    h.setAttribute('tabindex', '-1');
    h.textContent = question;
    bubble.appendChild(h);
    if (hint) bubble.appendChild(el('p', 'lb-hint', hint));
    row.appendChild(bubble);
    stage.appendChild(row);
    return h;
  }
  function subQuestion(text) { var p = el('p', 'lb-subq', text); stage.appendChild(p); return p; }

  function actions(opts) {
    opts = opts || {};
    var row = el('div', 'lb-actions');
    if (opts.onBack) {
      var b = el('button', 'lb-back', '‹ Zurück'); b.type = 'button';
      b.addEventListener('click', opts.onBack); row.appendChild(b);
    }
    var right = el('div', 'lb-actions-right');
    if (opts.skip) {
      var s = el('button', 'lb-skip', opts.skipLabel || 'Überspringen'); s.type = 'button';
      s.addEventListener('click', opts.skip); right.appendChild(s);
    }
    if (opts.onNext) {
      var n = el('button', 'btn btn-primary lb-next'); n.type = 'button';
      n.textContent = opts.nextLabel || 'Weiter';
      n.addEventListener('click', opts.onNext); right.appendChild(n);
    }
    row.appendChild(right);
    stage.appendChild(row);
    return row;
  }

  /* ---- Multi-Select Chips (mit Exklusiv-Logik) ---- */
  function buildChips(slot, options, conf) {
    conf = conf || {};
    var exclusive = conf.exclusive || [];
    if (!Array.isArray(A[slot])) A[slot] = [];
    var wrap = el('div', 'lb-chips');
    var btns = {};
    options.forEach(function (opt) {
      var b = el('button', 'lb-chip'); b.type = 'button'; b.textContent = opt.label;
      var on = A[slot].indexOf(opt.value) > -1;
      if (on) b.classList.add('is-on');
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.addEventListener('click', function () {
        var arr = A[slot].slice();
        if (arr.indexOf(opt.value) > -1) {
          arr = arr.filter(function (v) { return v !== opt.value; });
        } else if (exclusive.indexOf(opt.value) > -1) {
          arr = [opt.value];
        } else {
          arr = arr.filter(function (v) { return exclusive.indexOf(v) === -1; });
          arr.push(opt.value);
        }
        A[slot] = arr;
        options.forEach(function (o) {
          var bb = btns[o.value], sel = arr.indexOf(o.value) > -1;
          bb.classList.toggle('is-on', sel);
          bb.setAttribute('aria-pressed', sel ? 'true' : 'false');
        });
        if (conf.onChange) conf.onChange(arr);
      });
      btns[opt.value] = b; wrap.appendChild(b);
    });
    stage.appendChild(wrap);
    return wrap;
  }
  function buildChipsInto(container, slot, options, conf) {
    var wrap = buildChips(slot, options, conf);
    stage.removeChild(wrap); container.appendChild(wrap);
    return wrap;
  }

  /* ---- Single-Choice Karten (Lumi-Flow) ---- */
  function buildCards(slot, options, conf) {
    conf = conf || {};
    var wrap = el('div', conf.cls || 'lb-cards');
    var btns = {};
    options.forEach(function (opt) {
      var b = el('button', 'lb-card'); b.type = 'button';
      var inner = '';
      if (opt.icon) inner += '<span class="lb-card-icon" aria-hidden="true">' + opt.icon + '</span>';
      inner += '<span class="lb-card-label">' + opt.label + '</span>';
      if (opt.sub) inner += '<span class="lb-card-sub">' + opt.sub + '</span>';
      b.innerHTML = inner;
      if (A[slot] === opt.value) b.classList.add('is-on');
      b.addEventListener('click', function () {
        A[slot] = opt.value;
        Object.keys(btns).forEach(function (k) { btns[k].classList.toggle('is-on', k === opt.value); });
        if (conf.onPick) conf.onPick(opt.value);
      });
      btns[opt.value] = b; wrap.appendChild(b);
    });
    stage.appendChild(wrap);
    return wrap;
  }

  function fileField(labelText, key, conf) {
    conf = conf || {};
    var lbl = el('label', 'lb-field lb-upload');
    var head = '<span class="lb-field-label">' + labelText + ' <em>(optional)</em></span>';
    if (conf.hint) head += '<span class="lb-upload-hint">' + conf.hint + '</span>';
    lbl.innerHTML = head;
    var inp = el('input'); inp.type = 'file'; if (conf.multiple) inp.multiple = true;
    var chosen = el('span', 'lb-upload-files');
    var existing = A.uploads[key] || [];
    if (existing.length) chosen.textContent = existing.map(function (f) { return f.name; }).join(', ');
    inp.addEventListener('change', function (e) {
      A.uploads[key] = Array.prototype.map.call(e.target.files, function (f) { return { name: f.name, size: f.size, type: f.type }; });
      chosen.textContent = A.uploads[key].map(function (f) { return f.name; }).join(', ');
    });
    lbl.appendChild(inp); lbl.appendChild(chosen);
    return lbl;
  }

  /* ============================================================
     NAVIGATION (namensbasiert + History-Stack für Verzweigung)
     ============================================================ */
  var progressWrap = document.getElementById('lumiProgress');
  var progressLabel = document.getElementById('lumiProgressLabel');
  var progressFill = document.getElementById('lumiProgressFill');

  function updateProgress(step) {
    // Fortschritt nur im Lumi-Flow (Pfad B) und ab Schritt 2
    if (A.pfad === 'B' && step && step >= 2) {
      progressWrap.hidden = false;
      progressLabel.textContent = 'Schritt ' + step + ' von ' + SCHEMA.totalSteps;
      progressFill.style.width = Math.round((step / SCHEMA.totalSteps) * 100) + '%';
    } else {
      progressWrap.hidden = true;
    }
  }

  // Reihenfolge des Lumi-Flows (Pfad B) → endet im Konfigurator
  var FLOW_B = ['branche', 'ziele', 'umfang', 'features', 'design', 'material', 'zeitrahmen', 'configurator'];
  function flowNext(name) { var i = FLOW_B.indexOf(name); return i > -1 ? FLOW_B[i + 1] : null; }

  var current = null;
  var history = [];

  function renderScreen(name) {
    var sc = screens[name];
    if (!sc) return;
    current = name;
    updateProgress(sc.step);
    showPriceBar(false);          // Standard aus; Konfigurator schaltet selbst ein
    clearStage();
    var focusTarget = sc.render();
    if (name !== 'welcome') {
      var card = document.querySelector('.lumi-card');
      if (card) card.scrollIntoView({ block: 'start', behavior: REDUCE ? 'auto' : 'smooth' });
    }
    if (focusTarget && focusTarget.focus) {
      try { focusTarget.focus({ preventScroll: true }); } catch (e) { focusTarget.focus(); }
    }
  }
  function goTo(name, opts) {
    opts = opts || {};
    if (!opts.replace && current) history.push(current);
    renderScreen(name);
  }
  function back() { if (history.length) renderScreen(history.pop()); }
  function advance() { var nx = flowNext(current); if (nx) goTo(nx); }

  /* ============================================================
     LIVE-PREISLEISTE (fix unten, immer sichtbar im Konfigurator)
     ============================================================ */
  var priceBar = null, priceDetailOpen = false;
  function ensurePriceBar() {
    if (priceBar) return priceBar;
    priceBar = el('div', 'lb-pricebar');
    priceBar.id = 'lumiPriceBar';
    priceBar.hidden = true;
    priceBar.setAttribute('role', 'region');
    priceBar.setAttribute('aria-label', 'Live-Preisübersicht');
    priceBar.innerHTML =
      '<div class="lb-pricebar-detail" id="lbPriceDetail" hidden></div>' +
      '<div class="lb-pricebar-inner">' +
        '<button type="button" class="lb-pricebar-toggle" aria-expanded="false">Details</button>' +
        '<div class="lb-pricebar-sums">' +
          '<div class="lb-sum"><span>Einmalig</span><strong id="lbSumOnce">0 €</strong></div>' +
          '<div class="lb-sum lb-sum-mo"><span>Monatlich</span><strong id="lbSumMonthly">0 €</strong></div>' +
        '</div>' +
        '<button type="button" class="btn btn-primary lb-pricebar-cta">Weiter</button>' +
      '</div>' +
      '<p class="lb-pricebar-note">Alle Preise netto zzgl. MwSt. · Festpreis – unverbindliche Übersicht</p>';
    document.body.appendChild(priceBar);

    var detail = priceBar.querySelector('#lbPriceDetail');
    var toggle = priceBar.querySelector('.lb-pricebar-toggle');
    toggle.addEventListener('click', function () {
      priceDetailOpen = !priceDetailOpen;
      toggle.setAttribute('aria-expanded', priceDetailOpen ? 'true' : 'false');
      detail.hidden = !priceDetailOpen;
      if (priceDetailOpen) renderPriceDetail();
    });
    priceBar.querySelector('.lb-pricebar-cta').addEventListener('click', function () { goTo('contact'); });
    return priceBar;
  }
  function showPriceBar(on) {
    ensurePriceBar();
    priceBar.hidden = !on;
    document.body.classList.toggle('lb-has-pricebar', on);
    if (!on) {
      priceDetailOpen = false;
      var d = priceBar.querySelector('#lbPriceDetail'); if (d) d.hidden = true;
      var t = priceBar.querySelector('.lb-pricebar-toggle'); if (t) t.setAttribute('aria-expanded', 'false');
    }
  }
  function totals() {
    return CALC.computeTotals({ paket: A.paket_gewaehlt, wartung: A.wartung, addons: A.addons, extraPages: A.extraPages }, PRICING);
  }
  function renderPriceBar() {
    ensurePriceBar();
    var sums = priceBar.querySelector('.lb-pricebar-sums');
    var toggle = priceBar.querySelector('.lb-pricebar-toggle');
    // Enterprise-Abzweig: KEIN Fixpreis, sondern Hinweis auf individuelles Angebot
    if (isEnterprise()) {
      priceBar.classList.add('is-enterprise');
      sums.innerHTML = '<div class="lb-sum-individual">Individuelles Festpreis-Angebot</div>';
      if (toggle) toggle.style.visibility = 'hidden';
      return;
    }
    priceBar.classList.remove('is-enterprise');
    if (toggle) toggle.style.visibility = '';
    var t = totals();
    sums.innerHTML =
      '<div class="lb-sum"><span>Einmalig</span><strong></strong></div>' +
      '<div class="lb-sum lb-sum-mo"><span>Monatlich · Pflicht</span><strong></strong></div>';
    sums.children[0].querySelector('strong').textContent = fmtEUR(t.once);
    sums.children[1].querySelector('strong').textContent = fmtEUR(t.monthly) + '/Mon.';
    if (priceDetailOpen) renderPriceDetail();
  }
  function renderPriceDetail() {
    var detail = priceBar.querySelector('#lbPriceDetail');
    var t = totals();
    var onceLines = t.lines.filter(function (l) { return l.group === 'once'; });
    var moLines = t.lines.filter(function (l) { return l.group === 'monthly'; });
    var html = '';
    html += '<div class="lb-detail-col"><h5>Einmalig</h5>';
    html += onceLines.length ? onceLines.map(detailRow).join('') : '<p class="lb-detail-empty">—</p>';
    html += '<div class="lb-detail-sum"><span>Summe einmalig</span><strong>' + fmtEUR(t.once) + '</strong></div></div>';
    html += '<div class="lb-detail-col"><h5>Monatlich</h5>';
    html += moLines.length ? moLines.map(detailRow).join('') : '<p class="lb-detail-empty">—</p>';
    html += '<div class="lb-detail-sum"><span>Summe monatlich</span><strong>' + fmtEUR(t.monthly) + '</strong></div></div>';
    detail.innerHTML = html;
  }
  function detailRow(l) {
    return '<div class="lb-detail-row"><span>' + l.label + '</span><span>' + fmtEUR(l.amount) + '</span></div>';
  }

  /* ============================================================
     KONFIGURATOR-HELFER
     ============================================================ */
  function pkgById(id) { return PRICING.packages.filter(function (p) { return p.id === id; })[0]; }
  function wartById(id) { return PRICING.maintenance.filter(function (m) { return m.id === id; })[0]; }
  function priceLabel(value, opts) {
    opts = opts || {};
    if (value == null) return 'auf Anfrage';
    return (opts.from ? 'ab ' : '') + value.toLocaleString('de-DE') + ' €' + (opts.period ? '/Monat' : '');
  }
  function pkgFloor(id) { var p = pkgById(id); return (p && p.maintenanceFloor) || PRICING.maintenanceOrder[0]; }
  function maintIndex(id) { return PRICING.maintenanceOrder.indexOf(id); }
  function isEnterprise() {
    var p = pkgById(A.paket_gewaehlt);
    return !!(p && p.configurable === false); // Enterprise = nicht konfigurierbar → Abzweig
  }
  // Hosting/Wartung ist PFLICHT: immer mind. der Paket-Floor, nur Upgrade nach oben.
  function ensureWartungDefault() {
    var floor = pkgFloor(A.paket_gewaehlt);
    if (A.wartung == null || maintIndex(A.wartung) < maintIndex(floor)) A.wartung = floor;
  }
  function ensureAddonState() {
    PRICING.addons.forEach(function (a) {
      if (!A.addons[a.id]) A.addons[a.id] = { selected: false, qty: a.qty ? a.qty.default : 1 };
    });
  }
  // Betrag eines Add-ons (berücksichtigt Menge + Prozent-Typ wie Express)
  function addonAmount(a, st) {
    if (a.type === 'percent') {
      var p = pkgById(A.paket_gewaehlt);
      return Math.round((p && p.price ? p.price : 0) * (a.pct || 0) / 100);
    }
    if (typeof a.price !== 'number') return null;
    return a.price * (a.qty ? st.qty : 1);
  }
  // Pfad B: Konfigurator aus den Lumi-Antworten VORBEFÜLLEN (nur einmal)
  function prefillFromBriefing() {
    if (A._prefilled || A.pfad !== 'B') return;
    A._prefilled = true;
    var f = A.features || [], m = A.material || [], z = A.ziele || [];
    var hasF = function (v) { return f.indexOf(v) > -1; };
    var hasM = function (v) { return m.indexOf(v) > -1; };
    var on = function (id, qty) {
      if (A.addons[id]) { A.addons[id].selected = true; if (qty) A.addons[id].qty = qty; }
    };
    // Funktionen → passende Add-ons
    if (hasF('terminbuchung') || z.indexOf('termine') > -1) on('terminbuchung');
    if (hasF('blog')) on('blog');
    if (hasF('newsletter')) on('newsletter');
    if (hasF('mehrsprachig')) on('sprache', 1);
    // Kein Logo vorhanden → Logo-Add-on vorschlagen
    if (!hasM('logo')) on('logo-wort');
    // Keine Texte vorhanden → Texte vorschlagen (Onepager: 1 Seite, sonst Komplettpaket)
    if (!hasM('texte')) { if (A.umfang === 'onepager') on('texte', 1); else on('texte-paket'); }
    // Bestehende Website → Migration
    if (hasM('website')) on('migration');
    // Sehr eilig → Express
    if (A.zeitrahmen === 'asap') on('express');

    // Enterprise-Abzweig vorbefüllen (falls Empfehlung/Funktionen darauf hindeuten)
    var E = A.enterprise;
    ['shop', 'login', 'mehrsprachig'].forEach(function (v) {
      if (hasF(v) && E.sonderfunktionen.indexOf(v) < 0) E.sonderfunktionen.push(v);
    });
    if (!E.seitenzahl) E.seitenzahl = A.umfang === 'gross' ? '20-50' : (A.umfang === 'umfangreich' ? 'bis20' : null);
    if (!E.zeithorizont && A.zeitrahmen) {
      var zmap = { asap: 'asap', '4-6w': '1-3m', '2-3m': '3-6m', offen: 'flex' };
      E.zeithorizont = zmap[A.zeitrahmen] || null;
    }
  }

  /* ============================================================
     SCREENS
     ============================================================ */
  var screens = {

    /* ---------- Willkommen ---------- */
    welcome: { step: null, render: function () {
      var h = lumiSays('Hi, ich bin Lumi 👋',
        'In ~2 Minuten stellst du dir – fast nur mit Klicken – dein Website-Paket zusammen. Der Preis rechnet live mit.');
      var wrap = el('div', 'lb-welcome');
      var btn = el('button', 'btn btn-primary btn-lg lb-start');
      btn.type = 'button';
      btn.innerHTML = 'Los geht’s <span class="arrow" aria-hidden="true">→</span>';
      btn.addEventListener('click', function () { goTo('path'); });
      wrap.appendChild(btn);
      stage.appendChild(wrap);
      return h;
    }},

    /* ---------- Einstiegsfrage: zwei Pfade ---------- */
    path: { step: null, render: function () {
      var h = lumiSays('Weißt du schon, welches Paket du möchtest?',
        'Beide Wege führen zur selben Live-Preisübersicht — du kannst alles jederzeit ändern.');
      var wrap = el('div', 'lb-paths');

      var a = el('button', 'lb-path-card');
      a.type = 'button';
      a.innerHTML = '<span class="lb-path-icon" aria-hidden="true">⚙️</span>' +
        '<span class="lb-path-title">Ja, ich konfiguriere direkt</span>' +
        '<span class="lb-path-sub">Paket wählen, Add-ons dazu, Preis sofort sehen.</span>';
      a.addEventListener('click', function () { A.pfad = 'A'; goTo('configurator'); });

      var b = el('button', 'lb-path-card');
      b.type = 'button';
      b.innerHTML = '<span class="lb-path-icon" aria-hidden="true">💬</span>' +
        '<span class="lb-path-title">Nein, hilf mir wählen</span>' +
        '<span class="lb-path-sub">8 kurze Fragen — Lumi empfiehlt dir das passende Paket.</span>';
      b.addEventListener('click', function () { A.pfad = 'B'; goTo('branche'); });

      wrap.appendChild(a); wrap.appendChild(b);
      stage.appendChild(wrap);
      actions({ onBack: back });
      return h;
    }},

    /* ---------- Pfad B · 1 · Branche ---------- */
    branche: { step: 1, render: function () {
      var h = lumiSays('In welcher Branche bist du tätig?');
      var sonst = el('div', 'lb-inline');
      function renderSonst() {
        sonst.textContent = '';
        if (A.branche === 'sonstiges') {
          var lbl = el('label', 'lb-field');
          lbl.innerHTML = '<span class="lb-field-label">Was bietest du an? <em>(optional)</em></span>';
          var inp = el('input'); inp.type = 'text';
          inp.placeholder = 'z. B. „mobiler Friseur für Senioren“';
          inp.value = A.branche_sonstiges || '';
          inp.addEventListener('input', function (e) { A.branche_sonstiges = e.target.value; });
          lbl.appendChild(inp); sonst.appendChild(lbl);
        }
      }
      buildCards('branche', OPT.branche, { cls: 'lb-tiles', onPick: function (v) {
        renderSonst(); if (v !== 'sonstiges') leaveBranche();
      }});
      stage.appendChild(sonst); renderSonst();
      actions({ onBack: back, onNext: leaveBranche, skip: advance });
      return h;
    }},

    /* ---------- Pfad B · 2 · Ziele ---------- */
    ziele: { step: 2, render: function () {
      var h = lumiSays('Was soll deine Website vor allem erreichen?', 'Mehrfachauswahl möglich.');
      buildChips('ziele', OPT.ziele);
      actions({ onBack: back, onNext: advance, skip: advance });
      return h;
    }},

    /* ---------- Pfad B · 3 · Umfang (+ bedingte Seiten) ---------- */
    umfang: { step: 3, render: function () {
      var h = lumiSays('Wie groß soll deine Website werden?');
      var sub = el('div', 'lb-inline');
      function renderSub() {
        sub.textContent = '';
        if (A.umfang && A.umfang !== 'onepager') {
          sub.appendChild(el('p', 'lb-subq', 'Welche Seiten brauchst du? <span class="lb-opt">(optional)</span>'));
          buildChipsInto(sub, 'seiten', OPT.seiten, { exclusive: ['unsure'] });
        }
      }
      buildCards('umfang', OPT.umfang, { onPick: renderSub });
      stage.appendChild(sub); renderSub();
      actions({ onBack: back, onNext: advance, skip: advance });
      return h;
    }},

    /* ---------- Pfad B · 4 · Features ---------- */
    features: { step: 4, render: function () {
      var h = lumiSays('Welche Funktionen brauchst du?', 'Mehrfachauswahl möglich.');
      buildChips('features', OPT.features, { exclusive: ['beraten'] });
      actions({ onBack: back, onNext: advance, skip: advance });
      return h;
    }},

    /* ---------- Pfad B · 5 · Design (Stil + Farbe + HEX) ---------- */
    design: { step: 5, render: function () {
      var h = lumiSays('Welcher Look gefällt dir?', 'Mehrfachauswahl möglich — Lumi nutzt das als Richtung.');
      var moods = el('div', 'lb-moods');
      OPT.stil.forEach(function (opt) {
        var b = el('button', 'lb-mood'); b.type = 'button';
        b.innerHTML = '<span class="lb-mood-art ' + opt.flavor + '" aria-hidden="true">' +
          '<span class="m1"></span><span class="m2"></span><span class="m3"></span></span>' +
          '<span class="lb-mood-label">' + opt.label + '</span>';
        var on = A.stil.indexOf(opt.value) > -1;
        if (on) b.classList.add('is-on');
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        b.addEventListener('click', function () {
          var i = A.stil.indexOf(opt.value);
          if (i > -1) A.stil.splice(i, 1); else A.stil.push(opt.value);
          var sel = A.stil.indexOf(opt.value) > -1;
          b.classList.toggle('is-on', sel); b.setAttribute('aria-pressed', sel ? 'true' : 'false');
        });
        moods.appendChild(b);
      });
      stage.appendChild(moods);

      // Farbe: NUR zwei Farben — Hauptfarbe + Nebenfarbe (laienverständlich, kein Regler)
      function colorRow(label, slot) {
        var wrap = el('div', 'lb-colorrow');
        wrap.appendChild(el('span', 'lb-colorrow-label', label));
        var tiles = el('div', 'lb-colortiles');
        OPT.farben.forEach(function (opt) {
          var b = el('button', 'lb-colortile'); b.type = 'button';
          b.setAttribute('aria-label', label + ': ' + opt.label);
          b.setAttribute('aria-pressed', A[slot] === opt.value ? 'true' : 'false');
          b.innerHTML = '<span class="lb-colordot" style="background:' + opt.hex + '"></span><small>' + opt.label + '</small>';
          if (A[slot] === opt.value) b.classList.add('is-on');
          b.addEventListener('click', function () {
            A[slot] = (A[slot] === opt.value) ? null : opt.value; // erneut klicken = abwählen
            Array.prototype.forEach.call(tiles.querySelectorAll('.lb-colortile'), function (x) {
              x.classList.remove('is-on'); x.setAttribute('aria-pressed', 'false');
            });
            if (A[slot] === opt.value) { b.classList.add('is-on'); b.setAttribute('aria-pressed', 'true'); }
          });
          tiles.appendChild(b);
        });
        wrap.appendChild(tiles);
        return wrap;
      }
      subQuestion('Und deine Farben? Wähle eine <strong>Hauptfarbe</strong> und eine <strong>Nebenfarbe</strong>.');
      stage.appendChild(colorRow('Hauptfarbe', 'hauptfarbe'));
      stage.appendChild(colorRow('Nebenfarbe', 'nebenfarbe'));

      // optionales Markenfarben-Feld (kein Pflichtfeld, kein HEX-Zwang)
      var lbl = el('label', 'lb-field lb-field-optional');
      lbl.innerHTML = '<span class="lb-field-label">Feste Markenfarbe vorhanden? <em>(HEX-Code, falls bekannt — sonst überspringen)</em></span>';
      var inp = el('input'); inp.type = 'text'; inp.placeholder = 'z. B. #B6FF3B';
      inp.value = A.markenfarben_hex || '';
      inp.addEventListener('input', function (e) { A.markenfarben_hex = e.target.value; });
      lbl.appendChild(inp); stage.appendChild(lbl);

      // dezenter Realitäts-Hinweis (kein Baukasten)
      stage.appendChild(el('p', 'lb-design-note',
        'Das ist nur eine grobe Richtung zur Veranschaulichung — den Feinschliff und die genauen Farbtöne machen wir gemeinsam nach dem Start. Alles wird handgemacht, kein Baukasten.'));

      actions({ onBack: back, onNext: advance, skip: advance });
      return h;
    }},

    /* ---------- Pfad B · 6 · Material (+ Uploads) ---------- */
    material: { step: 6, render: function () {
      var h = lumiSays('Was hast du schon?', 'Uploads sind optional — du kannst alles auch später nachreichen.');
      var uploads = el('div', 'lb-inline');
      function renderUploads() {
        uploads.textContent = '';
        var m = A.material;
        if (m.indexOf('logo') > -1) uploads.appendChild(fileField('Logo hochladen', 'logo', { hint: 'Kann ich auch später nachreichen.' }));
        if (m.indexOf('fotos') > -1) uploads.appendChild(fileField('Bilder hochladen', 'fotos', { multiple: true }));
        if (m.indexOf('texte') > -1) {
          uploads.appendChild(fileField('Texte hochladen', 'texte', {}));
          var note = el('label', 'lb-field');
          note.innerHTML = '<span class="lb-field-label">Notizen zu den Texten <em>(optional)</em></span>';
          var ta = el('textarea'); ta.rows = 2; ta.placeholder = 'z. B. „Texte sind grob, bitte überarbeiten“';
          ta.value = A.uploads.texte_notiz || '';
          ta.addEventListener('input', function (e) { A.uploads.texte_notiz = e.target.value; });
          note.appendChild(ta); uploads.appendChild(note);
        }
        if (m.indexOf('website') > -1) {
          var wl = el('label', 'lb-field');
          wl.innerHTML = '<span class="lb-field-label">Link zur aktuellen Website</span>';
          var inp = el('input'); inp.type = 'url'; inp.placeholder = 'https://…';
          inp.value = A.uploads.website_link || '';
          inp.addEventListener('input', function (e) { A.uploads.website_link = e.target.value; });
          wl.appendChild(inp); uploads.appendChild(wl);
        }
      }
      buildChips('material', OPT.material, { exclusive: ['nichts'], onChange: renderUploads });
      stage.appendChild(uploads); renderUploads();
      actions({ onBack: back, onNext: advance, skip: advance });
      return h;
    }},

    /* ---------- Pfad B · 7 · Zeitrahmen ---------- */
    zeitrahmen: { step: 7, render: function () {
      var h = lumiSays('Bis wann brauchst du die Website?');
      buildCards('zeitrahmen', OPT.zeitrahmen, { cls: 'lb-cards lb-cards-wide', onPick: function () { advance(); } });
      actions({ onBack: back, skip: advance });
      return h;
    }},

    /* ---------- GEMEINSAMER KONFIGURATOR (Pfad A direkt, Pfad B als Ergebnis) ---------- */
    configurator: { step: 8, render: function () {
      // Vorauswahl
      if (!A.paket_gewaehlt) {
        A.paket_empfohlen = A.pfad === 'B' ? recommend() : 'pro';
        A.paket_gewaehlt = A.paket_empfohlen;
      } else if (A.pfad === 'B' && !A.paket_empfohlen) {
        A.paket_empfohlen = recommend();
      }
      ensureWartungDefault();
      ensureAddonState();
      prefillFromBriefing();
      var addonsExpanded = false;

      var intro = isEnterprise()
        ? { q: 'Enterprise – wir erstellen dir ein individuelles Festpreis-Angebot.',
            hint: 'Für Shop, Portal, Mehrsprachigkeit oder Sonderfunktionen sammle ich kurz deine Anforderungen — ohne Fixpreis. Du kannst jederzeit zu einem kleineren Paket wechseln.' }
        : (A.pfad === 'B'
          ? { q: 'Auf Basis deiner Angaben empfehle ich „' + pkgById(A.paket_empfohlen).name + '“.',
              hint: 'Paket, Pflicht-Wartung und passende Add-ons sind vorausgewählt. Ändere alles frei — der Preis rechnet live mit.' }
          : { q: 'Stell dir dein Paket zusammen.',
              hint: 'Wähle Paket und Add-ons — Hosting & Wartung ist Pflicht und schon gesetzt. Der Preis unten rechnet live mit.' });
      var h = lumiSays(intro.q, intro.hint);

      // Zurück-Link oben
      var top = el('div', 'lb-cfg-top');
      var backLink = el('button', 'lb-back', '‹ Zurück'); backLink.type = 'button';
      backLink.addEventListener('click', back); top.appendChild(backLink);
      stage.appendChild(top);

      // Paket immer sichtbar (keine Sackgasse); restliche Sektionen je nach Modus
      var pkgSec = el('div', 'lb-cfg-section');
      var dynSec = el('div');
      var paySec = el('div', 'lb-cfg-section lb-cfg-pay');
      var wartSec, pageSec, addSec; // in renderDynamic() befüllt
      stage.appendChild(pkgSec); stage.appendChild(dynSec); stage.appendChild(paySec);

      renderPkg(); renderDynamic(); renderPayTerms();

      // CTA unter den Sektionen (zusätzlich zur Preisleiste)
      var cta = el('div', 'lb-cfg-cta');
      var go = el('button', 'btn btn-primary btn-lg'); go.type = 'button';
      go.innerHTML = 'Weiter zur Angebotsanfrage <span class="arrow" aria-hidden="true">→</span>';
      go.addEventListener('click', function () { goTo('contact'); });
      cta.appendChild(go);
      stage.appendChild(cta);

      showPriceBar(true);
      renderPriceBar();

      function rerenderAll() { renderPkg(); renderDynamic(); renderPayTerms(); renderPriceBar(); }
      function renderDynamic() {
        dynSec.innerHTML = '';
        if (isEnterprise()) { renderEnterprise(dynSec); return; }
        wartSec = el('div', 'lb-cfg-section'); dynSec.appendChild(wartSec);
        pageSec = el('div', 'lb-cfg-section'); dynSec.appendChild(pageSec);
        addSec = el('div', 'lb-cfg-section'); dynSec.appendChild(addSec);
        renderWartung(); renderPages(); renderAddons();
      }

      /* -- Paketauswahl -- */
      function renderPkg() {
        pkgSec.innerHTML = '<h3 class="lb-cfg-h">1 · Paket</h3>';
        var grid = el('div', 'lb-pkgs');
        PRICING.packages.forEach(function (p) {
          var c = el('button', 'lb-pkg'); c.type = 'button';
          var priceTxt = p.configurable === false ? 'Individuelles Angebot' : priceLabel(p.price, { from: p.from });
          var pagesLine = p.includedPages
            ? '<span class="lb-pkg-pages">' + p.includedPages + ' Seite' + (p.includedPages > 1 ? 'n' : '') + ' inkl. · jede weitere ab ' + PRICING.extraPage.price + ' €</span>'
            : '';
          c.innerHTML =
            (p.popular ? '<span class="lb-pkg-badge">Beliebt</span>' : '') +
            (p.id === A.paket_empfohlen && A.pfad === 'B' ? '<span class="lb-pkg-badge lb-pkg-badge-rec">Empfohlen</span>' : '') +
            '<span class="lb-pkg-name">' + p.name + '</span>' +
            '<span class="lb-pkg-price">' + priceTxt + '</span>' +
            '<span class="lb-pkg-scope">' + p.scope + '</span>' + pagesLine +
            (p.perks && p.perks.length ? '<ul class="lb-perks">' + p.perks.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>' : '');
          if (A.paket_gewaehlt === p.id) c.classList.add('is-on');
          c.addEventListener('click', function () {
            A.paket_gewaehlt = p.id;
            ensureWartungDefault();                 // Pflicht-Wartung auf Paket-Floor heben
            if (p.includedPages == null) A.extraPages = 0; // Enterprise: keine Extraseiten-Logik
            rerenderAll();
          });
          grid.appendChild(c);
        });
        pkgSec.appendChild(grid);
      }

      /* -- Hosting & Wartung (PFLICHT, nur Upgrade über den Paket-Floor) -- */
      function renderWartung() {
        wartSec.innerHTML = '<h3 class="lb-cfg-h">2 · Hosting &amp; Wartung <span class="lb-cfg-opt">(Pflicht – im Paket enthalten)</span></h3>';
        var floor = pkgFloor(A.paket_gewaehlt);
        var floorIdx = maintIndex(floor);
        var grid = el('div', 'lb-warts');
        PRICING.maintenance.forEach(function (m) {
          var locked = maintIndex(m.id) < floorIdx; // unter dem Paket-Floor → nicht wählbar
          var c = el('button', 'lb-wart'); c.type = 'button';
          if (locked) { c.disabled = true; c.classList.add('is-locked'); }
          c.innerHTML =
            (m.id === floor ? '<span class="lb-wart-rec">Im Paket</span>' : (m.recommended ? '<span class="lb-wart-rec">Empfohlen</span>' : '')) +
            '<span class="lb-wart-name">' + m.name + '</span>' +
            '<span class="lb-wart-price">' + priceLabel(m.price, { from: m.from, period: true }) + '</span>' +
            (m.perks && m.perks.length ? '<ul class="lb-perks">' + m.perks.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>' : '');
          if (A.wartung === m.id) c.classList.add('is-on');
          if (!locked) c.addEventListener('click', function () { A.wartung = m.id; renderWartung(); renderPriceBar(); });
          grid.appendChild(c);
        });
        wartSec.appendChild(grid);
        wartSec.appendChild(el('p', 'lb-cfg-foot', PRICING.mandatoryNote + ' Standardpreis monatlich – günstiger bei Jahreszahlung.'));
      }

      /* -- Seiten: Inklusiv-Kontingent + Extraseiten (Variante A) -- */
      function renderPages() {
        var p = pkgById(A.paket_gewaehlt);
        var inc = p.includedPages || 0;
        var total = inc + (A.extraPages || 0);
        pageSec.innerHTML = '<h3 class="lb-cfg-h">3 · Seiten <span class="lb-cfg-opt">(' + inc + ' inklusive)</span></h3>';
        var box = el('div', 'lb-pages');
        box.innerHTML =
          '<div class="lb-pages-info"><strong>' + total + ' Seiten</strong> gesamt · ' + inc + ' inklusive' +
          ((A.extraPages || 0) > 0 ? ' + ' + A.extraPages + ' extra' : '') + '</div>' +
          '<div class="lb-pages-extra"><span>Zusätzliche Seiten (je ' + (PRICING.extraPage.from ? 'ab ' : '') + PRICING.extraPage.price + ' €)</span></div>';
        var stepper = el('div', 'lb-qty');
        var minus = el('button', 'lb-qty-btn', '−'); minus.type = 'button'; minus.setAttribute('aria-label', 'weniger Seiten');
        var num = el('span', 'lb-qty-num', String(A.extraPages || 0));
        var plus = el('button', 'lb-qty-btn', '+'); plus.type = 'button'; plus.setAttribute('aria-label', 'mehr Seiten');
        var lineTotal = el('span', 'lb-qty-total', '= ' + fmtEUR(PRICING.extraPage.price * (A.extraPages || 0)));
        var sync = function () { renderPages(); renderPriceBar(); };
        minus.addEventListener('click', function () { A.extraPages = Math.max(0, (A.extraPages || 0) - 1); sync(); });
        plus.addEventListener('click', function () { A.extraPages = Math.min(50, (A.extraPages || 0) + 1); sync(); });
        stepper.appendChild(minus); stepper.appendChild(num); stepper.appendChild(plus); stepper.appendChild(lineTotal);
        box.querySelector('.lb-pages-extra').appendChild(stepper);
        pageSec.appendChild(box);
      }

      /* -- Enterprise-Abzweig: strukturierte Anforderungen statt Fixpreis -- */
      function renderEnterprise(container) {
        var E = A.enterprise;
        var EOPT = PRICING.enterpriseOptions;
        var sec = el('div', 'lb-cfg-section lb-ent');

        function entSingle(opts, key) {
          var grid = el('div', 'lb-cards');
          opts.forEach(function (o) {
            var b = el('button', 'lb-card'); b.type = 'button';
            b.innerHTML = '<span class="lb-card-label">' + o.label + '</span>';
            if (E[key] === o.value) b.classList.add('is-on');
            b.addEventListener('click', function () {
              E[key] = o.value;
              Array.prototype.forEach.call(grid.children, function (x) { x.classList.remove('is-on'); });
              b.classList.add('is-on');
            });
            grid.appendChild(b);
          });
          return grid;
        }
        function entText(label, key, ph, area) {
          var lbl = el('label', 'lb-field');
          lbl.innerHTML = '<span class="lb-field-label">' + label + '</span>';
          var inp = area ? el('textarea') : el('input');
          if (area) inp.rows = 2; else inp.type = 'text';
          inp.placeholder = ph; inp.value = E[key] || '';
          inp.addEventListener('input', function (e) { E[key] = e.target.value; });
          lbl.appendChild(inp); return lbl;
        }

        sec.appendChild(el('h3', 'lb-cfg-h', 'Welche Sonderfunktionen brauchst du?'));
        var fwrap = el('div', 'lb-chips');
        EOPT.sonderfunktionen.forEach(function (o) {
          var b = el('button', 'lb-chip'); b.type = 'button'; b.textContent = o.label;
          var on = E.sonderfunktionen.indexOf(o.value) > -1;
          if (on) b.classList.add('is-on');
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
          b.addEventListener('click', function () {
            var i = E.sonderfunktionen.indexOf(o.value);
            if (i > -1) E.sonderfunktionen.splice(i, 1); else E.sonderfunktionen.push(o.value);
            renderEnterprise(container); // konditionale Felder neu zeichnen
          });
          fwrap.appendChild(b);
        });
        sec.appendChild(fwrap);

        sec.appendChild(el('h3', 'lb-cfg-h', 'Ungefähre Seitenzahl?'));
        sec.appendChild(entSingle(EOPT.seitenzahl, 'seitenzahl'));

        if (E.sonderfunktionen.indexOf('shop') > -1) {
          sec.appendChild(el('h3', 'lb-cfg-h', 'Wie groß ist dein Shop (grob)?'));
          sec.appendChild(entSingle(EOPT.shopGroesse, 'shopGroesse'));
        }
        if (E.sonderfunktionen.indexOf('mehrsprachig') > -1) {
          sec.appendChild(entText('Welche Sprachen?', 'sprachen', 'z. B. Deutsch, Englisch, Französisch'));
        }
        if (E.sonderfunktionen.indexOf('schnittstelle') > -1) {
          sec.appendChild(entText('Welche Systeme / Schnittstellen?', 'schnittstellen', 'z. B. HubSpot, DATEV, Lexware …'));
        }

        sec.appendChild(el('h3', 'lb-cfg-h', 'Zeithorizont?'));
        sec.appendChild(entSingle(EOPT.zeithorizont, 'zeithorizont'));

        sec.appendChild(entText('Magst du dein Projekt kurz beschreiben? (optional)', 'notiz', 'Worum geht es, was ist dir wichtig?', true));

        container.innerHTML = '';
        container.appendChild(sec);
      }

      /* -- Add-ons (kurze Standardliste + „mehr anzeigen") -- */
      function buildAddonCard(a, st) {
        var card = el('div', 'lb-addon');
        if (st.selected) card.classList.add('is-on');

        var priceTxt = a.type === 'percent'
          ? '+' + a.pct + ' %'
          : priceLabel(a.price, { from: a.from }) + (a.type === 'month' ? '/Monat' : ' einmalig');
        var unit = a.qty ? ' <span class="lb-addon-unit">' + a.qty.unit + '</span>' : '';

        var toggle = el('button', 'lb-addon-toggle'); toggle.type = 'button';
        toggle.setAttribute('aria-pressed', st.selected ? 'true' : 'false');
        toggle.innerHTML =
          '<span class="lb-addon-check" aria-hidden="true"></span>' +
          '<span class="lb-addon-main">' +
            '<span class="lb-addon-name">' + a.name + '</span>' +
            '<span class="lb-addon-desc">' + (a.desc || '') + '</span>' +
          '</span>' +
          '<span class="lb-addon-price">' + priceTxt + unit + '</span>';
        toggle.addEventListener('click', function () {
          st.selected = !st.selected;
          renderAddons(); renderPriceBar();
        });
        card.appendChild(toggle);

        // Mengen-Stepper (nur wenn ausgewählt & Mengen-Add-on)
        if (a.qty && st.selected) {
          var q = el('div', 'lb-qty');
          q.innerHTML = '<span class="lb-qty-label">Anzahl ' + a.qty.unit.replace(/^pro /, '') + ':</span>';
          var minus = el('button', 'lb-qty-btn', '−'); minus.type = 'button'; minus.setAttribute('aria-label', 'weniger');
          var num = el('span', 'lb-qty-num', String(st.qty));
          var plus = el('button', 'lb-qty-btn', '+'); plus.type = 'button'; plus.setAttribute('aria-label', 'mehr');
          var lineTotal = el('span', 'lb-qty-total', '= ' + fmtEUR(a.price * st.qty));
          var sync = function () { num.textContent = String(st.qty); lineTotal.textContent = '= ' + fmtEUR(a.price * st.qty); renderPriceBar(); };
          minus.addEventListener('click', function () { st.qty = Math.max(a.qty.min, (st.qty || a.qty.default) - 1); sync(); });
          plus.addEventListener('click', function () { st.qty = Math.min(a.qty.max, (st.qty || a.qty.default) + 1); sync(); });
          q.appendChild(minus); q.appendChild(num); q.appendChild(plus); q.appendChild(lineTotal);
          card.appendChild(q);
        }
        return card;
      }
      function renderAddons() {
        addSec.innerHTML = '<h3 class="lb-cfg-h">3 · Add-ons <span class="lb-cfg-opt">(optional)</span></h3>';
        var grid = el('div', 'lb-addons');
        var hidden = 0;
        PRICING.addons.forEach(function (a) {
          var st = A.addons[a.id];
          // Sichtbar: kurze Standardliste (common), ausgewählte/vorbefüllte oder wenn aufgeklappt
          if (a.common || st.selected || addonsExpanded) {
            grid.appendChild(buildAddonCard(a, st));
          } else {
            hidden++;
          }
        });
        addSec.appendChild(grid);
        if (hidden > 0 || addonsExpanded) {
          var more = el('button', 'lb-addon-more');
          more.type = 'button';
          more.textContent = addonsExpanded ? 'Weniger Add-ons anzeigen' : 'Alle Add-ons anzeigen (+' + hidden + ')';
          more.addEventListener('click', function () { addonsExpanded = !addonsExpanded; renderAddons(); });
          addSec.appendChild(more);
        }
      }

      /* -- Zahlungsstaffelung (nur Anzeige) -- */
      function renderPayTerms() {
        var terms = PAY.forPackage(A.paket_gewaehlt);
        var steps = terms.map(function (s) {
          return '<li><span class="lb-pay-pct">' + s.pct + '&nbsp;%</span><span class="lb-pay-when">' + s.when + '</span></li>';
        }).join('');
        paySec.innerHTML =
          '<h3 class="lb-cfg-h">Zahlung in Meilensteinen <span class="lb-cfg-opt">(Übersicht, keine Zahlung)</span></h3>' +
          '<ol class="lb-pay-steps">' + steps + '</ol>' +
          '<p class="lb-pay-guarantee">🛡️ ' + PAY.guarantee + '</p>';
      }

      return h;
    }},

    /* ---------- Kontaktdaten (unverbindlicher Abschluss) ---------- */
    contact: { step: null, render: function () {
      var t = totals();
      var h = lumiSays('Fast geschafft — wohin darf Sartu dein Angebot schicken?',
        'Unverbindlich: Es entsteht KEIN Vertrag. Sartu bestätigt dein Angebot separat.');

      var recap = el('div', 'lb-recap');
      if (isEnterprise()) {
        recap.innerHTML =
          '<span><strong>Enterprise</strong></span>' +
          '<span class="lb-recap-sums">Individuelles Festpreis-Angebot</span>';
      } else {
        recap.innerHTML =
          '<span><strong>' + pkgById(A.paket_gewaehlt).name + '</strong> + ' + wartById(A.wartung).name + '</span>' +
          '<span class="lb-recap-sums">Einmalig <strong>' + fmtEUR(t.once) + '</strong> · Monatlich <strong>' + fmtEUR(t.monthly) + '</strong> (Pflicht)</span>';
      }
      stage.appendChild(recap);

      var form = el('form', 'lb-form');
      form.setAttribute('novalidate', 'novalidate');
      form.innerHTML =
        '<label class="lb-field"><span class="lb-field-label">Name <em>*</em></span><input type="text" name="name" autocomplete="name" required /></label>' +
        '<label class="lb-field"><span class="lb-field-label">E-Mail <em>*</em></span><input type="email" name="email" autocomplete="email" required /></label>' +
        '<label class="lb-field"><span class="lb-field-label">Telefon <em>(optional)</em></span><input type="tel" name="telefon" autocomplete="tel" /></label>' +
        '<label class="lb-check"><input type="checkbox" name="dsgvo" required />' +
          '<span>Ich habe die <a href="' + CONFIG.datenschutzUrl + '" target="_blank" rel="noopener">Datenschutzerklärung</a> ' +
          'gelesen und bin mit der Verarbeitung meiner Angaben einverstanden. <em>*</em></span></label>' +
        '<p class="lb-form-error" id="lbFormError" role="alert" hidden></p>';

      form.name.value = A.kontakt.name || '';
      form.email.value = A.kontakt.email || '';
      form.telefon.value = A.kontakt.telefon || '';
      form.dsgvo.checked = !!A.kontakt.dsgvo;

      function sync() {
        A.kontakt.name = form.name.value.trim();
        A.kontakt.email = form.email.value.trim();
        A.kontakt.telefon = form.telefon.value.trim();
        A.kontakt.dsgvo = form.dsgvo.checked;
      }
      ['input', 'change'].forEach(function (ev) { form.addEventListener(ev, sync); });

      var err = form.querySelector('#lbFormError');
      form.addEventListener('submit', function (e) {
        e.preventDefault(); sync();
        var problems = [];
        if (!A.kontakt.name) problems.push('Bitte gib deinen Namen an.');
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(A.kontakt.email)) problems.push('Bitte gib eine gültige E-Mail an.');
        if (!A.kontakt.dsgvo) problems.push('Bitte bestätige die Datenschutzerklärung.');
        if (problems.length) { err.hidden = false; err.textContent = problems[0]; return; }
        err.hidden = true; submitBriefing();
      });
      stage.appendChild(form);

      actions({
        onBack: back,
        onNext: function () { if (form.requestSubmit) form.requestSubmit(); else form.dispatchEvent(new Event('submit', { cancelable: true })); },
        nextLabel: 'Angebot anfordern',
      });
      return h;
    }},

    /* ---------- Abschluss ---------- */
    done: { step: null, render: function () {
      var h = lumiSays('Danke, ' + (A.kontakt.name.split(' ')[0] || '') + '! Das habe ich für dich zusammengestellt:');
      var list = el('div', 'lb-summary');
      summaryRows().forEach(function (r) {
        var row = el('div', 'lb-summary-row');
        row.innerHTML = '<span class="k">' + r.k + '</span><span class="v"></span>';
        row.querySelector('.v').textContent = r.v || '—';
        if (r.screen) {
          var edit = el('button', 'lb-edit', 'ändern'); edit.type = 'button';
          edit.setAttribute('aria-label', r.k + ' ändern');
          edit.addEventListener('click', function () { goTo(r.screen); });
          row.appendChild(edit);
        }
        list.appendChild(row);
      });
      stage.appendChild(list);

      // Zahlungsstaffelung (Anzeige)
      var terms = PAY.forPackage(A.paket_gewaehlt);
      var pay = el('div', 'lb-done-pay');
      pay.innerHTML = '<h4>Geplante Zahlung</h4><ol class="lb-pay-steps">' +
        terms.map(function (s) { return '<li><span class="lb-pay-pct">' + s.pct + '&nbsp;%</span><span class="lb-pay-when">' + s.when + '</span></li>'; }).join('') +
        '</ol><p class="lb-pay-guarantee">🛡️ ' + PAY.guarantee + '</p>';
      stage.appendChild(pay);

      var box = el('div', 'lb-done');
      box.innerHTML =
        '<p class="lb-done-status">' + (lastSendState.msg || '') + '</p>' +
        '<p class="lb-done-msg">Sartu meldet sich i.&nbsp;d.&nbsp;R. innerhalb von <strong>1 Werktag</strong> mit deinem Angebot. ' +
        'Es entsteht kein Vertrag — verbindlich wird es erst mit unserer Auftragsbestätigung.</p>';
      stage.appendChild(box);

      var restart = el('button', 'lb-restart', 'Neue Anfrage starten'); restart.type = 'button';
      restart.addEventListener('click', resetAll);
      stage.appendChild(restart);
      return h;
    }},
  };

  /* ============================================================
     EINZIGE ERLAUBTE RÜCKFRAGE (max. 1) — nur bei Branche „Sonstiges“
     ============================================================ */
  function leaveBranche() {
    var txt = (A.branche_sonstiges || '').trim();
    var unklar = A.branche === 'sonstiges' && txt.length < 3;
    if (unklar && !ui.askedClarification) {
      ui.askedClarification = true;
      clearStage();
      var h = lumiSays('Magst du kurz sagen, was du anbietest?',
        'Zwei, drei Worte reichen — das hilft mir bei der Empfehlung. (Kannst du auch überspringen.)');
      var lbl = el('label', 'lb-field');
      lbl.innerHTML = '<span class="lb-field-label">Deine Tätigkeit</span>';
      var inp = el('input'); inp.type = 'text'; inp.placeholder = 'z. B. „mobiler Friseur“';
      inp.value = A.branche_sonstiges || '';
      inp.addEventListener('input', function (e) { A.branche_sonstiges = e.target.value; });
      lbl.appendChild(inp); stage.appendChild(lbl);
      actions({ onBack: back, onNext: advance, skip: advance, nextLabel: 'Weiter' });
      if (h && h.focus) h.focus();
      return;
    }
    advance();
  }

  /* ============================================================
     PAKET-EMPFEHLUNG (Pfad B) — aus Umfang + Features
     ============================================================ */
  function recommend() {
    var u = A.umfang, f = A.features || [];
    var has = function (v) { return f.indexOf(v) > -1; };
    if (has('shop') || has('mehrsprachig') || has('login')) return 'enterprise';
    if (u === 'gross') return has('shop') ? 'enterprise' : 'platin';
    if (u === 'onepager') return 'basis';
    if (u === 'umfangreich' && (has('galerie') || has('terminbuchung'))) return 'platin';
    if (u === 'kompakt' || u === 'umfangreich') return 'pro';
    if (has('galerie') || has('terminbuchung')) return 'platin';
    return 'pro';
  }

  /* ============================================================
     ZUSAMMENFASSUNG / READ-BACK
     ============================================================ */
  function labelsFor(slot, values) {
    var list = OPT[slot] || [];
    return (values || []).map(function (v) {
      var o = list.filter(function (x) { return x.value === v; })[0];
      return o ? o.label : v;
    });
  }
  function labelFor(slot, value) {
    var o = (OPT[slot] || []).filter(function (x) { return x.value === value; })[0];
    return o ? o.label : (value || '');
  }
  function selectedAddonsText() {
    var out = [];
    PRICING.addons.forEach(function (a) {
      var st = A.addons[a.id];
      if (st && st.selected) {
        var q = a.qty ? ' ×' + st.qty : '';
        var amt = addonAmount(a, st);
        var price = amt == null ? '–' : fmtEUR(amt) + (a.type === 'month' ? '/Mon.' : '');
        out.push(a.name + q + ' (' + price + ')');
      }
    });
    return out.join(', ');
  }
  function colorLabel(v) { var o = (OPT.farben || []).filter(function (x) { return x.value === v; })[0]; return o ? o.label : ''; }
  function entLabel(group, value) { var o = (PRICING.enterpriseOptions[group] || []).filter(function (x) { return x.value === value; })[0]; return o ? o.label : value; }
  function summaryRows() {
    var ent = isEnterprise();
    var t = ent ? null : totals();
    var rows = [];
    // Pfad B: Briefing-Angaben zuerst
    if (A.pfad === 'B') {
      var branche = labelFor('branche', A.branche);
      if (A.branche === 'sonstiges' && A.branche_sonstiges) branche += ' (' + A.branche_sonstiges + ')';
      rows.push({ k: 'Branche', v: branche, screen: 'branche' });
      rows.push({ k: 'Ziele', v: labelsFor('ziele', A.ziele).join(', '), screen: 'ziele' });
      var umfang = labelFor('umfang', A.umfang);
      if (A.umfang && A.umfang !== 'onepager' && A.seiten.length) umfang += ' · ' + labelsFor('seiten', A.seiten).join(', ');
      rows.push({ k: 'Umfang', v: umfang, screen: 'umfang' });
      rows.push({ k: 'Funktionen', v: labelsFor('features', A.features).join(', '), screen: 'features' });
      var design = labelsFor('stil', A.stil).join(', ');
      var farben = [colorLabel(A.hauptfarbe), colorLabel(A.nebenfarbe)].filter(Boolean).join(' + ');
      if (farben) design += (design ? ' · ' : '') + farben;
      if (A.markenfarben_hex) design += ' · ' + A.markenfarben_hex;
      rows.push({ k: 'Design', v: design, screen: 'design' });
      rows.push({ k: 'Material', v: labelsFor('material', A.material).join(', '), screen: 'material' });
      rows.push({ k: 'Zeitrahmen', v: labelFor('zeitrahmen', A.zeitrahmen), screen: 'zeitrahmen' });
    }
    // Konfiguration
    if (ent) {
      rows.push({ k: 'Paket', v: 'Enterprise · individuelles Angebot', screen: 'configurator' });
      var E = A.enterprise;
      var sf = (E.sonderfunktionen || []).map(function (v) { return entLabel('sonderfunktionen', v); }).join(', ');
      if (sf) rows.push({ k: 'Sonderfunktionen', v: sf, screen: 'configurator' });
      if (E.seitenzahl) rows.push({ k: 'Seitenzahl', v: entLabel('seitenzahl', E.seitenzahl), screen: 'configurator' });
      if (E.shopGroesse) rows.push({ k: 'Shop', v: entLabel('shopGroesse', E.shopGroesse), screen: 'configurator' });
      if (E.sprachen) rows.push({ k: 'Sprachen', v: E.sprachen, screen: 'configurator' });
      if (E.schnittstellen) rows.push({ k: 'Schnittstellen', v: E.schnittstellen, screen: 'configurator' });
      if (E.zeithorizont) rows.push({ k: 'Zeithorizont', v: entLabel('zeithorizont', E.zeithorizont), screen: 'configurator' });
      if (E.notiz) rows.push({ k: 'Notiz', v: E.notiz, screen: 'configurator' });
    } else {
      var p = pkgById(A.paket_gewaehlt);
      rows.push({ k: 'Paket', v: p.name + ' · ' + priceLabel(p.price, { from: p.from }), screen: 'configurator' });
      var inc = p.includedPages || 0, tot = inc + (A.extraPages || 0);
      rows.push({ k: 'Seiten', v: tot + ' (' + inc + ' inkl.' + ((A.extraPages || 0) > 0 ? ' + ' + A.extraPages + ' extra' : '') + ')', screen: 'configurator' });
      rows.push({ k: 'Hosting & Wartung', v: wartById(A.wartung).name + ' · ' + priceLabel(wartById(A.wartung).price, { from: wartById(A.wartung).from, period: true }) + ' (Pflicht)', screen: 'configurator' });
      rows.push({ k: 'Add-ons', v: selectedAddonsText() || 'keine', screen: 'configurator' });
      rows.push({ k: 'Einmalig', v: fmtEUR(t.once) + ' netto', screen: null });
      rows.push({ k: 'Monatlich', v: fmtEUR(t.monthly) + ' netto (Pflicht)', screen: null });
    }
    return rows;
  }

  /* ============================================================
     STRUKTURIERTE AUSGABE (Speicherung + optionaler LLM-Call)
     ============================================================ */
  function collect() {
    var t = totals();
    var selectedAddons = [];
    PRICING.addons.forEach(function (a) {
      var st = A.addons[a.id];
      if (st && st.selected) {
        selectedAddons.push({
          id: a.id, name: a.name, type: a.type,
          qty: a.qty ? st.qty : 1,
          unitPrice: a.price, pct: a.pct || null,
          lineTotal: addonAmount(a, st),
        });
      }
    });
    return {
      schemaVersion: SCHEMA.version,
      pfad: A.pfad,
      createdAt: new Date().toISOString(),
      briefing: A.pfad === 'B' ? {
        branche: A.branche, branche_sonstiges: A.branche_sonstiges,
        ziele: A.ziele, umfang: A.umfang, seiten: A.seiten,
        features: A.features, stil: A.stil,
        hauptfarbe: A.hauptfarbe, nebenfarbe: A.nebenfarbe,
        markenfarben_hex: A.markenfarben_hex, material: A.material,
        uploads: A.uploads, zeitrahmen: A.zeitrahmen,
        paket_empfohlen: A.paket_empfohlen,
      } : null,
      konfiguration: isEnterprise() ? {
        modus: 'enterprise',
        paket: 'enterprise',
        anforderungen: A.enterprise,
        zahlungsstaffelung: PAY.forPackage('enterprise'),
      } : {
        modus: 'fixpreis',
        paket: A.paket_gewaehlt,
        paket_name: pkgById(A.paket_gewaehlt).name,
        paket_preis: pkgById(A.paket_gewaehlt).price,
        inklusiv_seiten: pkgById(A.paket_gewaehlt).includedPages,
        extra_seiten: A.extraPages,
        extra_seiten_preis: PRICING.extraPage.price * (A.extraPages || 0),
        wartung: A.wartung,
        wartung_name: wartById(A.wartung).name,
        wartung_preis: wartById(A.wartung).price,
        addons: selectedAddons,
        summe_einmalig: t.once,
        summe_monatlich: t.monthly,
        zahlungsstaffelung: PAY.forPackage(A.paket_gewaehlt),
      },
      kontakt: A.kontakt,
    };
  }

  /* ============================================================
     OPTIONAL: EIN LLM-Call (nur Pfad B) — später aktivieren
     Serverlose Function ruft Claude (z. B. claude-sonnet-4-6) mit
     Structured Output auf und erzwingt:
       { briefing_markdown, paket_empfehlung:{paket,begruendung}, zusammenfassung }
     API-Key NUR serverseitig.
     ============================================================ */
  async function requestBriefingFromLLM(payload) {
    if (!CONFIG.useLLM || A.pfad !== 'B' || isPlaceholder(CONFIG.llmEndpoint)) return null;
    try {
      var r = await fetch(CONFIG.llmEndpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ briefing: payload.briefing, konfiguration: payload.konfiguration }),
      });
      if (!r.ok) throw new Error('LLM ' + r.status);
      return await r.json();
    } catch (e) { console.warn('[Lumi] LLM-Call übersprungen:', e.message); return null; }
  }

  /* ============================================================
     SPEICHERUNG / VERSAND: Supabase → E-Mail → Demo-Fallback
     ============================================================ */
  async function persist(payload) {
    if (!isPlaceholder(CONFIG.supabaseUrl) && !isPlaceholder(CONFIG.supabaseKey)) {
      var r = await fetch(CONFIG.supabaseUrl.replace(/\/$/, '') + '/rest/v1/briefings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: CONFIG.supabaseKey, Authorization: 'Bearer ' + CONFIG.supabaseKey, Prefer: 'return=minimal' },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error('Supabase ' + r.status);
      return 'supabase';
    }
    if (!isPlaceholder(CONFIG.formEndpoint)) {
      var r2 = await fetch(CONFIG.formEndpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ to: CONFIG.notifyEmail, briefing: payload }),
      });
      if (!r2.ok) throw new Error('Mail ' + r2.status);
      return 'email';
    }
    try { localStorage.setItem('sartu_briefing_' + Date.now(), JSON.stringify(payload)); } catch (e) { /* ignore */ }
    console.info('[Lumi] Anfrage (Demo – kein Versand konfiguriert):', payload);
    return 'demo';
  }

  var lastSendState = { msg: '' };

  async function submitBriefing() {
    clearStage();
    showPriceBar(false);
    var h = lumiSays('Einen Moment — ich stelle deine Anfrage zusammen …');
    var spinner = el('div', 'lb-sending');
    spinner.innerHTML = '<span class="lb-dot"></span><span class="lb-dot"></span><span class="lb-dot"></span>';
    stage.appendChild(spinner);
    if (h && h.focus) h.focus();

    var payload = collect();
    try {
      var ai = await requestBriefingFromLLM(payload);
      if (ai) payload.ai = ai;
      var via = await persist(payload);
      lastSendState.msg = via === 'demo'
        ? '✓ Anfrage erstellt. (Demo-Modus: Versand noch nicht konfiguriert.)'
        : '✓ Deine Anfrage ist bei Sartu angekommen.';
    } catch (e) {
      console.warn('[Lumi] Versand fehlgeschlagen:', e.message);
      lastSendState.msg = 'Hinweis: Der automatische Versand hat nicht geklappt — Sartu kümmert sich trotzdem.';
    }
    goTo('done');
  }

  /* ============================================================
     RESET
     ============================================================ */
  function resetAll() {
    A.pfad = null;
    A.branche = null; A.branche_sonstiges = '';
    A.ziele = []; A.umfang = null; A.seiten = [];
    A.features = []; A.stil = []; A.hauptfarbe = null; A.nebenfarbe = null; A.markenfarben_hex = '';
    A.material = []; A.uploads = { logo: [], fotos: [], texte: [], texte_notiz: '', website_link: '' };
    A.zeitrahmen = null;
    A.paket_gewaehlt = null; A.paket_empfohlen = null;
    A.wartung = null; A.extraPages = 0; A.addons = {}; A._prefilled = false;
    A.enterprise = { sonderfunktionen: [], seitenzahl: null, shopGroesse: null, sprachen: '', schnittstellen: '', zeithorizont: null, notiz: '' };
    A.kontakt = { name: '', email: '', telefon: '', dsgvo: false };
    ui.askedClarification = false; lastSendState.msg = '';
    history = []; showPriceBar(false);
    renderScreen('welcome');
  }

  /* ============================================================
     START
     ============================================================ */
  renderScreen('welcome');
})();
