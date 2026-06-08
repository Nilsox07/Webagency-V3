/* ============================================================
   Sartu · Lumi — Geführter Klick-Flow (STUFE 1: Erst-Briefing)
   ------------------------------------------------------------
   Lumi ist KEIN frei chattender Bot, sondern ein geführtes Formular
   im Chat-Look ("conversational form") mit fester Frageliste.

   • Klick-Antworten gelten als eindeutig → KEIN LLM-Call, direkt weiter.
   • Die KI fragt im ganzen Flow max. 1x nach: nur wenn das optionale
     Freitextfeld bei Branche "Sonstiges" leer/unklar ist.
   • Jede Frage hat eine "Überspringen / Weiß nicht"-Option.
   • Genau EIN optionaler LLM-Call ganz am Ende (siehe requestBriefingFromLLM).
   • Läuft komplett ohne LLM und ohne Backend (Demo-Fallback).

   Stufe 2 (Detail-Onboarding nach Buchung) ist bewusst getrennt:
   siehe onboarding-stage2.js
   ============================================================ */
(function () {
  'use strict';

  const SCHEMA = window.SARTU_BRIEFING_SCHEMA;
  const stage = document.getElementById('lumiStage');
  if (!SCHEMA || !stage) return;

  const OPT = SCHEMA.options;
  const PAKETE = SCHEMA.pakete;
  const REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ============================================================
     KONFIGURATION — später aktivieren (alles in [KLAMMERN] = Platzhalter)
     ============================================================ */
  const CONFIG = {
    useLLM: false,                                  // → true setzen, um den EINEN LLM-Call am Ende zu aktivieren
    llmEndpoint: '[LLM_BRIEFING_ENDPOINT]',         // serverless Function, die Claude mit Structured Output aufruft
    formEndpoint: '[FORMSPREE_ODER_RESEND_ENDPOINT]',// E-Mail-Versand des Briefings
    supabaseUrl: '[SUPABASE_URL]',
    supabaseKey: '[SUPABASE_ANON_KEY]',
    notifyEmail: '[SARTU-EMAIL]',
    datenschutzUrl: 'datenschutz.html',
  };
  const isPlaceholder = (v) => !v || /^\[.*\]$/.test(v);

  /* ============================================================
     ZUSTAND — alle Antworten an EINER Stelle. Bleiben bei Zurück-
     Navigation und beim Korrigieren erhalten.
     ============================================================ */
  const A = {
    branche: null, branche_sonstiges: '',
    ziele: [], umfang: null, seiten: [],
    features: [], stil: [], farbwelt: [], markenfarben_hex: '',
    material: [], uploads: { logo: [], fotos: [], texte: [], texte_notiz: '', website_link: '' },
    zeitrahmen: null, paket_empfohlen: null, paket_gewaehlt: null,
    kontakt: { name: '', email: '', telefon: '', dsgvo: false },
  };
  const ui = { index: 0, askedClarification: false }; // harte Obergrenze: max. 1 Rückfrage

  /* ============================================================
     KLEINE DOM-HELFER
     ============================================================ */
  function el(tag, cls, html) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function clearStage() { stage.textContent = ''; }

  // Lumi-Sprechblase mit Frage (h2 für Screenreader/Struktur)
  function lumiSays(question, hint) {
    const row = el('div', 'lb-say');
    row.appendChild(el('span', 'lb-avatar', 'L'));
    const bubble = el('div', 'lb-bubble');
    const h = el('h2', 'lb-q');
    h.setAttribute('tabindex', '-1');
    h.textContent = question;
    bubble.appendChild(h);
    if (hint) bubble.appendChild(el('p', 'lb-hint', hint));
    row.appendChild(bubble);
    stage.appendChild(row);
    return h; // zum Fokussieren
  }
  // kleinere Zwischen-/Folgefrage (kein eigener Schritt)
  function subQuestion(text) {
    const p = el('p', 'lb-subq', text);
    stage.appendChild(p);
    return p;
  }

  // Aktions-Leiste: Zurück (links) · Überspringen + Weiter (rechts)
  function actions(opts) {
    opts = opts || {};
    const row = el('div', 'lb-actions');
    if (opts.onBack) {
      const b = el('button', 'lb-back', '‹ Zurück');
      b.type = 'button';
      b.addEventListener('click', opts.onBack);
      row.appendChild(b);
    }
    const right = el('div', 'lb-actions-right');
    if (opts.skip) {
      const s = el('button', 'lb-skip', opts.skipLabel || 'Überspringen');
      s.type = 'button';
      s.addEventListener('click', opts.skip);
      right.appendChild(s);
    }
    if (opts.onNext) {
      const n = el('button', 'btn btn-primary lb-next');
      n.type = 'button';
      n.textContent = opts.nextLabel || 'Weiter';
      n.addEventListener('click', opts.onNext);
      right.appendChild(n);
    }
    row.appendChild(right);
    stage.appendChild(row);
    return row;
  }

  /* ---- Multi-Select Chips (mit optionaler Exklusiv-Logik) ---- */
  function buildChips(slot, options, conf) {
    conf = conf || {};
    const exclusive = conf.exclusive || [];
    if (!Array.isArray(A[slot])) A[slot] = [];
    const wrap = el('div', 'lb-chips');
    const btns = {};
    options.forEach((opt) => {
      const b = el('button', 'lb-chip');
      b.type = 'button';
      b.textContent = opt.label;
      const on = A[slot].indexOf(opt.value) > -1;
      if (on) b.classList.add('is-on');
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.addEventListener('click', () => {
        let arr = A[slot].slice();
        const has = arr.indexOf(opt.value) > -1;
        if (has) {
          arr = arr.filter((v) => v !== opt.value);
        } else if (exclusive.indexOf(opt.value) > -1) {
          arr = [opt.value];                                   // Exklusiv-Option leert den Rest
        } else {
          arr = arr.filter((v) => exclusive.indexOf(v) === -1); // normale Auswahl entfernt Exklusiv-Optionen
          arr.push(opt.value);
        }
        A[slot] = arr;
        options.forEach((o) => {
          const bb = btns[o.value];
          const sel = arr.indexOf(o.value) > -1;
          bb.classList.toggle('is-on', sel);
          bb.setAttribute('aria-pressed', sel ? 'true' : 'false');
        });
        if (conf.onChange) conf.onChange(arr);
      });
      btns[opt.value] = b;
      wrap.appendChild(b);
    });
    stage.appendChild(wrap);
    return wrap;
  }

  /* ---- Single-Choice Karten ---- */
  function buildCards(slot, options, conf) {
    conf = conf || {};
    const wrap = el('div', conf.cls || 'lb-cards');
    const btns = {};
    options.forEach((opt) => {
      const b = el('button', 'lb-card');
      b.type = 'button';
      let inner = '';
      if (opt.icon) inner += '<span class="lb-card-icon" aria-hidden="true">' + opt.icon + '</span>';
      inner += '<span class="lb-card-label">' + opt.label + '</span>';
      if (opt.sub) inner += '<span class="lb-card-sub">' + opt.sub + '</span>';
      b.innerHTML = inner;
      if (A[slot] === opt.value) b.classList.add('is-on');
      b.addEventListener('click', () => {
        A[slot] = opt.value;
        Object.keys(btns).forEach((k) => btns[k].classList.toggle('is-on', k === opt.value));
        if (conf.onPick) conf.onPick(opt.value);
      });
      btns[opt.value] = b;
      wrap.appendChild(b);
    });
    stage.appendChild(wrap);
    return wrap;
  }

  /* ============================================================
     NAVIGATION / FORTSCHRITT
     ============================================================ */
  const progressWrap = document.getElementById('lumiProgress');
  const progressLabel = document.getElementById('lumiProgressLabel');
  const progressFill = document.getElementById('lumiProgressFill');

  function updateProgress(step) {
    // Fortschritt ERST AB SCHRITT 2 sichtbar (Schritt 1 & Intro/Abschluss: aus)
    if (step && step >= 2) {
      progressWrap.hidden = false;
      progressLabel.textContent = 'Schritt ' + step + ' von ' + SCHEMA.totalSteps;
      progressFill.style.width = Math.round((step / SCHEMA.totalSteps) * 100) + '%';
    } else {
      progressWrap.hidden = true;
    }
  }

  function show(i) {
    ui.index = Math.max(0, Math.min(screens.length - 1, i));
    const sc = screens[ui.index];
    updateProgress(sc.step);
    clearStage();
    const focusTarget = sc.render();
    // Sanftes Heranscrollen + Fokus auf die Frage (außer Intro)
    if (ui.index > 0) {
      const card = document.querySelector('.lumi-card');
      if (card) card.scrollIntoView({ block: 'start', behavior: REDUCE ? 'auto' : 'smooth' });
    }
    if (focusTarget && focusTarget.focus) {
      try { focusTarget.focus({ preventScroll: true }); } catch (e) { focusTarget.focus(); }
    }
  }
  const next = () => show(ui.index + 1);
  const back = () => show(ui.index - 1);
  function goToScreen(i) { show(i); }

  /* ============================================================
     SCREEN-DEFINITIONEN (Reihenfolge = Flow)
     step: Nummer für die Fortschrittsanzeige (null = kein Schritt)
     ============================================================ */
  const screens = [
    /* ---------- 0 · Willkommen (kein Fortschritt) ---------- */
    { name: 'welcome', step: null, render: function () {
      const h = lumiSays(
        'Hi, ich bin Lumi 👋',
        'In ~2 Minuten und nur mit Klicken erstelle ich dein Website-Briefing. Kein Tippzwang, jederzeit „Zurück“ möglich.'
      );
      const wrap = el('div', 'lb-welcome');
      const btn = el('button', 'btn btn-primary btn-lg lb-start');
      btn.type = 'button';
      btn.innerHTML = 'Los geht’s <span class="arrow" aria-hidden="true">→</span>';
      btn.addEventListener('click', next);
      wrap.appendChild(btn);
      stage.appendChild(wrap);
      return h;
    }},

    /* ---------- 1 · Branche (Single-Kacheln, KEIN Fortschrittsbalken) ---------- */
    { name: 'branche', step: 1, render: function () {
      const h = lumiSays('In welcher Branche bist du tätig?');
      const sonst = el('div', 'lb-inline');

      function renderSonst() {
        sonst.textContent = '';
        if (A.branche === 'sonstiges') {
          const lbl = el('label', 'lb-field');
          lbl.innerHTML = '<span class="lb-field-label">Was bietest du an? <em>(optional)</em></span>';
          const inp = el('input');
          inp.type = 'text';
          inp.placeholder = 'z. B. „mobiler Friseur für Senioren“';
          inp.value = A.branche_sonstiges || '';
          inp.addEventListener('input', (e) => { A.branche_sonstiges = e.target.value; });
          lbl.appendChild(inp);
          sonst.appendChild(lbl);
        }
      }

      buildCards('branche', OPT.branche, { cls: 'lb-tiles', onPick: function (v) {
        renderSonst();
        if (v !== 'sonstiges') { next(); } // eindeutige Klick-Antwort → sofort weiter
      }});
      stage.appendChild(sonst);
      renderSonst();

      actions({
        onBack: back,
        onNext: function () { leaveBranche(); },
        skip: function () { A.branche = A.branche || null; next(); },
      });
      return h;
    }},

    /* ---------- 2 · Website-Ziel (Multi-Chips) ---------- */
    { name: 'ziele', step: 2, render: function () {
      const h = lumiSays('Was soll deine Website vor allem erreichen?', 'Mehrfachauswahl möglich.');
      buildChips('ziele', OPT.ziele);
      actions({ onBack: back, onNext: next, skip: next });
      return h;
    }},

    /* ---------- 3 · Umfang (Single-Karten) + bedingte Folgefrage „Seiten“ ---------- */
    { name: 'umfang', step: 3, render: function () {
      const h = lumiSays('Wie groß soll deine Website werden?');
      const sub = el('div', 'lb-inline');

      function renderSub() {
        sub.textContent = '';
        // Folgefrage nur, wenn NICHT One-Pager (und etwas gewählt wurde)
        if (A.umfang && A.umfang !== 'onepager') {
          const q = el('p', 'lb-subq', 'Welche Seiten brauchst du? <span class="lb-opt">(optional)</span>');
          sub.appendChild(q);
          const chips = buildChipsInto(sub, 'seiten', OPT.seiten, { exclusive: ['unsure'] });
          void chips;
        }
      }

      buildCards('umfang', OPT.umfang, { onPick: renderSub });
      stage.appendChild(sub);
      renderSub();
      actions({ onBack: back, onNext: next, skip: next });
      return h;
    }},

    /* ---------- 4 · Features / Funktionen (Multi-Chips) ---------- */
    { name: 'features', step: 4, render: function () {
      const h = lumiSays('Welche Funktionen brauchst du?', 'Mehrfachauswahl möglich.');
      buildChips('features', OPT.features, { exclusive: ['beraten'] });
      actions({ onBack: back, onNext: next, skip: next });
      return h;
    }},

    /* ---------- 5 · Design: Stil + Farbwelt + optional HEX ---------- */
    { name: 'design', step: 5, render: function () {
      const h = lumiSays('Welcher Look gefällt dir?', 'Mehrfachauswahl möglich — Lumi nutzt das als Richtung.');
      // Teil A — Stil-Moodboards (reine CSS-Grafik, lizenzfrei)
      const moods = el('div', 'lb-moods');
      const mbtns = {};
      OPT.stil.forEach((opt) => {
        const b = el('button', 'lb-mood');
        b.type = 'button';
        b.innerHTML =
          '<span class="lb-mood-art ' + opt.flavor + '" aria-hidden="true">' +
            '<span class="m1"></span><span class="m2"></span><span class="m3"></span>' +
          '</span><span class="lb-mood-label">' + opt.label + '</span>';
        if (A.stil.indexOf(opt.value) > -1) b.classList.add('is-on');
        b.setAttribute('aria-pressed', A.stil.indexOf(opt.value) > -1 ? 'true' : 'false');
        b.addEventListener('click', () => {
          const i = A.stil.indexOf(opt.value);
          if (i > -1) A.stil.splice(i, 1); else A.stil.push(opt.value);
          const sel = A.stil.indexOf(opt.value) > -1;
          b.classList.toggle('is-on', sel);
          b.setAttribute('aria-pressed', sel ? 'true' : 'false');
        });
        mbtns[opt.value] = b;
        moods.appendChild(b);
      });
      stage.appendChild(moods);

      // Teil B — Farbwelt (sichtbare Farbkacheln, KEIN HEX-Zwang)
      subQuestion('Welche Farbstimmung passt zu dir?');
      const sw = el('div', 'lb-swatches');
      OPT.farbwelt.forEach((opt) => {
        const b = el('button', 'lb-swatch');
        b.type = 'button';
        const dots = opt.dots.map((c) => '<span style="background:' + c + '"></span>').join('');
        b.innerHTML = '<span class="lb-swatch-dots" aria-hidden="true">' + dots + '</span><small>' + opt.label + '</small>';
        if (A.farbwelt.indexOf(opt.value) > -1) b.classList.add('is-on');
        b.setAttribute('aria-pressed', A.farbwelt.indexOf(opt.value) > -1 ? 'true' : 'false');
        b.addEventListener('click', () => {
          const i = A.farbwelt.indexOf(opt.value);
          if (i > -1) A.farbwelt.splice(i, 1); else A.farbwelt.push(opt.value);
          const sel = A.farbwelt.indexOf(opt.value) > -1;
          b.classList.toggle('is-on', sel);
          b.setAttribute('aria-pressed', sel ? 'true' : 'false');
        });
        sw.appendChild(b);
      });
      stage.appendChild(sw);

      // Teil C — optionales HEX-Feld (kein Pflichtfeld, kein Color-Picker)
      const lbl = el('label', 'lb-field lb-field-optional');
      lbl.innerHTML = '<span class="lb-field-label">Feste Markenfarben? <em>(HEX-Code, falls bekannt — sonst überspringen)</em></span>';
      const inp = el('input');
      inp.type = 'text';
      inp.placeholder = 'z. B. #1B3A8F';
      inp.value = A.markenfarben_hex || '';
      inp.addEventListener('input', (e) => { A.markenfarben_hex = e.target.value; });
      lbl.appendChild(inp);
      stage.appendChild(lbl);

      actions({ onBack: back, onNext: next, skip: next });
      return h;
    }},

    /* ---------- 6 · Vorhandenes Material (Multi-Chips + bedingte Uploads) ---------- */
    { name: 'material', step: 6, render: function () {
      const h = lumiSays('Was hast du schon?', 'Uploads sind optional — du kannst alles auch später nachreichen.');
      const uploads = el('div', 'lb-inline');

      function renderUploads() {
        uploads.textContent = '';
        const m = A.material;
        if (m.indexOf('logo') > -1) uploads.appendChild(fileField('Logo hochladen', 'logo', { hint: 'Kann ich auch später nachreichen.' }));
        if (m.indexOf('fotos') > -1) uploads.appendChild(fileField('Bilder hochladen', 'fotos', { multiple: true }));
        if (m.indexOf('texte') > -1) {
          uploads.appendChild(fileField('Texte hochladen', 'texte', {}));
          const note = el('label', 'lb-field');
          note.innerHTML = '<span class="lb-field-label">Notizen zu den Texten <em>(optional)</em></span>';
          const ta = el('textarea');
          ta.rows = 2;
          ta.placeholder = 'z. B. „Texte sind grob, bitte überarbeiten“';
          ta.value = A.uploads.texte_notiz || '';
          ta.addEventListener('input', (e) => { A.uploads.texte_notiz = e.target.value; });
          note.appendChild(ta);
          uploads.appendChild(note);
        }
        if (m.indexOf('website') > -1) {
          const wl = el('label', 'lb-field');
          wl.innerHTML = '<span class="lb-field-label">Link zur aktuellen Website</span>';
          const inp = el('input');
          inp.type = 'url';
          inp.placeholder = 'https://…';
          inp.value = A.uploads.website_link || '';
          inp.addEventListener('input', (e) => { A.uploads.website_link = e.target.value; });
          wl.appendChild(inp);
          uploads.appendChild(wl);
        }
      }

      buildChips('material', OPT.material, { exclusive: ['nichts'], onChange: renderUploads });
      stage.appendChild(uploads);
      renderUploads();
      actions({ onBack: back, onNext: next, skip: next });
      return h;
    }},

    /* ---------- 7 · Zeitrahmen (Single-Buttons → sofort weiter) ---------- */
    { name: 'zeitrahmen', step: 7, render: function () {
      const h = lumiSays('Bis wann brauchst du die Website?');
      buildCards('zeitrahmen', OPT.zeitrahmen, { cls: 'lb-cards lb-cards-wide', onPick: function () { next(); } });
      actions({ onBack: back, skip: next });
      return h;
    }},

    /* ---------- 8a · Paketempfehlung (Ergebnis-Screen) ---------- */
    { name: 'paket', step: 8, render: function () {
      const recId = recommend();
      A.paket_empfohlen = recId;
      if (!A.paket_gewaehlt) A.paket_gewaehlt = recId;

      const h = lumiSays(
        'Auf Basis deiner Angaben passt „' + PAKETE[recId].name + '“ am besten.',
        'Unverbindliche Empfehlung — Festpreis, alle Preise netto.'
      );

      // Empfohlenes Paket + die zwei nächstliegenden anzeigen
      const order = ['basis', 'pro', 'platin', 'enterprise'];
      const idx = order.indexOf(recId);
      const showIds = [recId];
      [idx - 1, idx + 1, idx - 2, idx + 2].forEach((i) => {
        if (i >= 0 && i < order.length && showIds.length < 3 && showIds.indexOf(order[i]) === -1) showIds.push(order[i]);
      });
      showIds.sort((a, b) => order.indexOf(a) - order.indexOf(b));

      const grid = el('div', 'lb-pakete');
      const cards = {};
      showIds.forEach((id) => {
        const p = PAKETE[id];
        const c = el('button', 'lb-paket');
        c.type = 'button';
        c.innerHTML =
          (id === recId ? '<span class="lb-paket-badge">Empfohlen</span>' : '') +
          '<span class="lb-paket-name">' + p.name + '</span>' +
          '<span class="lb-paket-price">' + p.preis + '</span>' +
          '<span class="lb-paket-note">' + p.note + '</span>';
        if (A.paket_gewaehlt === id) c.classList.add('is-on');
        c.addEventListener('click', () => {
          A.paket_gewaehlt = id;
          Object.keys(cards).forEach((k) => cards[k].classList.toggle('is-on', k === id));
          unsureBtn.classList.remove('is-on');
        });
        cards[id] = c;
        grid.appendChild(c);
      });
      stage.appendChild(grid);

      // „Unsicher?“ — Entscheidung später mit Sartu
      const unsureBtn = el('button', 'lb-unsure');
      unsureBtn.type = 'button';
      unsureBtn.textContent = 'Unsicher? Sartu entscheidet das später mit dir.';
      if (A.paket_gewaehlt === 'unsicher') unsureBtn.classList.add('is-on');
      unsureBtn.addEventListener('click', () => {
        A.paket_gewaehlt = 'unsicher';
        Object.keys(cards).forEach((k) => cards[k].classList.remove('is-on'));
        unsureBtn.classList.add('is-on');
      });
      stage.appendChild(unsureBtn);

      stage.appendChild(el('p', 'lb-paket-hint', SCHEMA.wartungHinweis + ' · Festpreis, unverbindlich.'));

      actions({ onBack: back, onNext: next, nextLabel: 'Weiter zu den Kontaktdaten' });
      return h;
    }},

    /* ---------- 8b · Kontaktdaten (Abschluss-Eingabe) ---------- */
    { name: 'kontakt', step: 8, render: function () {
      const h = lumiSays('Wohin darf Sartu dein fertiges Briefing + Angebot schicken?');
      const form = el('form', 'lb-form');
      form.setAttribute('novalidate', 'novalidate');
      form.innerHTML =
        '<label class="lb-field"><span class="lb-field-label">Name <em>*</em></span>' +
          '<input type="text" name="name" autocomplete="name" required /></label>' +
        '<label class="lb-field"><span class="lb-field-label">E-Mail <em>*</em></span>' +
          '<input type="email" name="email" autocomplete="email" required /></label>' +
        '<label class="lb-field"><span class="lb-field-label">Telefon <em>(optional)</em></span>' +
          '<input type="tel" name="telefon" autocomplete="tel" /></label>' +
        '<label class="lb-check"><input type="checkbox" name="dsgvo" required />' +
          '<span>Ich habe die <a href="' + CONFIG.datenschutzUrl + '" target="_blank" rel="noopener">Datenschutzerklärung</a> ' +
          'gelesen und bin mit der Verarbeitung meiner Angaben einverstanden. <em>*</em></span></label>' +
        '<p class="lb-form-error" id="lbFormError" role="alert" hidden></p>';

      // Vorbelegen (Zurück-Navigation)
      form.name.value = A.kontakt.name || '';
      form.email.value = A.kontakt.email || '';
      form.telefon.value = A.kontakt.telefon || '';
      form.dsgvo.checked = !!A.kontakt.dsgvo;

      const sync = () => {
        A.kontakt.name = form.name.value.trim();
        A.kontakt.email = form.email.value.trim();
        A.kontakt.telefon = form.telefon.value.trim();
        A.kontakt.dsgvo = form.dsgvo.checked;
      };
      ['input', 'change'].forEach((ev) => form.addEventListener(ev, sync));

      const err = form.querySelector('#lbFormError');
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        sync();
        const problems = [];
        if (!A.kontakt.name) problems.push('Bitte gib deinen Namen an.');
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(A.kontakt.email)) problems.push('Bitte gib eine gültige E-Mail an.');
        if (!A.kontakt.dsgvo) problems.push('Bitte bestätige die Datenschutzerklärung.');
        if (problems.length) {
          err.hidden = false;
          err.textContent = problems[0];
          return;
        }
        err.hidden = true;
        submitBriefing();
      });

      stage.appendChild(form);
      actions({
        onBack: back,
        onNext: function () { if (form.requestSubmit) form.requestSubmit(); else form.dispatchEvent(new Event('submit', { cancelable: true })); },
        nextLabel: 'Briefing absenden',
      });
      return h;
    }},

    /* ---------- 9 · Abschluss (Zusammenfassung + Bestätigung) ---------- */
    { name: 'done', step: null, render: function () {
      const h = lumiSays('Danke, ' + (A.kontakt.name.split(' ')[0] || '') + '! Das habe ich verstanden:');
      // Read-back, jede Zeile per Klick korrigierbar (springt zurück, Daten bleiben)
      const list = el('div', 'lb-summary');
      summaryRows().forEach((r) => {
        const row = el('div', 'lb-summary-row');
        row.innerHTML = '<span class="k">' + r.k + '</span><span class="v"></span>';
        row.querySelector('.v').textContent = r.v || '—';
        const edit = el('button', 'lb-edit', 'ändern');
        edit.type = 'button';
        edit.setAttribute('aria-label', r.k + ' ändern');
        edit.addEventListener('click', () => goToScreen(r.screen));
        row.appendChild(edit);
        list.appendChild(row);
      });
      stage.appendChild(list);

      const box = el('div', 'lb-done');
      box.innerHTML =
        '<p class="lb-done-status" id="lbSendStatus">' + (lastSendState.msg || '') + '</p>' +
        '<p class="lb-done-msg">Sartu meldet sich in der Regel innerhalb von <strong>1 Werktag</strong> mit deinem Angebot.</p>';
      stage.appendChild(box);

      const restart = el('button', 'lb-restart', 'Neues Briefing starten');
      restart.type = 'button';
      restart.addEventListener('click', resetAll);
      stage.appendChild(restart);
      return h;
    }},
  ];

  // Hilfsfunktion: Chips in einen bestimmten Container rendern (statt direkt in stage)
  function buildChipsInto(container, slot, options, conf) {
    const before = stage.childNodes.length;
    const wrap = buildChips(slot, options, conf);
    stage.removeChild(wrap);          // buildChips hängt an stage an → hier umhängen
    container.appendChild(wrap);
    void before;
    return wrap;
  }

  // Upload-Feld (optional, nie blockierend) — speichert nur Metadaten in der Demo
  function fileField(labelText, key, conf) {
    conf = conf || {};
    const lbl = el('label', 'lb-field lb-upload');
    let head = '<span class="lb-field-label">' + labelText + ' <em>(optional)</em></span>';
    if (conf.hint) head += '<span class="lb-upload-hint">' + conf.hint + '</span>';
    lbl.innerHTML = head;
    const inp = el('input');
    inp.type = 'file';
    if (conf.multiple) inp.multiple = true;
    const chosen = el('span', 'lb-upload-files');
    const existing = A.uploads[key] || [];
    if (existing.length) chosen.textContent = existing.map((f) => f.name).join(', ');
    inp.addEventListener('change', (e) => {
      A.uploads[key] = Array.prototype.map.call(e.target.files, (f) => ({ name: f.name, size: f.size, type: f.type }));
      chosen.textContent = A.uploads[key].map((f) => f.name).join(', ');
      // Hinweis: echte Datei-Uploads erfolgen serverseitig (Supabase Storage) — siehe persist()
    });
    lbl.appendChild(inp);
    lbl.appendChild(chosen);
    return lbl;
  }

  /* ============================================================
     EINZIGE ERLAUBTE RÜCKFRAGE (max. 1 im ganzen Flow)
     Nur wenn Branche = "Sonstiges" UND Freitext leer/zu kurz.
     ============================================================ */
  function leaveBranche() {
    const txt = (A.branche_sonstiges || '').trim();
    const unklar = A.branche === 'sonstiges' && txt.length < 3;
    if (unklar && !ui.askedClarification) {
      ui.askedClarification = true; // harte Obergrenze
      clearStage();
      const h = lumiSays('Magst du kurz sagen, was du anbietest?', 'Zwei, drei Worte reichen — das hilft mir bei der Empfehlung. (Kannst du auch überspringen.)');
      const lbl = el('label', 'lb-field');
      lbl.innerHTML = '<span class="lb-field-label">Deine Tätigkeit</span>';
      const inp = el('input');
      inp.type = 'text';
      inp.placeholder = 'z. B. „mobiler Friseur“';
      inp.value = A.branche_sonstiges || '';
      inp.addEventListener('input', (e) => { A.branche_sonstiges = e.target.value; });
      lbl.appendChild(inp);
      stage.appendChild(lbl);
      actions({ onBack: back, onNext: next, skip: next, nextLabel: 'Weiter' });
      if (h && h.focus) h.focus();
      return;
    }
    next();
  }

  /* ============================================================
     PAKET-EMPFEHLUNG (Schritt 8a) — aus Umfang (3) + Features (4)
     ============================================================ */
  function recommend() {
    const u = A.umfang;
    const f = A.features || [];
    const has = (v) => f.indexOf(v) > -1;

    // Enterprise: Shop/Bezahlung, Mehrsprachig, Kundenbereich/Portal
    if (has('shop') || has('mehrsprachig') || has('login')) return 'enterprise';
    if (u === 'gross') return has('shop') ? 'enterprise' : 'platin';
    if (u === 'onepager') return 'basis';
    // Platin: umfangreich mit erweiterten Funktionen (Galerie, Buchung …)
    if (u === 'umfangreich' && (has('galerie') || has('terminbuchung'))) return 'platin';
    if (u === 'kompakt' || u === 'umfangreich') return 'pro';
    // Fallback (Umfang übersprungen): an Features orientieren
    if (has('galerie') || has('terminbuchung')) return 'platin';
    return 'pro';
  }

  /* ============================================================
     ZUSAMMENFASSUNG / READ-BACK
     ============================================================ */
  function labelsFor(slot, values) {
    const list = OPT[slot] || [];
    return (values || []).map((v) => {
      const o = list.find((x) => x.value === v);
      return o ? o.label : v;
    });
  }
  function labelFor(slot, value) {
    const o = (OPT[slot] || []).find((x) => x.value === value);
    return o ? o.label : (value || '');
  }
  function summaryRows() {
    const rows = [];
    let branche = labelFor('branche', A.branche);
    if (A.branche === 'sonstiges' && A.branche_sonstiges) branche += ' (' + A.branche_sonstiges + ')';
    rows.push({ k: 'Branche', v: branche, screen: 1 });
    rows.push({ k: 'Ziele', v: labelsFor('ziele', A.ziele).join(', '), screen: 2 });
    let umfang = labelFor('umfang', A.umfang);
    if (A.umfang && A.umfang !== 'onepager' && A.seiten.length) umfang += ' · ' + labelsFor('seiten', A.seiten).join(', ');
    rows.push({ k: 'Umfang', v: umfang, screen: 3 });
    rows.push({ k: 'Funktionen', v: labelsFor('features', A.features).join(', '), screen: 4 });
    let design = labelsFor('stil', A.stil).join(', ');
    if (A.farbwelt.length) design += (design ? ' · ' : '') + labelsFor('farbwelt', A.farbwelt).join(', ');
    if (A.markenfarben_hex) design += ' · ' + A.markenfarben_hex;
    rows.push({ k: 'Design', v: design, screen: 5 });
    const mat = labelsFor('material', A.material).join(', ');
    rows.push({ k: 'Material', v: mat, screen: 6 });
    rows.push({ k: 'Zeitrahmen', v: labelFor('zeitrahmen', A.zeitrahmen), screen: 7 });
    const pk = A.paket_gewaehlt === 'unsicher'
      ? 'Noch unsicher (mit Sartu klären)'
      : (PAKETE[A.paket_gewaehlt] ? PAKETE[A.paket_gewaehlt].name + ' · ' + PAKETE[A.paket_gewaehlt].preis : '');
    rows.push({ k: 'Paket', v: pk, screen: 8 });
    return rows;
  }

  /* ============================================================
     STRUKTURIERTE AUSGABE (für Speicherung + optionalen LLM-Call)
     ============================================================ */
  function collect() {
    return {
      schemaVersion: SCHEMA.version,
      stage: 1,
      createdAt: new Date().toISOString(),
      slots: {
        branche: A.branche,
        branche_label: labelFor('branche', A.branche),
        branche_sonstiges: A.branche_sonstiges,
        ziele: A.ziele, ziele_labels: labelsFor('ziele', A.ziele),
        umfang: A.umfang, umfang_label: labelFor('umfang', A.umfang),
        seiten: A.seiten, seiten_labels: labelsFor('seiten', A.seiten),
        features: A.features, features_labels: labelsFor('features', A.features),
        stil: A.stil, stil_labels: labelsFor('stil', A.stil),
        farbwelt: A.farbwelt, farbwelt_labels: labelsFor('farbwelt', A.farbwelt),
        markenfarben_hex: A.markenfarben_hex,
        material: A.material, material_labels: labelsFor('material', A.material),
        uploads: A.uploads,
        zeitrahmen: A.zeitrahmen, zeitrahmen_label: labelFor('zeitrahmen', A.zeitrahmen),
        paket_empfohlen: A.paket_empfohlen,
        paket_gewaehlt: A.paket_gewaehlt,
        kontakt: A.kontakt,
      },
    };
  }

  /* ============================================================
     OPTIONAL: EIN einziger LLM-Call am Ende (später aktivieren)
     ------------------------------------------------------------
     Läuft NUR, wenn CONFIG.useLLM = true und ein Endpoint gesetzt ist.
     Der API-Key gehört NICHT in den Browser — CONFIG.llmEndpoint zeigt
     auf eine serverlose Function (z. B. Vercel), die Claude
     (empfohlen: claude-sonnet-4-6) per Structured Output / Tool-Use
     aufruft und EXAKT dieses JSON-Schema erzwingt:

       {
         "briefing_markdown": "string – lesbares Briefing fürs Sartu-Team",
         "paket_empfehlung": {
           "paket": "basis|pro|platin|enterprise",
           "begruendung": "string"
         },
         "zusammenfassung": "string"
       }
     ============================================================ */
  async function requestBriefingFromLLM(payload) {
    if (!CONFIG.useLLM || isPlaceholder(CONFIG.llmEndpoint)) return null;
    try {
      const r = await fetch(CONFIG.llmEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slots: payload.slots }),
      });
      if (!r.ok) throw new Error('LLM ' + r.status);
      return await r.json();
    } catch (e) {
      console.warn('[Lumi] LLM-Call übersprungen:', e.message);
      return null;
    }
  }

  /* ============================================================
     SPEICHERUNG / VERSAND
     Reihenfolge: Supabase → E-Mail-Endpoint → Demo-Fallback (localStorage)
     ============================================================ */
  async function persist(payload) {
    // 1) Supabase (Tabelle "briefings"), wenn konfiguriert
    if (!isPlaceholder(CONFIG.supabaseUrl) && !isPlaceholder(CONFIG.supabaseKey)) {
      const r = await fetch(CONFIG.supabaseUrl.replace(/\/$/, '') + '/rest/v1/briefings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: CONFIG.supabaseKey,
          Authorization: 'Bearer ' + CONFIG.supabaseKey,
          Prefer: 'return=minimal',
        },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error('Supabase ' + r.status);
      // Hinweis: echte Datei-Uploads → Supabase Storage (separat, hier TODO)
      return 'supabase';
    }
    // 2) E-Mail-Versand (Formspree / Resend-Proxy o. Ä.)
    if (!isPlaceholder(CONFIG.formEndpoint)) {
      const r = await fetch(CONFIG.formEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ to: CONFIG.notifyEmail, briefing: payload }),
      });
      if (!r.ok) throw new Error('Mail ' + r.status);
      return 'email';
    }
    // 3) Demo-Fallback: lokal speichern + in Konsole (nichts wird gesendet)
    try { localStorage.setItem('sartu_briefing_' + Date.now(), JSON.stringify(payload)); } catch (e) { /* ignore */ }
    console.info('[Lumi] Briefing (Demo – kein Versand konfiguriert):', payload);
    return 'demo';
  }

  const lastSendState = { msg: '' };

  async function submitBriefing() {
    // Sende-Zustand anzeigen
    clearStage();
    const h = lumiSays('Einen Moment — ich stelle dein Briefing zusammen …');
    const spinner = el('div', 'lb-sending');
    spinner.innerHTML = '<span class="lb-dot"></span><span class="lb-dot"></span><span class="lb-dot"></span>';
    stage.appendChild(spinner);
    if (h && h.focus) h.focus();

    const payload = collect();
    try {
      const ai = await requestBriefingFromLLM(payload); // null, wenn deaktiviert
      if (ai) payload.ai = ai;
      const via = await persist(payload);
      lastSendState.msg = via === 'demo'
        ? '✓ Briefing erstellt. (Demo-Modus: Versand noch nicht konfiguriert.)'
        : '✓ Dein Briefing ist bei Sartu angekommen.';
    } catch (e) {
      console.warn('[Lumi] Versand fehlgeschlagen:', e.message);
      lastSendState.msg = 'Hinweis: Der automatische Versand hat nicht geklappt — Sartu wird sich trotzdem kümmern.';
    }
    // Abschluss-Screen
    show(screens.findIndex((s) => s.name === 'done'));
  }

  /* ============================================================
     RESET
     ============================================================ */
  function resetAll() {
    A.branche = null; A.branche_sonstiges = '';
    A.ziele = []; A.umfang = null; A.seiten = [];
    A.features = []; A.stil = []; A.farbwelt = []; A.markenfarben_hex = '';
    A.material = []; A.uploads = { logo: [], fotos: [], texte: [], texte_notiz: '', website_link: '' };
    A.zeitrahmen = null; A.paket_empfohlen = null; A.paket_gewaehlt = null;
    A.kontakt = { name: '', email: '', telefon: '', dsgvo: false };
    ui.askedClarification = false;
    lastSendState.msg = '';
    show(0);
  }

  /* ============================================================
     START
     ============================================================ */
  show(0);
})();
