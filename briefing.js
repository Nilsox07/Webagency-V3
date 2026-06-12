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
    // GO-LIVE: anonymes Funnel-Tracking (nur Schrittname, KEINE PII). Erst aktiv, wenn
    // hier ein echter Beacon-Endpoint steht UND die Statistik-Einwilligung vorliegt.
    trackingEndpoint: '[ANALYTICS_BEACON_ENDPOINT]',
  };
  var isPlaceholder = function (v) { return !v || /^\[.*\]$/.test(v); };

  /* ============================================================
     DATENSCHUTZ-KONFORMES SCHRITT-TRACKING (Opt-in, ohne PII)
     ------------------------------------------------------------
     Sendet NUR den anonymen Schrittnamen — keine Antworten, keine
     Kontaktdaten. Feuert ausschließlich nach Statistik-Einwilligung
     (Cookie-Consent) UND wenn ein echter Endpoint konfiguriert ist.
     Beides ist bis GO-LIVE bewusst aus → derzeit ein No-op.
     ============================================================ */
  function trackStep(name) {
    try {
      if (isPlaceholder(CONFIG.trackingEndpoint)) return;                 // GO-LIVE: Endpoint fehlt
      if (!window.SartuConsent || !window.SartuConsent.has('analytics')) return; // Opt-in fehlt
      var body = JSON.stringify({ e: 'lumi_step', step: name, ts: Date.now() });
      if (navigator.sendBeacon) navigator.sendBeacon(CONFIG.trackingEndpoint, body);
    } catch (e) { /* still: Tracking darf den Flow nie stören */ }
  }

  /* ============================================================
     ZUSTAND — eine Quelle, bleibt über beide Pfade & Zurück erhalten
     ============================================================ */
  var A = {
    pfad: null,                       // 'A' | 'B'
    // Lumi-Flow (Pfad B)
    branche: null, branche_sonstiges: '',
    ziele: [], umfang: null, seiten: [], seiten_sonstige: '',
    features: [], stil: null, hauptfarbe: null, nebenfarbe: null, markenfarben_hex: '',
    seo_stufe: null,                  // E2: gewählte SEO-Betreuung-Stufe (additiv) | null|'lite'|'pro'|'premium'
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
    addonEmpfohlen: [],                // Pfad B: empfohlene Add-on-IDs (NUR Markierung, keine Vorauswahl)
    addonGrund: {},                   // { addonId: 'Begründungs-Halbsatz' }
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
  var fixHint = document.getElementById('lumiFixHint');

  function updateProgress(step) {
    // Fortschritt + Preis-Versprechen nur in den geführten Fragen (ab Schritt 2)
    if (A.pfad === 'B' && step && step >= 2) {
      progressWrap.hidden = false;
      progressLabel.textContent = 'Schritt ' + step + ' von ' + SCHEMA.totalSteps;
      progressFill.style.width = Math.round((step / SCHEMA.totalSteps) * 100) + '%';
      if (fixHint) fixHint.hidden = false;
    } else {
      progressWrap.hidden = true;
      if (fixHint) fixHint.hidden = true;
    }
  }

  // Reihenfolge des geführten Flows → endet in der Zusammenfassung (Empfehlung + Festpreis)
  var FLOW_B = ['branche', 'ziele', 'umfang', 'funktion_aktion', 'funktion_inhalt', 'design', 'material', 'seo', 'zusammenfassung'];
  function flowNext(name) { var i = FLOW_B.indexOf(name); return i > -1 ? FLOW_B[i + 1] : null; }

  var current = null;
  var history = [];

  function renderScreen(name) {
    var sc = screens[name];
    if (!sc) return;
    current = name;
    trackStep(name);              // anonymer Funnel-Schritt (Opt-in, No-op bis GO-LIVE)
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
  // Hook: die Zusammenfassung setzt hier eine Funktion, die den INLINE-Festpreis-Block
  // neu zeichnet. So aktualisieren alle bestehenden renderPriceBar()-Aufrufe (aus den
  // Sektionen) automatisch auch die Inline-Anzeige — die fixe Preisleiste bleibt aus.
  var updateFixblock = null;
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
  function seoProductFor(stufe) { return (PRICING.addons || []).filter(function (a) { return a.id === 'seo-' + stufe; })[0] || null; }
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
    var seoLine = '';
    if (A.seo_stufe) {
      var sp = seoProductFor(A.seo_stufe);
      if (sp) seoLine = '<div class="lb-sum lb-sum-mo"><span>SEO-Betreuung (mtl. nach 3 Mon. kündbar)</span><strong>+' + sp.price.toLocaleString('de-DE') + ' €/Mon.</strong></div>';
    }
    sums.innerHTML =
      '<div class="lb-sum"><span>Einmalig</span><strong></strong></div>' +
      '<div class="lb-sum lb-sum-mo"><span>Monatlich · Pflicht</span><strong></strong></div>' +
      seoLine + wishLine;
    sums.children[0].querySelector('strong').textContent = fmtEUR(t.once);
    sums.children[1].querySelector('strong').textContent = fmtEUR(t.monthly) + '/Mon.';
    if (priceDetailOpen) renderPriceDetail();
    if (typeof updateFixblock === 'function') updateFixblock();
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
    A.addonEmpfohlen = []; A.addonGrund = {};
    var f = A.features || [], m = A.material || [], z = A.ziele || [];
    var hasF = function (v) { return f.indexOf(v) > -1; };
    var hasM = function (v) { return m.indexOf(v) > -1; };
    // Empfehlung NUR markieren (nicht vorauswählen): ID + Begründungs-Halbsatz merken.
    // buildAddonCard zeigt Badge + Grund; Checkbox bleibt leer, Preisleiste startet ohne Extra.
    var on = function (id, grund) {
      if (A.addons[id] && A.addonEmpfohlen.indexOf(id) < 0) { A.addonEmpfohlen.push(id); if (grund) A.addonGrund[id] = grund; }
    };
    if (hasF('terminbuchung') || z.indexOf('termine') > -1) on('terminbuchung', 'dein Ziel: Termine');
    if (!hasM('logo')) on('logo-lite', 'du hast angegeben: kein Logo');

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

  // E2: Design-Richtung (Stil-Chips + Farben + HEX) — EINE Render-Funktion für
  // den Pfad-B-Schritt 'design' UND die Konfigurator-Sektion (kein Duplikat).
  function buildDesignDirection(host, withMock) {
    var mock = (withMock && window.SARTU_COLOR_MOCKUP) ? window.SARTU_COLOR_MOCKUP.build() : null;
    // hexOf akzeptiert Token (aus OPT.farben) ODER direkt einen HEX-Wert (Eigene Farbe)
    function hexOf(v) {
      if (typeof v === 'string' && /^#/.test(v)) return v;
      var o = (OPT.farben || []).filter(function (x) { return x.value === v; })[0];
      return o ? o.hex : null;
    }
    function stilFlavor() { return A.stil || 'default'; }
    function refreshMock() { if (mock) mock.update(hexOf(A.hauptfarbe), hexOf(A.nebenfarbe), stilFlavor()); }
    var dgrid = el('div', 'lb-design-grid');
    if (mock) dgrid.classList.add('has-preview');
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
        A.stil = opt.value;
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
    var sq = el('p', 'lb-subq');
    sq.innerHTML = 'Und deine Farben? Wähle eine <strong>Hauptfarbe</strong> und eine <strong>Nebenfarbe</strong>.';
    dgrid.appendChild(sq);

    function isHex(v) { return typeof v === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(v); }
    // „Eigene Farbe"-Popover: nativer Farbwähler + HEX-Eingabe + RGB-Anzeige → setzt A[slot] auf HEX
    function openColorPopover(wrap, slot, onApply) {
      var ex = wrap.querySelector('.lb-colorpop'); if (ex) { wrap.removeChild(ex); return; }
      var cur = isHex(A[slot]) ? A[slot] : '#2a5bd7';
      var pop = el('div', 'lb-colorpop');
      var color = el('input'); color.type = 'color'; color.className = 'lb-colorpop-native'; color.value = cur;
      var hex = el('input'); hex.type = 'text'; hex.className = 'lb-colorpop-hex'; hex.value = cur;
      hex.setAttribute('aria-label', 'HEX-Code'); hex.placeholder = '#RRGGBB';
      var rgb = el('span', 'lb-colorpop-rgb');
      function toRgb(h) { var m = /^#?([0-9a-fA-F]{6})$/.exec(h); if (!m) return ''; var n = parseInt(m[1], 16); return 'RGB ' + ((n >> 16) & 255) + ', ' + ((n >> 8) & 255) + ', ' + (n & 255); }
      function apply(h) {
        if (!/^#?[0-9a-fA-F]{6}$/.test(h)) return;
        if (h[0] !== '#') h = '#' + h;
        A[slot] = h; rgb.textContent = toRgb(h); onApply(); refreshMock();
      }
      rgb.textContent = toRgb(cur);
      color.addEventListener('input', function (e) { hex.value = e.target.value; apply(e.target.value); });
      hex.addEventListener('input', function (e) { apply(e.target.value); });
      var done = el('button', 'lb-colorpop-done'); done.type = 'button'; done.textContent = 'Übernehmen';
      done.addEventListener('click', function () { apply(hex.value); if (pop.parentNode) pop.parentNode.removeChild(pop); });
      pop.appendChild(color); pop.appendChild(hex); pop.appendChild(rgb); pop.appendChild(done);
      wrap.appendChild(pop);
    }

    function colorRow(label, slot) {
      var wrap = el('div', 'lb-colorrow');
      wrap.appendChild(el('span', 'lb-colorrow-label', label));
      var tiles = el('div', 'lb-colortiles');
      function renderTiles() {
        tiles.textContent = '';
        OPT.farben.forEach(function (opt) {
          var b = el('button', 'lb-colortile'); b.type = 'button';
          var sel = A[slot] === opt.value;
          b.setAttribute('aria-label', label + ': ' + opt.label + ' — ' + (opt.mood || ''));
          b.setAttribute('aria-pressed', sel ? 'true' : 'false');
          if (sel) b.classList.add('is-on');
          b.innerHTML = '<span class="lb-colordot" style="background:' + opt.hex + '"></span>' +
            '<small class="lb-colorname">' + opt.label + '</small>' +
            '<small class="lb-colormood">' + (opt.mood || '') + '</small>';
          b.addEventListener('click', function () { A[slot] = (A[slot] === opt.value) ? null : opt.value; renderTiles(); refreshMock(); });
          tiles.appendChild(b);
        });
        // Eigene Farbe (HEX) als ausgewählter Kreis, falls gesetzt
        if (isHex(A[slot])) {
          var cb = el('button', 'lb-colortile lb-colortile-custom is-on'); cb.type = 'button';
          cb.setAttribute('aria-pressed', 'true'); cb.setAttribute('aria-label', label + ': eigene Farbe ' + A[slot]);
          cb.innerHTML = '<span class="lb-colordot" style="background:' + A[slot] + '"></span>' +
            '<small class="lb-colorname">Eigene</small><small class="lb-colormood">' + A[slot] + '</small>';
          cb.addEventListener('click', function () { A[slot] = null; renderTiles(); refreshMock(); });
          tiles.appendChild(cb);
        }
        // Runder „Eigene Farbe +"-Button → Popover
        var add = el('button', 'lb-colortile lb-colortile-add'); add.type = 'button';
        add.setAttribute('aria-label', label + ': eigene Farbe wählen');
        add.innerHTML = '<span class="lb-coloradd" aria-hidden="true">+</span><small class="lb-colorname">Eigene Farbe</small>';
        add.addEventListener('click', function () { openColorPopover(wrap, slot, renderTiles); });
        tiles.appendChild(add);
      }
      renderTiles();
      wrap.appendChild(tiles);
      return wrap;
    }
    dgrid.appendChild(colorRow('Hauptfarbe', 'hauptfarbe'));
    dgrid.appendChild(colorRow('Nebenfarbe', 'nebenfarbe'));
    if (mock) { dgrid.appendChild(mock); refreshMock(); }
    dgrid.appendChild(el('p', 'lb-design-note',
      'Zeigt nur, wie deine Farben wirken — dein Design entwerfen wir individuell, das Layout hier ist nicht dein Layout. Alles handgemacht, kein Baukasten.'));
    host.appendChild(dgrid);
  }

  /* ============================================================
     PREIS-TRANSPARENZ IN DEN FRAGEN (ab-Preise/Aufpreise aus pricing.js)
     — keine harten Werte, alles aus PRICING abgeleitet.
     ============================================================ */
  function addonById_(id) { return (PRICING.addons || []).filter(function (a) { return a.id === id; })[0]; }
  function eur_(n) { return (n || 0).toLocaleString('de-DE') + ' €'; }
  // Umfang: Einstiegs-Festpreis je Größe (Paket-Floor) als „ab X €" anhängen.
  // Floors: One-Pager→Start, Mehrere→Wachstum, Groß→Platzhirsch, Über 20→Sonderprojekte (kein Fixpreis).
  function umfangOptionsPriced() {
    var floor = { onepager: 'basis', kompakt: 'pro', umfangreich: 'platin', gross: 'enterprise' };
    return (OPT.umfang || []).map(function (o) {
      var p = pkgById(floor[o.value]);
      var sub = o.sub;
      if (p && typeof p.price === 'number') sub = o.sub + ' · ab ' + p.price.toLocaleString('de-DE') + ' €';
      return { value: o.value, label: o.label, sub: sub, icon: o.icon };
    });
  }

  /* ============================================================
     FUNKTIONS-AUSWAHL (zwei Schritte) — Zeilen-Karten mit Preis-Tags
     Preise/Aufpreise ausschließlich aus pricing.js. Auswahl landet in
     A.features; preisrelevante Funktionen werden auf A.addons gespiegelt
     (syncAddonsFromFeatures) — keine Vorauswahl, nur explizite Klicks.
     ============================================================ */
  var FUNK_AKTION = [
    { value: 'kontaktformular', label: 'Kontaktformular', desc: 'Besucher schreiben dir direkt über ein Formular.', kind: 'inklusive' },
    { value: 'terminbuchung', label: 'Online-Terminbuchung', desc: 'Kunden buchen selbst Termine — mit Bestätigungs- und Erinnerungsmail.', kind: 'price', addon: 'terminbuchung' },
    { value: 'ki-assistent', label: 'KI-Chat-Assistent', desc: 'Beantwortet Besucherfragen rund um die Uhr — trainiert auf deine Inhalte. Bis 500 Unterhaltungen/Monat.', kind: 'combo', addon: 'ki-assistent' },
    { value: 'shop', label: 'Shop / Bezahlung', desc: 'Produkte online verkaufen — mit Warenkorb und sicherer Bezahlung.', kind: 'onrequest' },
    { value: 'login', label: 'Geschützter Kundenbereich', desc: 'Passwortgeschützter Bereich für Kunden, Mitglieder oder Dokumente.', kind: 'onrequest' },
    { value: 'whatsapp', label: 'WhatsApp-Kontakt', desc: 'Ein Klick öffnet den Chat mit dir auf WhatsApp.', kind: 'inklusive' },
    { value: 'bewertungen', label: 'Google-Bewertungen einbinden', desc: 'Zeigt deine echten Google-Rezensionen direkt auf der Seite.', kind: 'inklusive' },
  ];
  var FUNK_INHALT = [
    { value: 'blog', label: 'Bereich für Neuigkeiten / Blog', desc: 'Eigene Beiträge, News oder ein Blog.', kind: 'platin' },
    { value: 'galerie', label: 'Bildergalerie', desc: 'Zeig deine Arbeiten, Produkte oder Räume in Bildern.', kind: 'inklusive' },
    { value: 'newsletter', label: 'Newsletter-Anmeldung', desc: 'Sammle E-Mail-Adressen mit Double-Opt-In, DSGVO-konform.', kind: 'price_platin', addon: 'newsletter' },
    { value: 'mehrsprachig', label: 'Mehrsprachig', desc: 'Deine Website in mehreren Sprachen — technisch sauber eingerichtet.', kind: 'percent', addon: 'mehrsprachig' },
    { value: 'anfahrt', label: 'Anfahrt & Karte', desc: 'Karte mit deinem Standort und Anfahrtsbeschreibung.', kind: 'inklusive' },
    { value: 'social', label: 'Social-Media-Einbindung', desc: 'Verlinkt oder zeigt deine Social-Media-Profile.', kind: 'inklusive' },
    { value: 'download', label: 'Download-Bereich', desc: 'Stelle PDFs, Preislisten oder Formulare zum Download bereit.', kind: 'inklusive' },
    { value: 'beraten', label: 'Weiß nicht — beratet mich', desc: 'Wir empfehlen dir, was zu deinem Ziel passt.', kind: 'beraten', exclusive: true },
  ];
  function funcTag(it) {
    var a;
    switch (it.kind) {
      case 'inklusive': return { cls: 'lb-func-tag-incl', text: 'inklusive' };
      case 'price': a = addonById_(it.addon); return { cls: 'lb-func-tag-price', text: '+' + eur_(a.price) };
      case 'combo': a = addonById_(it.addon); return { cls: 'lb-func-tag-price', text: '+' + eur_(a.price) + ' · +' + a.monthly + ' €/Mon.' };
      case 'percent': a = addonById_(it.addon); return { cls: 'lb-func-tag-price', text: '+' + a.pct + ' % je Sprache' };
      case 'price_platin': a = addonById_(it.addon); return { cls: 'lb-func-tag-price', text: '+' + eur_(a.price) + ' · im Platzhirsch inkl.' };
      case 'onrequest': return { cls: 'lb-func-tag-req', text: 'Festpreis im Angebot' };
      case 'platin': return { cls: 'lb-func-tag-platin', text: 'im Platzhirsch inklusive' };
      default: return null;
    }
  }
  // Preisrelevante Funktionen → A.addons spiegeln (Newsletter im Platzhirsch inklusive → kein Aufpreis)
  function syncAddonsFromFeatures() {
    ensureAddonState();
    var map = { terminbuchung: 'terminbuchung', 'ki-assistent': 'ki-assistent', newsletter: 'newsletter', mehrsprachig: 'mehrsprachig' };
    Object.keys(map).forEach(function (feat) {
      var st = A.addons[map[feat]]; if (!st) return;
      var on = A.features.indexOf(feat) > -1;
      if (feat === 'newsletter' && A.paket_gewaehlt === 'platin') on = false;
      st.selected = on;
    });
  }
  function buildFuncCards(host, items) {
    var grid = el('div', 'lb-funcs');
    function refresh() {
      Array.prototype.forEach.call(grid.querySelectorAll('.lb-func'), function (card) {
        var v = card.getAttribute('data-val'), on = A.features.indexOf(v) > -1;
        card.querySelector('input').checked = on; card.classList.toggle('is-on', on);
      });
    }
    items.forEach(function (it) {
      var card = el('label', 'lb-func'); card.setAttribute('data-val', it.value);
      var on = A.features.indexOf(it.value) > -1;
      if (on) card.classList.add('is-on');
      var tag = funcTag(it);
      card.innerHTML =
        '<input type="checkbox" class="lb-func-check"' + (on ? ' checked' : '') + ' />' +
        '<span class="lb-func-body">' +
          '<span class="lb-func-top"><span class="lb-func-name">' + it.label + '</span>' +
            (tag ? '<span class="lb-func-tag ' + tag.cls + '">' + tag.text + '</span>' : '') + '</span>' +
          '<span class="lb-func-desc">' + it.desc + '</span>' +
        '</span>';
      card.querySelector('input').addEventListener('change', function (e) {
        var v = it.value;
        if (e.target.checked) {
          if (it.exclusive) { A.features = [v]; }
          else { A.features = A.features.filter(function (x) { return x !== 'beraten' && x !== v; }); A.features.push(v); }
        } else {
          A.features = A.features.filter(function (x) { return x !== v; });
        }
        syncAddonsFromFeatures();
        refresh();
      });
      grid.appendChild(card);
    });
    host.appendChild(grid);
    return grid;
  }

  // SEO-Schritt: 4 Zeilen-Karten (Erstmal ohne = Default, dann Lite/Pro/Premium aus pricing.js).
  // KEINE Vorauswahl (A.seo_stufe bleibt null). Empfehlungs-Badge auf Lite bei lokaler Branche + Ziel Neukunden.
  var SEO_DESC = {
    lite: 'Google-Profil-Pflege, Title & Meta aller Seiten, Keyword-Tracking, Klartext-Monatsreport.',
    pro: 'Alles aus Lite + KI-Suche-Optimierung, je Monat eine neue Seite inkl. Text, Quartals-Strategie.',
    premium: 'Alles aus Pro + Sichtbarkeits-Monitoring, bis 2 neue Seiten pro Monat, monatlicher Maßnahmenplan.',
  };
  function buildSeoCards(host) {
    var SEO_LOCAL = ['gastro', 'handwerk', 'gesundheit', 'dienstleistung', 'immobilien', 'kreativ'];
    var empfohlen = SEO_LOCAL.indexOf(A.branche) > -1 && (A.ziele || []).indexOf('neukunden') > -1;
    var grid = el('div', 'lb-funcs lb-seo');
    function refresh() {
      Array.prototype.forEach.call(grid.querySelectorAll('.lb-func'), function (c) {
        var v = c.getAttribute('data-val'), on = (v === 'none') ? !A.seo_stufe : (A.seo_stufe === v);
        c.querySelector('input').checked = on; c.classList.toggle('is-on', on);
      });
    }
    function card(v, name, price, desc, rec) {
      var c = el('label', 'lb-func lb-func-radio'); c.setAttribute('data-val', v);
      var on = (v === 'none') ? !A.seo_stufe : (A.seo_stufe === v);
      if (on) c.classList.add('is-on');
      var tag = price == null
        ? '<span class="lb-func-tag lb-func-tag-incl">0 €</span>'
        : '<span class="lb-func-tag lb-func-tag-price">' + price.toLocaleString('de-DE') + ' €/Mon.</span>';
      c.innerHTML =
        '<input type="radio" name="lbseo" class="lb-func-check"' + (on ? ' checked' : '') + ' />' +
        '<span class="lb-func-body"><span class="lb-func-top"><span class="lb-func-name">' + name +
          (rec ? ' <span class="lb-pkg-badge lb-pkg-badge-rec" style="position:static;display:inline-block;margin-left:6px;">Empfohlen</span>' : '') +
          '</span>' + tag + '</span><span class="lb-func-desc">' + desc + '</span></span>';
      c.querySelector('input').addEventListener('change', function () {
        A.seo_stufe = (v === 'none') ? null : v; refresh();
      });
      grid.appendChild(c);
    }
    card('none', 'Erstmal ohne', null, 'Kein laufender Beitrag — du kannst die SEO-Betreuung jederzeit später starten.', false);
    (PRICING.addons || []).filter(function (a) { return a.group === 'seo-betreuung'; }).forEach(function (a) {
      var stufe = a.id.replace('seo-', '');
      card(stufe, 'SEO ' + (a.short || a.name), a.price, SEO_DESC[stufe] || a.desc, empfohlen && stufe === 'lite');
    });
    host.appendChild(grid);
    return grid;
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

    /* ---------- Weichen-Frage: Komplette Website oder Redesign? ---------- */
    intent: { step: null, render: function () {
      var h = lumiSays('Was suchst du?',
        'Beides ist möglich — du kannst es dir später noch anders überlegen.');
      var wrap = el('div', 'lb-paths');
      var a = el('button', 'lb-path-card'); a.type = 'button';
      a.innerHTML = '<span class="lb-path-icon" aria-hidden="true">🌐</span>' +
        '<span class="lb-path-title">Komplette Website — ihr kümmert euch um alles</span>' +
        '<span class="lb-path-sub">Design, Texte, Technik, online bringen und betreuen.</span>';
      a.addEventListener('click', function () { A.produkt_typ = 'website'; A.pfad = 'B'; goTo('branche'); });
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
          // „Sonstige …" — Toggle öffnet ein einzeiliges Textfeld (Payload: seiten_sonstige)
          var sonstWrap = el('div', 'lb-inline');
          var tgl = el('button', 'lb-chip lb-chip-sonst'); tgl.type = 'button'; tgl.textContent = 'Sonstige …';
          var open = !!A.seiten_sonstige;
          function renderSonstField() {
            var ex = sonstWrap.querySelector('.lb-field'); if (ex) sonstWrap.removeChild(ex);
            tgl.classList.toggle('is-on', open); tgl.setAttribute('aria-pressed', open ? 'true' : 'false');
            if (open) {
              var lbl = el('label', 'lb-field');
              lbl.innerHTML = '<span class="lb-field-label">Weitere Seiten <em>(optional)</em></span>';
              var inp = el('input'); inp.type = 'text'; inp.placeholder = 'z. B. „Speisekarte, Anfahrt, Partner“';
              inp.value = A.seiten_sonstige || '';
              inp.addEventListener('input', function (e) { A.seiten_sonstige = e.target.value; });
              lbl.appendChild(inp); sonstWrap.appendChild(lbl);
            }
          }
          tgl.addEventListener('click', function () { open = !open; if (!open) A.seiten_sonstige = ''; renderSonstField(); });
          sonstWrap.appendChild(tgl); sub.appendChild(sonstWrap); renderSonstField();
        }
      }
      buildCards('umfang', umfangOptionsPriced(), { onPick: function (v) {
        renderSub();
        // Auto-Weiter NUR bei „One-Pager" (sonst erscheint die Seiten-Folgefrage → bleiben)
        if (v === 'onepager') autoAdvance();
      }});
      stage.appendChild(sub); renderSub();
      actions({ onBack: back, onNext: advance, skip: advance });
      return h;
    }},

    /* ---------- Pfad B · 4 · Funktionen · Aktionen ---------- */
    funktion_aktion: { step: 4, render: function () {
      var h = lumiSays('Womit sollen deine Besucher etwas tun?', 'Mehrfachauswahl — den Preis siehst du direkt an jeder Funktion.');
      buildFuncCards(stage, FUNK_AKTION);
      actions({ onBack: back, onNext: advance, skip: advance });
      return h;
    }},

    /* ---------- Pfad B · 5 · Funktionen · Inhalte ---------- */
    funktion_inhalt: { step: 5, render: function () {
      var h = lumiSays('Was soll deine Website zeigen?', 'Mehrfachauswahl möglich.');
      buildFuncCards(stage, FUNK_INHALT);
      actions({ onBack: back, onNext: advance, skip: advance });
      return h;
    }},

    /* ---------- Pfad B · 6 · Design (Stil + Farben) ---------- */
    design: { step: 6, render: function () {
      var h = lumiSays('Welcher Look gefällt dir?', 'Wähle einen Stil — er bestimmt die Live-Vorschau.');
      buildDesignDirection(stage, true);
      actions({ onBack: back, onNext: advance, skip: advance });
      return h;
    }},

    /* ---------- Pfad B · 7 · Material + Termin (verschmolzen) ---------- */
    material: { step: 7, render: function () {
      var h = lumiSays('Fast geschafft — was hast du schon, und bis wann brauchst du die Website?', 'Uploads sind optional — du kannst alles auch später nachreichen.');
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
      // Termin-Reihe (verschmolzen aus dem früheren Zeitrahmen-Schritt)
      stage.appendChild(el('p', 'lb-subq', 'Und bis wann brauchst du sie?'));
      buildCards('zeitrahmen', OPT.zeitrahmen, { cls: 'lb-cards lb-cards-wide' });
      actions({ onBack: back, onNext: advance, skip: advance });
      return h;
    }},

    /* ---------- Pfad B · 8 · Sichtbarkeit nach dem Start (SEO) ---------- */
    seo: { step: 8, render: function () {
      var h = lumiSays('Willst du nach dem Go-live bei Google aktiv nach oben klettern?',
        'Optional — du kannst die SEO-Betreuung auch später starten. Monatlich, nach 3 Monaten kündbar.');
      buildSeoCards(stage);
      actions({ onBack: back, onNext: advance, skip: advance });
      return h;
    }},

    /* ---------- ZUSAMMENFASSUNG: EINE Empfehlung + Festpreis (ein Weg für alle) ---------- */
    zusammenfassung: { step: null,
      // erzählerischer Moment — kurzer Tipp-Indikator vor der Empfehlung (nur einmal)
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
      // Paket-Vorauswahl = Empfehlung; frei änderbar über „Anderes Paket wählen".
      if (!A.paket_gewaehlt) {
        A.paket_empfohlen = recommend();
        A.paket_gewaehlt = A.paket_empfohlen;
      } else if (!A.paket_empfohlen) {
        A.paket_empfohlen = recommend();
      }
      ensureWartungDefault();
      ensureAddonState();
      prefillFromBriefing();
      syncAddonsFromFeatures();        // gewählte Funktionen (Schritte 4/5) → Festpreis

      showPriceBar(false);             // keine fixe Preisleiste mehr — der Festpreis steht inline
      var ent = isEnterprise();
      var p = pkgById(A.paket_gewaehlt);

      var intro = ent
        ? { q: 'Für dein Vorhaben empfehle ich ein individuelles Festpreis-Angebot.',
            hint: 'Sag mir kurz, was du brauchst — den genauen Festpreis bekommst du schriftlich, bevor du zusagst.' }
        : (A.pfad === 'A'
          ? { q: 'Du hast „' + p.name + '“ gewählt — hier ist dein Festpreis.',
              hint: 'Alles drin, kein Kleingedrucktes. Du kannst unten anpassen oder ein anderes Paket wählen.' }
          : { q: 'Auf Basis deiner Angaben empfehle ich „' + p.name + '“.',
              hint: 'Das ist alles, was du brauchst — zum Festpreis. Unten kannst du noch anpassen, wenn du möchtest.' });
      var h = lumiSays(intro.q, intro.hint);

      // Konstanten/Container VOR dem ersten Render der Sektionen (Crash-Historie, siehe Logo-Hinweis)
      var EXTRAS_VISIBLE = ['terminbuchung', 'mehrsprachig', 'express'];
      var EXTRAS_MORE = ['newsletter'];
      var addonsExpanded = false;
      var pageSec, addSec, brandSec, seoSec, wishSec;   // Accordion-Bodies (in renderAccordions() befüllt)

      // 1) EINE Empfehlungs-Karte  2) Festpreis-Block (inline)  3) Zahlungs-Hinweiszeile
      var recCard = el('div', 'lb-reccard'); stage.appendChild(recCard);
      var fixBlock = el('div', 'lb-fixblock'); stage.appendChild(fixBlock);
      var payHint = el('p', 'lb-fix-payhint',
        'Zahlung in Meilensteinen · alle Preise netto zzgl. MwSt. — unverbindliche Übersicht, kein Vertrag.');
      stage.appendChild(payHint);

      if (ent) {
        renderRecCardEnterprise(); renderFixblock();
        var entSec = el('div', 'lb-cfg-section'); stage.appendChild(entSec);
        renderEnterprise(entSec);
      } else {
        renderRecCard(); renderFixblock();
        // alles Weitere standardmäßig ZU: Anpassungen liegen in geschlossenen Accordions
        var accWrap = el('div', 'lb-accordions'); stage.appendChild(accWrap);
        renderAccordions(accWrap);
      }

      // Weiter / Zurück (einzige offene Buttons im Standard)
      actions({ onBack: back, onNext: function () { goTo('contact'); }, nextLabel: 'Weiter zur Angebotsanfrage' });

      // Hook: bestehende renderPriceBar()-Aufrufe (aus den Sektionen) aktualisieren den Inline-Block
      updateFixblock = function () { if (fixBlock && fixBlock.isConnected) renderFixblock(); };

      /* -- Inline-Festpreis-Block (Standard sichtbar, aktualisiert sich bei jeder Änderung) -- */
      function renderFixblock() {
        if (ent) { fixBlock.innerHTML = '<div class="lb-fix-row lb-fix-individual">Individuelles Festpreis-Angebot</div>'; return; }
        var t = totals();
        var seoLine = '';
        if (A.seo_stufe) { var sp = seoProductFor(A.seo_stufe); if (sp) seoLine = '<div class="lb-fix-row lb-fix-mo"><span>+ SEO-Betreuung</span><strong>' + sp.price.toLocaleString('de-DE') + ' €/Mon.</strong></div>'; }
        var wishLine = (A.wuensche && A.wuensche.length) ? '<div class="lb-fix-row lb-fix-wish"><span>+ Sonderwünsche</span><strong>Festpreis im Angebot</strong></div>' : '';
        fixBlock.innerHTML =
          '<div class="lb-fix-head">Dein Festpreis</div>' +
          '<div class="lb-fix-row"><span>Einmalig</span><strong>' + fmtEUR(t.once) + '</strong></div>' +
          '<div class="lb-fix-row lb-fix-mo"><span>Monatlich · Pflicht</span><strong>' + fmtEUR(t.monthly) + '/Mon.</strong></div>' +
          seoLine + wishLine;
      }

      /* -- EINE Empfehlungs-Karte (Name, Situation, Klartext-Inklusivliste, Rundum-Schutz) -- */
      function renderRecCard() {
        var m = wartById(A.wartung);
        var perks = (p.perks || []).map(function (x) { return '<li>' + x + '</li>'; }).join('');
        recCard.innerHTML =
          '<div class="lb-reccard-head"><span class="lb-reccard-name">' + p.name + '</span>' +
            '<span class="lb-reccard-price">' + priceLabel(p.price, { from: p.from }) + '</span></div>' +
          (p.situation ? '<p class="lb-reccard-situation">Für dich, wenn ' + p.situation + '</p>' : '') +
          '<ul class="lb-reccard-perks">' + perks +
            '<li>Alle Texte schreiben wir — du lieferst nur Stichpunkte.</li></ul>' +
          '<p class="lb-reccard-care">Rundum-Schutz <strong>' + m.name + '</strong> (' + m.price.toLocaleString('de-DE') + ' €/Mon.) gehört dazu.</p>';
      }
      function renderRecCardEnterprise() {
        var ep = pkgById('enterprise');
        recCard.innerHTML =
          '<div class="lb-reccard-head"><span class="lb-reccard-name">' + ep.name + '</span>' +
            '<span class="lb-reccard-price">individuell</span></div>' +
          '<p class="lb-reccard-situation">Dein Vorhaben ist größer als ein Standard-Paket — deshalb bekommst du ein eigenes Angebot.</p>' +
          '<ul class="lb-reccard-perks">' + (ep.perks || []).map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>';
      }

      /* -- Accordions (FAQ-Optik, standardmäßig ZU) + kompakte Paket-Umwahl -- */
      function makeAcc(host, title) {
        var d = el('details', 'lb-acc');
        var s = el('summary', 'lb-acc-sum'); s.textContent = title; d.appendChild(s);
        var body = el('div', 'lb-acc-body'); d.appendChild(body);
        host.appendChild(d);
        return body;
      }
      function renderAccordions(host) {
        // Funktionen (Schritte 4/5) und Sichtbarkeit (Schritt 8) werden jetzt in den Fragen
        // gewählt — daher KEIN Extras- und KEIN SEO-Accordion mehr hier.
        host.innerHTML = '';
        pageSec  = makeAcc(host, 'Seitenzahl anpassen');
        brandSec = makeAcc(host, 'Logo & Branding');
        wishSec  = makeAcc(host, 'Wünsche ohne Festpreis');
        renderPages(); renderBranding(); renderWuensche();
        renderPkgSwitch(host);
      }
      // „Anderes Paket wählen" — kompakte Liste (Name + Preis + 1 Satz), KEIN Karten-Raster
      function renderPkgSwitch(host) {
        var d = el('details', 'lb-acc lb-acc-switch');
        var s = el('summary', 'lb-acc-sum lb-acc-sum-link'); s.textContent = 'Anderes Paket wählen'; d.appendChild(s);
        var body = el('div', 'lb-acc-body');
        var list = el('div', 'lb-pkgswitch');
        PRICING.packages.forEach(function (pk) {
          var row = el('button', 'lb-pkgswitch-row'); row.type = 'button';
          if (A.paket_gewaehlt === pk.id) row.classList.add('is-on');
          var priceTxt = pk.configurable === false
            ? (pk.priceFrom ? priceLabel(pk.priceFrom, { from: true }) : 'individuell')
            : priceLabel(pk.price, { from: pk.from });
          row.innerHTML =
            '<span class="lb-pkgswitch-name">' + pk.name + '</span>' +
            '<span class="lb-pkgswitch-price">' + priceTxt + '</span>' +
            '<span class="lb-pkgswitch-line">' + pk.scope + '</span>';
          row.addEventListener('click', function () {
            A.paket_gewaehlt = pk.id;
            ensureWartungDefault();
            if (pk.includedPages == null) A.extraPages = 0;
            renderScreen('zusammenfassung');     // alles frisch: Karte + Festpreis + Sektionen
          });
          list.appendChild(row);
        });
        body.appendChild(list); d.appendChild(body); host.appendChild(d);
      }

      /* -- Topf 3: Wünsche ohne Festpreis-Liste (anwählbare Chips, kein Preis) -- */
      function renderWuensche() {
        var list = PRICING.onRequest || [];
        if (!list.length) return;
        wishSec.innerHTML = '<p class="lb-cfg-foot" style="margin-top:0;margin-bottom:12px;">Größere Wünsche ohne öffentlichen Festpreis — den Festpreis bekommst du schriftlich, bevor du zusagst.</p>';
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
      function brandingProducts() { return (PRICING.addons || []).filter(function (a) { return a.group === 'branding'; }); }
      function clearBranding() { brandingProducts().forEach(function (o) { if (A.addons[o.id]) A.addons[o.id].selected = false; }); }
      function renderBranding() {
        brandSec.innerHTML = '';
        var grid = el('div', 'lb-pkgs');
        brandingProducts().forEach(function (a) {
          var st = A.addons[a.id];
          var c = el('button', 'lb-pkg'); c.type = 'button';
          var rec = (A.addonEmpfohlen || []).indexOf(a.id) > -1;
          c.innerHTML =
            (rec ? '<span class="lb-pkg-badge lb-pkg-badge-rec">Empfohlen</span>' : '') +
            '<span class="lb-pkg-name">' + a.name + '</span>' +
            '<span class="lb-pkg-price">' + a.price.toLocaleString('de-DE') + ' € einmalig</span>' +
            '<ul class="lb-perks"><li>' + (a.desc || '') + '</li></ul>';
          if (st && st.selected) c.classList.add('is-on');
          c.addEventListener('click', function () {
            var was = st && st.selected;
            clearBranding();                 // exklusiv: nur EINE Stufe
            if (st) st.selected = !was;
            renderBranding(); renderPriceBar();
          });
          grid.appendChild(c);
        });
        var none = el('button', 'lb-pkg'); none.type = 'button';
        none.innerHTML =
          '<span class="lb-pkg-name">Brauche ich nicht</span>' +
          '<span class="lb-pkg-price">0 €</span>' +
          '<span class="lb-pkg-scope">Du hast schon ein Logo — oder es kommt später.</span>';
        var anyOn = brandingProducts().some(function (o) { return A.addons[o.id] && A.addons[o.id].selected; });
        if (!anyOn) none.classList.add('is-on');
        none.addEventListener('click', function () { clearBranding(); renderBranding(); renderPriceBar(); });
        grid.appendChild(none);
        brandSec.appendChild(grid);
      }

      function renderSeo() {
        var SEO_LOCAL = ['gastro', 'handwerk', 'gesundheit', 'dienstleistung', 'immobilien', 'kreativ'];
        seoSec.innerHTML =
          '<p class="lb-cfg-foot" style="margin-top:0;margin-bottom:12px;">SEO-Betreuung — damit du bei Google und in der KI-Suche gefunden wirst. Standard: erstmal ohne, jederzeit später dazubuchbar.</p>';
        var grid = el('div', 'lb-pkgs');
        var empfohlen = (A.pfad === 'B' && SEO_LOCAL.indexOf(A.branche) > -1);
        (PRICING.addons || []).filter(function (a) { return a.group === 'seo-betreuung'; }).forEach(function (a) {
          var stufe = a.id.replace('seo-', '');
          var c = el('button', 'lb-pkg'); c.type = 'button';
          c.innerHTML =
            (empfohlen && stufe === 'lite' ? '<span class="lb-pkg-badge lb-pkg-badge-rec">Empfohlen</span>' : '') +
            '<span class="lb-pkg-name">' + a.short + '</span>' +
            '<span class="lb-pkg-price">' + a.price.toLocaleString('de-DE') + ' €/Mon.</span>' +
            '<span class="lb-pkg-scope">' + a.name + '</span>' +
            '<ul class="lb-perks"><li>' + a.desc + '</li></ul>';
          if (A.seo_stufe === stufe) c.classList.add('is-on');
          c.addEventListener('click', function () {
            A.seo_stufe = (A.seo_stufe === stufe) ? null : stufe;
            renderSeo(); renderPriceBar();
          });
          grid.appendChild(c);
        });
        var none = el('button', 'lb-pkg'); none.type = 'button';
        none.innerHTML =
          '<span class="lb-pkg-name">Erstmal ohne</span>' +
          '<span class="lb-pkg-price">0 €</span>' +
          '<span class="lb-pkg-scope">Kein laufender Beitrag — du kannst die SEO-Betreuung jederzeit später starten.</span>';
        if (!A.seo_stufe) none.classList.add('is-on');
        none.addEventListener('click', function () { A.seo_stufe = null; renderSeo(); renderPriceBar(); });
        grid.appendChild(none);
        seoSec.appendChild(grid);
      }

      /* -- Seiten: Inklusiv-Kontingent + Extraseiten (Variante A) -- */
      function renderPages() {
        var p = pkgById(A.paket_gewaehlt);
        var inc = p.includedPages || 0;
        var total = inc + (A.extraPages || 0);
        pageSec.innerHTML = '';
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
        var rec = (A.addonEmpfohlen || []).indexOf(a.id) > -1;
        var grund = rec && A.addonGrund ? (A.addonGrund[a.id] || '') : '';
        toggle.innerHTML =
          '<span class="lb-addon-check" aria-hidden="true"></span>' +
          '<span class="lb-addon-main">' +
            '<span class="lb-addon-name">' + a.name +
              (rec ? ' <span class="lb-pkg-badge lb-pkg-badge-rec" style="position:static;display:inline-block;vertical-align:middle;margin-left:6px;">Empfohlen</span>' : '') + '</span>' +
            '<span class="lb-addon-desc">' + (a.desc || '') + (grund ? ' · ' + grund : '') + '</span>' +
          '</span>' +
          '<span class="lb-addon-price">' + addonPriceText(a) + unit + '</span>';
        toggle.addEventListener('click', function () {
          st.selected = !st.selected;
          // Gruppen-Add-ons (z. B. Logo & Branding: Lite/Pro/Corporate) sind exklusiv:
          // beim Auswählen die Geschwister derselben Gruppe abwählen.
          if (st.selected && a.group) {
            PRICING.addons.forEach(function (o) {
              if (o.group === a.group && o.id !== a.id && A.addons[o.id]) A.addons[o.id].selected = false;
            });
          }
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
        addSec.innerHTML = '';
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
          '<span class="lb-recap-sums">Einmalig <strong>' + fmtEUR(t.once) + '</strong> · Monatlich <strong>' + fmtEUR(t.monthly) + '</strong> (Pflicht)' + (A.seo_stufe ? ' · + SEO-Betreuung ' + fmtEUR(seoProductFor(A.seo_stufe).price) + '/Mon.' : '') + '</span>';
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

    /* ---------- Abschluss (schlank: Bestätigung + 3 nächste Schritte) ---------- */
    done: { step: null, render: function () {
      var h = lumiSays('Danke, ' + (A.kontakt.name.split(' ')[0] || '') + '! Deine Anfrage ist raus.');

      var box = el('div', 'lb-done');
      box.innerHTML = '<p class="lb-done-status">' + (lastSendState.msg || '') + '</p>';
      stage.appendChild(box);

      var steps = el('ul', 'lb-done-steps');
      steps.innerHTML =
        '<li><strong>Wir prüfen deine Angaben</strong> und stellen dein persönliches Festpreis-Angebot zusammen.</li>' +
        '<li><strong>Du bekommst es i.&nbsp;d.&nbsp;R. innerhalb von 1 Werktag</strong> per E-Mail — schriftlich und unverbindlich.</li>' +
        '<li><strong>Erst mit deiner Zusage</strong> geht es los. Vorher entsteht kein Vertrag.</li>';
      stage.appendChild(steps);

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
    var u = A.umfang, f = A.features || [], s = A.seiten || [];
    var has = function (v) { return f.indexOf(v) > -1; };
    // Sonderprojekte-Treiber: sehr großer Umfang ODER Shop/Login (kein öffentlicher Festpreis)
    if (u === 'gross' || has('shop') || has('login')) return 'enterprise';
    // Basis-Empfehlung nach Umfang: One-Pager→Start, Groß→Platzhirsch, sonst Wachstum
    var base = u === 'onepager' ? 'basis' : (u === 'umfangreich' ? 'platin' : 'pro');
    // Paketgebundene Funktionen heben auf Platzhirsch an (Neuigkeiten/Blog, Newsletter, Karriere-Seite)
    var order = ['basis', 'pro', 'platin'];
    var bump = (has('blog') || has('newsletter') || s.indexOf('karriere') > -1) ? 'platin' : base;
    return order.indexOf(bump) > order.indexOf(base) ? bump : base;
  }
  // Begründungs-Halbsatz, falls die Empfehlung durch Funktionen angehoben wurde (für die Kontakt-Übersicht, E2)
  function recommendReason() {
    var f = A.features || [], s = A.seiten || [];
    var why = [];
    if (f.indexOf('blog') > -1) why.push('Neuigkeiten-Bereich');
    if (f.indexOf('newsletter') > -1) why.push('Newsletter');
    if (s.indexOf('karriere') > -1) why.push('Karriere-Seite');
    return why.length ? why.join(' + ') : '';
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
      seo_stufe: A.seo_stufe, // E2: null|'lite'|'pro'|'premium' (additiv)
      createdAt: new Date().toISOString(),
      briefing: A.pfad === 'B' ? {
        branche: A.branche, branche_sonstiges: A.branche_sonstiges,
        ziele: A.ziele, umfang: A.umfang, seiten: A.seiten, seiten_sonstige: A.seiten_sonstige,
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
        seo_stufe: A.seo_stufe,
        seo_monatlich: A.seo_stufe ? seoProductFor(A.seo_stufe).price : 0,
        stil: A.stil, hauptfarbe: A.hauptfarbe, nebenfarbe: A.nebenfarbe, markenfarben_hex: A.markenfarben_hex,
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
    A.ziele = []; A.umfang = null; A.seiten = []; A.seiten_sonstige = '';
    A.features = []; A.stil = null; A.hauptfarbe = null; A.nebenfarbe = null; A.markenfarben_hex = '';
    A.material = []; A.uploads = { logo: [], fotos: [], texte: [], texte_notiz: '', website_link: '' };
    A.zeitrahmen = null;
    A.paket_gewaehlt = null; A.paket_empfohlen = null;
    A.wartung = null; A.extraPages = 0; A.addons = {}; A.addonEmpfohlen = []; A.addonGrund = {}; A.seo_stufe = null; A._prefilled = false; A._recShown = false;
    A.enterprise = { sonderfunktionen: [], seitenzahl: null, shopGroesse: null, sprachen: '', schnittstellen: '', zeithorizont: null, notiz: '' };
    A.kontakt = { name: '', email: '', telefon: '', dsgvo: false };
    ui.askedClarification = false; lastSendState.msg = '';
    history = []; showPriceBar(false);
    renderScreen('welcome');
  }

  /* ============================================================
     START
     ============================================================ */
  // Direkteinstieg aus der Preise-Seite: „Ich weiß, was ich will" → direkt zur
  // Zusammenfassung mit vorausgewähltem Paket. Akzeptiert technische IDs
  // (basis|pro|platin|enterprise) UND die sichtbaren Namen
  // (start|wachstum|platzhirsch|sonderprojekte). Sonderprojekte → strukturierte
  // Anfrage (Enterprise-Fragen) → Kontakt, da kein öffentlicher Fixpreis.
  function startFromUrl() {
    try {
      var params = new URLSearchParams(window.location.search);
      var raw = (params.get('paket') || '').toLowerCase().trim();
      if (!raw) return false;
      var alias = { start: 'basis', wachstum: 'pro', platzhirsch: 'platin', sonderprojekte: 'enterprise', sonderprojekt: 'enterprise' };
      var p = alias[raw] || raw;
      var valid = PRICING.packages.some(function (x) { return x.id === p; });
      if (!valid) return false;
      A.pfad = 'A';
      A.paket_gewaehlt = p;
      A._recShown = true;          // kein Tipp-Indikator beim Direkteinstieg
      history = ['intent'];        // „Zurück" führt zur Einstiegs-Weiche, nicht ins Nichts
      renderScreen('zusammenfassung');
      return true;
    } catch (e) { return false; }
  }

  if (!startFromUrl()) renderScreen('welcome');
})();
