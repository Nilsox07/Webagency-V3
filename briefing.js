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
    supabaseUrl: 'https://uoinusdxnrvntqnafnsk.supabase.co',
    supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvaW51c2R4bnJ2bnRxbmFmbnNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwNzUyMjIsImV4cCI6MjA5NjY1MTIyMn0.NCTWr8qsz5LOzkMKlq4uWw9cJk-4Q7VKjhBR_xVZrtY',
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
    features: [], stil: null, hauptfarbe: null, nebenfarbe: null, markenfarben_hex: '',
    material: [], uploads: { logo: [], fotos: [], texte: [], texte_notiz: '', website_link: '' },
    zeitrahmen: null,
    // Was suchst du? 'website' = komplette Website (Standard), 'design' = nur Design
    produkt_typ: 'website',
    design_umfang: null,              // Design-Pfad: 'onepager' | 'mehrseiten'
    // Konfigurator
    paket_gewaehlt: null,
    paket_empfohlen: null,
    wartung: null,                    // fixer Rundum-Schutz = Paket-Floor (keine Auswahl mehr)
    extraPages: 0,                    // Seiten über dem Inklusiv-Kontingent (Variante A)
    addons: {},                       // { addonId: {selected:bool, qty:int} }
    wuensche: [],                     // Topf 3: Wünsche ohne Festpreis-Liste (onRequest-ids)
    _prefilled: false,                // Pfad-B-Vorbefüllung nur einmal anwenden
    _recShown: false,                 // Tipp-Indikator vor der Empfehlung nur einmal zeigen
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
    // Fortschritt nur im Lumi-Flow (Pfad B, komplette Website) und ab Schritt 2
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
    // Breitere Karte nur für den Design-Schritt (zweispaltige Live-Vorschau am Desktop)
    var lumiCard = document.querySelector('.lumi-card');
    if (lumiCard) lumiCard.classList.toggle('lumi-card--wide', name === 'design');
    var focusTarget = sc.render();
    if (!REDUCE) {
      // sanftes Einblenden des neuen Schritt-Inhalts (Opacity + leichter Versatz)
      stage.classList.remove('lb-anim-in');
      void stage.offsetWidth;            // Reflow erzwingen → Animation neu starten
      stage.classList.add('lb-anim-in');
    }
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

  // Auto-Weiter bei eindeutigen Einfach-Auswahlen: kurze Pause, damit die
  // Auswahl sichtbar ist, dann weiter. Bei reduzierter Bewegung sofort.
  function autoAdvance(fn) {
    var run = fn || advance;
    if (REDUCE) { run(); return; }
    setTimeout(run, 280);
  }

  // Chat-Tipp-Indikator ("Lumi schreibt …") — NUR an erzählerischen Momenten
  // (Willkommen, Pfad-B-Empfehlung), nicht vor jeder Frage. Bei reduzierter
  // Bewegung übersprungen: Inhalt erscheint sofort.
  function showTyping(done) {
    if (REDUCE) { done(); return; }
    var row = el('div', 'lb-say lb-typing-row');
    row.appendChild(el('span', 'lb-avatar', 'L'));
    var bubble = el('div', 'lb-bubble lb-typing');
    bubble.setAttribute('aria-label', 'Lumi schreibt …');
    bubble.innerHTML = '<span class="lb-typing-dots" aria-hidden="true"><span class="lb-dot"></span><span class="lb-dot"></span><span class="lb-dot"></span></span>';
    row.appendChild(bubble);
    stage.appendChild(row);
    setTimeout(function () {
      if (row.parentNode) row.parentNode.removeChild(row);
      done();
    }, 520);
  }

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
    var wishLine = (A.wuensche && A.wuensche.length)
      ? '<div class="lb-sum lb-sum-wish"><span>+ Sonderwünsche</span><strong>Festpreis im Angebot</strong></div>'
      : '';
    sums.innerHTML =
      '<div class="lb-sum"><span>Einmalig</span><strong></strong></div>' +
      '<div class="lb-sum lb-sum-mo"><span>Monatlich · Pflicht</span><strong></strong></div>' +
      wishLine;
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
  // Betrag eines Add-ons (berücksichtigt Menge, Prozent-Typ und Mindestbetrag)
  function addonAmount(a, st) {
    if (a.type === 'percent') {
      var p = pkgById(A.paket_gewaehlt);
      var base = p && p.price ? p.price : 0;
      var per = Math.round(base * (a.pct || 0) / 100);
      var pq = a.qty ? (st.qty || a.qty.default) : 1;
      var amt = per * pq;
      if (typeof a.min === 'number') amt = Math.max(a.min, amt);
      return amt;
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
    // Nachtrag Block 2: Empfehlung nur noch Logo (kein Logo) + Terminbuchung (Ziel Termine).
    // Texte/Umzug/Statistik sind in allen Paketen inklusive → keine Vorauswahl mehr.
    if (hasF('terminbuchung') || z.indexOf('termine') > -1) on('terminbuchung');
    if (!hasM('logo')) on('logo-lite');

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
      // erzählerischer Moment: kurzer Tipp-Indikator beim Einstieg, dann Begrüßung
      function buildWelcome() {
        var h = lumiSays('Hi, ich bin Lumi 👋',
          'In ~2 Minuten stellst du dir – fast nur mit Klicken – dein Website-Paket zusammen. Der Preis rechnet live mit.');
        var wrap = el('div', 'lb-welcome');
        var btn = el('button', 'btn btn-primary btn-lg lb-start');
        btn.type = 'button';
        btn.innerHTML = 'Los geht’s <span class="arrow" aria-hidden="true">→</span>';
        btn.addEventListener('click', function () { goTo('intent'); });
        wrap.appendChild(btn);
        stage.appendChild(wrap);
        if (h && h.focus) { try { h.focus({ preventScroll: true }); } catch (e) { h.focus(); } }
        return h;
      }
      showTyping(buildWelcome);
      return null;
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

    /* ---------- Weichen-Frage: Komplette Website oder nur Design? ---------- */
    intent: { step: null, render: function () {
      var h = lumiSays('Was suchst du?',
        'Beides ist möglich — du kannst es dir später noch anders überlegen.');
      var wrap = el('div', 'lb-paths');
      var a = el('button', 'lb-path-card'); a.type = 'button';
      a.innerHTML = '<span class="lb-path-icon" aria-hidden="true">🌐</span>' +
        '<span class="lb-path-title">Komplette Website — ihr kümmert euch um alles</span>' +
        '<span class="lb-path-sub">Design, Texte, Technik, online bringen und betreuen.</span>';
      a.addEventListener('click', function () { A.produkt_typ = 'website'; goTo('path'); });
      var b = el('button', 'lb-path-card'); b.type = 'button';
      b.innerHTML = '<span class="lb-path-icon" aria-hidden="true">🔄</span>' +
        '<span class="lb-path-title">Website-Redesign — meine bestehende Seite neu machen</span>' +
        '<span class="lb-path-sub">Wir übernehmen deine Inhalte — du musst fast nichts liefern.</span>';
      b.addEventListener('click', function () { A.produkt_typ = 'redesign'; A.pfad = 'B'; if (A.material.indexOf('website') < 0) A.material.push('website'); goTo('branche'); });
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
        renderSonst();
        // Auto-Weiter bei jeder Branche AUSSER „Sonstiges" (dort erscheint ein Textfeld → bleiben)
        if (v !== 'sonstiges') autoAdvance(leaveBranche);
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
      buildCards('umfang', OPT.umfang, { onPick: function (v) {
        renderSub();
        // Auto-Weiter NUR bei „One-Pager" (sonst erscheint die Seiten-Folgefrage → bleiben)
        if (v === 'onepager') autoAdvance();
      }});
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
      var h = lumiSays('Welcher Look gefällt dir?', 'Wähle einen Stil — er bestimmt die Live-Vorschau.');

      // Mockup + Helfer früh anlegen (gehoistet); angehängt wird es WEITER UNTEN
      // ins Design-Grid (mobil unter den Farbkacheln, am Desktop klebend daneben),
      // damit Klick (Farbe) und Reaktion (Vorschau) gemeinsam im Blick sind.
      var mock = window.SARTU_COLOR_MOCKUP ? window.SARTU_COLOR_MOCKUP.build() : null;
      function hexOf(v) { var o = (OPT.farben || []).filter(function (x) { return x.value === v; })[0]; return o ? o.hex : null; }
      function stilFlavor() { return A.stil || 'default'; } // EIN gewählter Stil bestimmt das Layout
      function refreshMock() { if (mock) mock.update(hexOf(A.hauptfarbe), hexOf(A.nebenfarbe), stilFlavor()); }

      // Zweispaltiges Layout (nur Desktop, via CSS): Bedienelemente links, Vorschau rechts klebend.
      // Mobil bleibt das ein normaler Block → Reihenfolge wie bisher (Vorschau inline unter den Farben).
      // has-preview nur, wenn das optionale Mockup existiert (sonst einspaltig).
      var dgrid = el('div', 'lb-design-grid');
      if (mock) dgrid.classList.add('has-preview');

      // (1) Stil-Moodboards — EINFACH-Auswahl (die Vorschau kann nur EINEN Stil zeigen)
      var moods = el('div', 'lb-moods');
      var moodBtns = {};
      OPT.stil.forEach(function (opt) {
        var b = el('button', 'lb-mood'); b.type = 'button';
        b.innerHTML = '<span class="lb-mood-art ' + opt.flavor + '" aria-hidden="true">' +
          '<span class="m1"></span><span class="m2"></span><span class="m3"></span></span>' +
          '<span class="lb-mood-label">' + opt.label + '</span>';
        var on = A.stil === opt.value;
        if (on) b.classList.add('is-on');
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        b.addEventListener('click', function () {
          A.stil = opt.value; // genau einer aktiv (andere abwählen)
          Object.keys(moodBtns).forEach(function (k) {
            var sel = k === opt.value;
            moodBtns[k].classList.toggle('is-on', sel);
            moodBtns[k].setAttribute('aria-pressed', sel ? 'true' : 'false');
          });
          refreshMock();
        });
        moodBtns[opt.value] = b;
        moods.appendChild(b);
      });
      dgrid.appendChild(moods);

      // (2) Unterfrage Farben (subQuestion hängt an stage an → in dgrid umhängen)
      dgrid.appendChild(subQuestion('Und deine Farben? Wähle eine <strong>Hauptfarbe</strong> und eine <strong>Nebenfarbe</strong>.'));

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
            refreshMock(); // Farb-Vorschau-Mockup live aktualisieren (optional, s. u.)
          });
          tiles.appendChild(b);
        });
        wrap.appendChild(tiles);
        return wrap;
      }

      // (3) Farbkacheln Haupt- + Nebenfarbe
      dgrid.appendChild(colorRow('Hauptfarbe', 'hauptfarbe'));
      dgrid.appendChild(colorRow('Nebenfarbe', 'nebenfarbe'));

      // (4) DANN die Vorschau — direkt unter den Farben (Aktion & Reaktion zusammen)
      // === Farb-Vorschau-Mockup – optional, entfernbar (siehe color-mockup.js) ===
      // Entfernen genügt: <script src="color-mockup.js"> aus briefing.html nehmen.
      // Dieser Block prüft auf window.SARTU_COLOR_MOCKUP und überspringt sich sonst.
      if (mock) { dgrid.appendChild(mock); refreshMock(); }
      // === Ende Farb-Vorschau-Mockup ===

      // (5) optionales Markenfarben-Feld (kein Pflichtfeld, kein HEX-Zwang)
      var lbl = el('label', 'lb-field lb-field-optional');
      lbl.innerHTML = '<span class="lb-field-label">Feste Markenfarbe vorhanden? <em>(HEX-Code, falls bekannt — sonst überspringen)</em></span>';
      var inp = el('input'); inp.type = 'text'; inp.placeholder = 'z. B. #B6FF3B';
      inp.value = A.markenfarben_hex || '';
      inp.addEventListener('input', function (e) { A.markenfarben_hex = e.target.value; });
      lbl.appendChild(inp); dgrid.appendChild(lbl);

      // (6) dezenter Realitäts-Hinweis (kein Baukasten)
      dgrid.appendChild(el('p', 'lb-design-note',
        'Das ist nur eine grobe Richtung zur Veranschaulichung — den Feinschliff und die genauen Farbtöne machen wir gemeinsam nach dem Start. Alles wird handgemacht, kein Baukasten.'));

      stage.appendChild(dgrid);
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
      // Nachtrag: Texte & Umzug sind im Paket inklusive — entsprechend beruhigen
      stage.appendChild(el('p', 'lb-hint', 'Keine Texte? Kein Problem — die schreiben wir sowieso für dich. Bestehende Website? Dein Umzug ist im Paket drin.'));
      if (A.produkt_typ === 'redesign') stage.appendChild(el('p', 'lb-hint', 'Deine Texte und Bilder übernehmen wir von deiner alten Seite — Umzug inklusive.'));
      stage.appendChild(uploads); renderUploads();
      actions({ onBack: back, onNext: advance, skip: advance });
      return h;
    }},

    /* ---------- Pfad B · 7 · Zeitrahmen ---------- */
    zeitrahmen: { step: 7, render: function () {
      var h = lumiSays('Bis wann brauchst du die Website?');
      buildCards('zeitrahmen', OPT.zeitrahmen, { cls: 'lb-cards lb-cards-wide', onPick: function () { autoAdvance(); } });
      actions({ onBack: back, skip: advance });
      return h;
    }},

    /* ---------- GEMEINSAMER KONFIGURATOR (Pfad A direkt, Pfad B als Ergebnis) ---------- */
    configurator: { step: 8,
      // Pfad B: erzählerischer Moment — kurzer Tipp-Indikator vor der Empfehlung
      // (nur einmal). Pfad A (Direkt-Konfigurator) springt sofort in den Aufbau.
      render: function () {
        var self = this;
        if (A.pfad === 'B' && !A._recShown) {
          A._recShown = true;
          showPriceBar(false);
          showTyping(function () {
            var bh = self.build();
            if (bh && bh.focus) { try { bh.focus({ preventScroll: true }); } catch (e) { bh.focus(); } }
          });
          return null;
        }
        return self.build();
      },
      build: function () {
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
              hint: 'Paket und Rundum-Schutz sind gesetzt, passende Extras vorgeschlagen. Ändere alles frei — der Preis rechnet live mit.' }
          : { q: 'Stell dir dein Paket zusammen.',
              hint: 'Wähle Paket und Extras — der Rundum-Schutz gehört dazu und ist schon gesetzt. Der Preis unten rechnet live mit.' });
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
      var wartSec, pageSec, addSec, wishSec; // in renderDynamic() befüllt
      stage.appendChild(pkgSec); stage.appendChild(dynSec); stage.appendChild(paySec);

      // WICHTIG: EXTRAS_VISIBLE/EXTRAS_MORE VOR dem ersten renderDynamic() zuweisen.
      // Vorher lief die var-Zuweisung erst weiter unten → beim Erstrender war
      // EXTRAS_VISIBLE undefined → forEach-Crash riss Extras, Preisleiste und Weiter-Logik ab.
      var EXTRAS_VISIBLE = ['logo-lite', 'terminbuchung', 'mehrsprachig', 'express'];
      var EXTRAS_MORE = ['newsletter'];

      renderPkg(); renderDynamic(); renderPayTerms();

      // CTA unter den Sektionen (zusätzlich zur Preisleiste)
      var cta = el('div', 'lb-cfg-cta');
      var go = el('button', 'btn btn-primary btn-lg'); go.type = 'button';
      go.innerHTML = 'Weiter zur Angebotsanfrage <span class="arrow" aria-hidden="true">→</span>';
      go.addEventListener('click', function () { goTo('contact'); });
      cta.appendChild(go);
      stage.appendChild(cta);

      // Lokale Branchen / Ziel Neukunden: dezenter Programm-Hinweis (kein Auto-Add)
      if (A.pfad === 'B' && !isEnterprise() &&
          (['gastro', 'handwerk', 'gesundheit', 'dienstleistung', 'immobilien', 'kreativ'].indexOf(A.branche) > -1
           || (A.ziele || []).indexOf('neukunden') > -1)) {
        stage.appendChild(el('p', 'lb-cfg-foot',
          'Tipp nach dem Go-live: Das Gefunden-werden-Programm ab 149 €/Monat — Google-Profil-Pflege inklusive.'));
      }

      showPriceBar(true);
      renderPriceBar();

      function rerenderAll() { renderPkg(); renderDynamic(); renderPayTerms(); renderPriceBar(); }
      function renderDynamic() {
        dynSec.innerHTML = '';
        if (isEnterprise()) { renderEnterprise(dynSec); return; }
        wartSec = el('div', 'lb-cfg-section'); dynSec.appendChild(wartSec);
        pageSec = el('div', 'lb-cfg-section'); dynSec.appendChild(pageSec);
        addSec = el('div', 'lb-cfg-section'); dynSec.appendChild(addSec);
        wishSec = el('div', 'lb-cfg-section'); dynSec.appendChild(wishSec);
        renderWartung(); renderPages(); renderAddons(); renderWuensche();
      }

      /* -- Topf 3: Wünsche ohne Festpreis-Liste (anwählbare Chips, kein Preis) -- */
      function renderWuensche() {
        var list = PRICING.onRequest || [];
        if (!list.length) return;
        wishSec.innerHTML = '<h3 class="lb-cfg-h">Wünsche ohne Festpreis-Liste <span class="lb-cfg-opt">(optional)</span></h3>';
        var grid = el('div', 'lb-wish-chips');
        list.forEach(function (w) {
          var on = A.wuensche.indexOf(w.id) > -1;
          var b = el('button', 'lb-wish-chip'); b.type = 'button';
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
          if (on) b.classList.add('is-on');
          b.innerHTML = '<span class="lb-wish-name">' + w.name + '</span>' +
            (w.desc ? '<span class="lb-wish-desc">' + w.desc + '</span>' : '');
          b.addEventListener('click', function () {
            var i = A.wuensche.indexOf(w.id);
            if (i > -1) A.wuensche.splice(i, 1); else A.wuensche.push(w.id);
            renderWuensche(); renderPriceBar();
          });
          grid.appendChild(b);
        });
        wishSec.appendChild(grid);
        wishSec.appendChild(el('p', 'lb-cfg-foot', 'Festpreis dafür steht in deinem schriftlichen Angebot.'));
      }

      /* -- Paketauswahl -- */
      function renderPkg() {
        pkgSec.innerHTML = '<h3 class="lb-cfg-h">1 · Paket</h3>';
        var grid = el('div', 'lb-pkgs');
        PRICING.packages.forEach(function (p) {
          var c = el('button', 'lb-pkg'); c.type = 'button';
          // Enterprise: "ab 9.990 €" wie auf Leistungs-/Preise-Seite (priceFrom = reine Anzeige,
          // Live-Berechnung bleibt "Individuelles Angebot" über den Enterprise-Abzweig)
          var priceTxt = p.configurable === false
            ? (p.priceFrom ? priceLabel(p.priceFrom, { from: true }) + ' · individuell' : 'Individuelles Angebot')
            : priceLabel(p.price, { from: p.from });
          var pagesLine = p.includedPages
            ? '<span class="lb-pkg-pages">' + p.includedPages + ' Seite' + (p.includedPages > 1 ? 'n' : '') + ' inkl. · jede weitere ab ' + PRICING.extraPage.price + ' €</span>'
            : '';
          // Sonderprojekte (configurable === false): schlichte Karte ohne Perk-Liste
          var body = p.configurable === false
            ? '<span class="lb-pkg-situation">Individuelles Festpreis-Angebot</span>'
            : (p.situation ? '<span class="lb-pkg-situation">Für dich, wenn ' + p.situation + '</span>' : '') +
              (p.perks && p.perks.length ? '<ul class="lb-perks">' + p.perks.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>' : '');
          c.innerHTML =
            (p.popular ? '<span class="lb-pkg-badge">Meistgewählt</span>' : '') +
            (p.id === A.paket_empfohlen && A.pfad === 'B' ? '<span class="lb-pkg-badge lb-pkg-badge-rec">Empfohlen</span>' : '') +
            '<span class="lb-pkg-name">' + p.name + '</span>' +
            '<span class="lb-pkg-price">' + priceTxt + '</span>' +
            '<span class="lb-pkg-scope">' + p.scope + '</span>' + pagesLine + body;
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

      /* -- Rundum-Schutz: gehört fix zum Paket (keine Auswahl mehr) -- */
      function renderWartung() {
        var floor = pkgFloor(A.paket_gewaehlt);
        A.wartung = floor;                 // fix auf den Paket-Floor (Care S/M/L)
        var m = wartById(floor);
        wartSec.innerHTML = '<h3 class="lb-cfg-h">2 · Rundum-Schutz <span class="lb-cfg-opt">(gehört dazu)</span></h3>';
        var box = el('div', 'lb-protect-line');
        box.innerHTML =
          '<p class="lb-protect-main">Dein Rundum-Schutz: <strong>' + m.name + '</strong> — ' +
            m.price.toLocaleString('de-DE') + ' €/Monat, gehört dazu.</p>' +
          '<p class="lb-protect-sub">Preise gelten bei Jahreszahlung. Mindestlaufzeit 12 Monate, danach monatlich kündbar.</p>' +
          '<p class="lb-protect-sub">Höhere Stufe? Sag’s uns in der Anfrage.</p>';
        wartSec.appendChild(box);
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
      // Preis-Anzeige eines Add-ons (inkl. Kombi „Einmalpreis + X €/Mon." wie KI-Chatbot)
      function addonPriceText(a) {
        if (a.type === 'percent') return '+' + a.pct + ' %';
        if (typeof a.monthly === 'number') return priceLabel(a.price, { from: a.from }) + ' + ' + a.monthly + ' €/Mon.';
        return priceLabel(a.price, { from: a.from }) + (a.type === 'month' ? '/Monat' : ' einmalig');
      }
      // Mengen-Stepper (geteilt von Listen-Card und Varianten-Karte)
      function buildQtyRow(a, st) {
        var q = el('div', 'lb-qty');
        q.innerHTML = '<span class="lb-qty-label">Anzahl ' + a.qty.unit.replace(/^pro /, '') + ':</span>';
        var minus = el('button', 'lb-qty-btn', '−'); minus.type = 'button'; minus.setAttribute('aria-label', 'weniger');
        var num = el('span', 'lb-qty-num', String(st.qty));
        var plus = el('button', 'lb-qty-btn', '+'); plus.type = 'button'; plus.setAttribute('aria-label', 'mehr');
        var lineTotal = el('span', 'lb-qty-total', '= ' + fmtEUR(addonAmount(a, st)));
        var sync = function () { num.textContent = String(st.qty); lineTotal.textContent = '= ' + fmtEUR(addonAmount(a, st)); renderPriceBar(); };
        minus.addEventListener('click', function () { st.qty = Math.max(a.qty.min, (st.qty || a.qty.default) - 1); sync(); });
        plus.addEventListener('click', function () { st.qty = Math.min(a.qty.max, (st.qty || a.qty.default) + 1); sync(); });
        q.appendChild(minus); q.appendChild(num); q.appendChild(plus); q.appendChild(lineTotal);
        return q;
      }
      function buildAddonCard(a, st) {
        var card = el('div', 'lb-addon');
        if (st.selected) card.classList.add('is-on');

        var unit = a.qty ? ' <span class="lb-addon-unit">' + a.qty.unit + '</span>' : '';
        var toggle = el('button', 'lb-addon-toggle'); toggle.type = 'button';
        toggle.setAttribute('aria-pressed', st.selected ? 'true' : 'false');
        toggle.innerHTML =
          '<span class="lb-addon-check" aria-hidden="true"></span>' +
          '<span class="lb-addon-main">' +
            '<span class="lb-addon-name">' + a.name + '</span>' +
            '<span class="lb-addon-desc">' + (a.desc || '') + '</span>' +
          '</span>' +
          '<span class="lb-addon-price">' + addonPriceText(a) + unit + '</span>';
        toggle.addEventListener('click', function () {
          st.selected = !st.selected;
          renderAddons(); renderPriceBar();
        });
        card.appendChild(toggle);
        if (a.qty && st.selected) card.appendChild(buildQtyRow(a, st));
        return card;
      }
      // Varianten-Gruppe (z. B. SEO-Betreuung Lite/Pro/Premium): Karten NEBENEINANDER
      // wie bei Paket & Wartung — genau EINE Variante wählbar, erneut klicken = abwählen.
      // Kuratierte Extras-Welt (Nachtrag Block 2): genau 4 sichtbar + 1 ausklappbar.
      // Texte/Umzug/Statistik sind in alle Pakete gewandert; SEO-Betreuung nur auf
      // /leistung-seo. Payload-Keys aller übrigen Add-ons bleiben technisch erhalten.
      // (EXTRAS_VISIBLE/EXTRAS_MORE werden bewusst VOR dem Erstrender zugewiesen — siehe oben.)
      function addonById(id) { return PRICING.addons.filter(function (a) { return a.id === id; })[0]; }
      function renderAddons() {
        addSec.innerHTML = '<h3 class="lb-cfg-h">3 · Extras <span class="lb-cfg-opt">(optional)</span></h3>';
        var grid = el('div', 'lb-addons');
        EXTRAS_VISIBLE.forEach(function (id) {
          var a = addonById(id), st = A.addons[id];
          if (a && st) grid.appendChild(buildAddonCard(a, st));
        });
        addSec.appendChild(grid);
        if (addonsExpanded) {
          var moreGrid = el('div', 'lb-addons');
          EXTRAS_MORE.forEach(function (id) {
            var a = addonById(id), st = A.addons[id];
            if (a && st) moreGrid.appendChild(buildAddonCard(a, st));
          });
          addSec.appendChild(moreGrid);
        }
        if (EXTRAS_MORE.length) {
          var more = el('button', 'lb-addon-more');
          more.type = 'button';
          more.textContent = addonsExpanded ? 'Weniger anzeigen' : 'Weitere Extras anzeigen (+' + EXTRAS_MORE.length + ')';
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
          '<span><strong>Sonderprojekte</strong></span>' +
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

      // Zahlungsstaffelung (Anzeige) — Design-Pfad: 50 % bei Auftrag, 50 % bei Lieferung
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
        // Kombi-Add-on (KI-Chatbot): Einmalpreis + monatliche Kosten gemeinsam ausweisen
        if (typeof a.monthly === 'number') price += ' + ' + fmtEUR(a.monthly) + '/Mon.';
        out.push(a.name + q + ' (' + price + ')');
      }
    });
    return out.join(', ');
  }
  function colorLabel(v) { var o = (OPT.farben || []).filter(function (x) { return x.value === v; })[0]; return o ? o.label : ''; }
  function entLabel(group, value) { var o = (PRICING.enterpriseOptions[group] || []).filter(function (x) { return x.value === value; })[0]; return o ? o.label : value; }
  function summaryRows() {
    var rows = [];
    var ent = isEnterprise();
    var t = ent ? null : totals();
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
      var design = labelFor('stil', A.stil); // Stil ist Einfach-Auswahl → genau ein Label (oder '')
      var farben = [colorLabel(A.hauptfarbe), colorLabel(A.nebenfarbe)].filter(Boolean).join(' + ');
      if (farben) design += (design ? ' · ' : '') + farben;
      if (A.markenfarben_hex) design += ' · ' + A.markenfarben_hex;
      rows.push({ k: 'Design', v: design, screen: 'design' });
      rows.push({ k: 'Material', v: labelsFor('material', A.material).join(', '), screen: 'material' });
      rows.push({ k: 'Zeitrahmen', v: labelFor('zeitrahmen', A.zeitrahmen), screen: 'zeitrahmen' });
    }
    // Konfiguration
    if (ent) {
      rows.push({ k: 'Paket', v: 'Sonderprojekte · individuelles Angebot', screen: 'configurator' });
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
      rows.push({ k: 'Rundum-Schutz', v: wartById(A.wartung).name + ' · ' + priceLabel(wartById(A.wartung).price, { from: wartById(A.wartung).from, period: true }) + ' (gehört dazu)', screen: 'configurator' });
      rows.push({ k: 'Add-ons', v: selectedAddonsText() || 'keine', screen: 'configurator' });
      if ((A.wuensche || []).length) {
        rows.push({ k: 'Sonderwünsche', v: A.wuensche.map(function (id) { var w = (PRICING.onRequest || []).filter(function (x) { return x.id === id; })[0]; return w ? w.name : id; }).join(', ') + ' · Festpreis im Angebot', screen: 'configurator' });
      }
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
    var selectedWuensche = (A.wuensche || []).map(function (id) {
      var w = (PRICING.onRequest || []).filter(function (x) { return x.id === id; })[0];
      return w ? { id: w.id, name: w.name } : { id: id };
    });
    var selectedAddons = [];
    PRICING.addons.forEach(function (a) {
      var st = A.addons[a.id];
      if (st && st.selected) {
        selectedAddons.push({
          id: a.id, name: a.name, type: a.type,
          qty: a.qty ? st.qty : 1,
          unitPrice: a.price, pct: a.pct || null,
          lineTotal: addonAmount(a, st),
          monthly: typeof a.monthly === 'number' ? a.monthly : null, // Kombi-Add-on (z. B. KI-Chatbot)
        });
      }
    });
    return {
      schemaVersion: SCHEMA.version,
      pfad: A.pfad,
      produkt_typ: A.produkt_typ, // 'website' | 'redesign' (additiv, bestehende Keys unverändert)
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
        wuensche: selectedWuensche,
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
        wuensche: selectedWuensche,
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
      // Schreibt in die Supabase-Tabelle `briefings` (Kundenportal Stufe 1).
      // anon-INSERT ist per RLS erlaubt (öffentlicher Lumi-Eingang); anon hat KEIN SELECT.
      // Spalten: payload = komplettes collect()-Objekt; kontakt_email/-name für die Admin-Inbox.
      var k = (payload && payload.kontakt) || {};
      var row = { payload: payload, kontakt_email: k.email || null, kontakt_name: k.name || null };
      var r = await fetch(CONFIG.supabaseUrl.replace(/\/$/, '') + '/rest/v1/briefings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: CONFIG.supabaseKey, Authorization: 'Bearer ' + CONFIG.supabaseKey, Prefer: 'return=minimal' },
        body: JSON.stringify(row),
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
    A.features = []; A.stil = null; A.hauptfarbe = null; A.nebenfarbe = null; A.markenfarben_hex = '';
    A.material = []; A.uploads = { logo: [], fotos: [], texte: [], texte_notiz: '', website_link: '' };
    A.zeitrahmen = null;
    A.paket_gewaehlt = null; A.paket_empfohlen = null;
    A.wartung = null; A.extraPages = 0; A.addons = {}; A._prefilled = false; A._recShown = false;
    A.enterprise = { sonderfunktionen: [], seitenzahl: null, shopGroesse: null, sprachen: '', schnittstellen: '', zeithorizont: null, notiz: '' };
    A.kontakt = { name: '', email: '', telefon: '', dsgvo: false };
    ui.askedClarification = false; lastSendState.msg = '';
    history = []; showPriceBar(false);
    renderScreen('welcome');
  }

  /* ============================================================
     START
     ============================================================ */
  // Direkteinstieg aus der Preise-Seite: briefing.html?paket=basis|pro|platin|enterprise
  // → Pfad A (Konfigurator) mit vorausgewähltem Paket, Banner/Einstieg übersprungen.
  function startFromUrl() {
    try {
      var params = new URLSearchParams(window.location.search);
      var p = params.get('paket');
      if (!p) return false;
      var valid = PRICING.packages.some(function (x) { return x.id === p; });
      if (!valid) return false;
      A.pfad = 'A';
      A.paket_gewaehlt = p;
      history = ['path'];          // „Zurück" führt zur Pfad-Auswahl, nicht ins Nichts
      renderScreen('configurator');
      return true;
    } catch (e) { return false; }
  }

  if (!startFromUrl()) renderScreen('welcome');
})();
