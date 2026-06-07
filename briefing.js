/* ============================================================
   Lumi — adaptiver Briefing-Assistent (clientseitige Demo)
   Kein Backend, kein LLM: simuliertes Slot-Filling-Gespräch
   mit adaptivem Nachfragen, visueller Stilauswahl und
   simulierter Sofort-Vorschau.
   ============================================================ */
(function () {
  const chat = document.getElementById('lumiChat');
  const inputZone = document.getElementById('lumiInput');
  const progressFill = document.getElementById('lumiProgressFill');
  const progressLabel = document.getElementById('lumiProgressLabel');
  if (!chat || !inputZone) return;

  const TOTAL = 7;          // Anzahl Hauptfragen (für Fortschritt)
  const answers = {};        // gesammelte Antworten
  let answered = 0;          // beantwortete Hauptfragen
  let queue = [];            // verbleibende Schritte

  /* ---------- Optionen ---------- */
  const ZIEL_OPTS = [
    { label: 'Mehr Anfragen gewinnen', value: 'anfragen' },
    { label: 'Termine & Buchungen', value: 'termine' },
    { label: 'Bekannter werden', value: 'image' },
    { label: 'Produkte zeigen & verkaufen', value: 'shop' },
  ];

  const STIL_OPTS = [
    { flavor: 'flv-clean',   title: 'Minimalistisch & Clean', sub: 'Viel Weißraum, klare Typo', value: 'clean' },
    { flavor: 'flv-bold',    title: 'Bold & Farbig',          sub: 'Starke Farben, große Aussagen', value: 'bold' },
    { flavor: 'flv-elegant', title: 'Elegant & Edel',         sub: 'Ruhig, hochwertig, premium', value: 'elegant' },
  ];

  const STIL_NOTES = {
    clean:   'Klare Sache — minimalistisch mit viel Luft. Das wirkt modern und vertrauenswürdig.',
    bold:    'Stark! Bold und farbig fällt sofort auf — perfekt, um aus der Masse zu stechen.',
    elegant: 'Edel und ruhig — das strahlt Hochwertigkeit aus. Sehr gute Wahl.',
  };

  const FARBE_OPTS = [
    { dots: ['#aef000', '#0d1320', '#ffffff'], label: 'Frisch & Grün',     value: 'gruen' },
    { dots: ['#1b3a8f', '#0b1426', '#ffffff'], label: 'Seriös & Blau',     value: 'blau' },
    { dots: ['#b9824a', '#2e2419', '#f4ece0'], label: 'Warm & Erdig',      value: 'erdig' },
    { dots: ['#0a0f1c', '#16243f', '#aef000'], label: 'Elegant & Dunkel',  value: 'dunkel' },
    { dots: ['#ff5a8a', '#ffb020', '#5ad1ff'], label: 'Bunt & Verspielt',  value: 'bunt' },
  ];

  const UMFANG_OPTS = [
    { label: 'Onepager', value: 'onepager' },
    { label: 'Bis 8 Seiten', value: '8' },
    { label: 'Bis 20 Seiten', value: '20' },
    { label: 'Weiß ich noch nicht', value: 'unsure' },
  ];

  const PAKET = {
    onepager: { name: 'Basis', preis: '1.290 €' },
    '8':      { name: 'Pro', preis: '2.990 €' },
    '20':     { name: 'Platin', preis: '5.990 €' },
    unsure:   { name: 'Pro', preis: '2.990 €' },
  };

  /* ---------- Gesprächsfluss ---------- */
  function buildFlow() {
    return [
      {
        type: 'text', key: 'branche',
        bot: 'Hi, ich bin Lumi 👋 Ich helfe dir, dein Website-Projekt in 2 Minuten zu briefen. Lass uns starten: Was machst du, und für wen?',
        placeholder: 'z. B. „Ich bin Malermeister und arbeite für Privatkunden…"',
        adapt: function (val) {
          if (val.trim().split(/\s+/).length < 4) {
            return [{
              type: 'text', key: 'branche_detail', counts: false,
              bot: 'Klingt gut! Erzähl mir in einem Satz, was dich besonders macht — das hilft mir beim Stil.',
              placeholder: 'z. B. „Wir sind die schnellsten in der Region…"',
            }];
          }
          return null;
        },
      },
      {
        type: 'chips', key: 'ziel', options: ZIEL_OPTS,
        bot: 'Verstanden! Was soll deine neue Website vor allem erreichen?',
        adapt: function (val) {
          if (val === 'shop') {
            return [{
              type: 'note',
              bot: 'Kleiner Hinweis: Reine Onlineshops sind nicht mein Schwerpunkt — aber Produkte ansprechend zeigen und per Formular anfragen lassen, das geht hervorragend. Machen wir so!',
            }];
          }
          return null;
        },
      },
      {
        type: 'styles', key: 'stil', options: STIL_OPTS,
        bot: 'Jetzt wird’s visuell. Welche Design-Richtung spricht dich am meisten an?',
        adapt: function (val) {
          return [{ type: 'note', bot: STIL_NOTES[val] || 'Notiert!' }];
        },
      },
      {
        type: 'swatches', key: 'farbe', options: FARBE_OPTS,
        bot: 'Und welche Farbwelt passt zu deiner Marke?',
      },
      {
        type: 'text', key: 'website',
        bot: 'Hast du schon eine Website oder eine Social-Media-Seite? Füg den Link ein — oder schreib einfach „keine".',
        placeholder: 'z. B. www.meine-seite.de oder „keine"',
        adapt: function (val) {
          const domain = extractDomain(val);
          if (domain) {
            return [
              { type: 'note', bot: 'Super, danke! Einen Moment, ich schau sie mir kurz an …' },
              { type: 'note', longer: true,
                bot: 'Ich habe ' + domain + ' analysiert: solide Basis, aber Struktur und Ladezeit haben Luft nach oben. Das nehme ich als Ausgangspunkt — so heben wir dich klar ab. 👍' },
            ];
          }
          return [{ type: 'note', bot: 'Alles klar — dann starten wir mit einem frischen, leeren Blatt. Oft ist das sogar das Beste!' }];
        },
      },
      {
        type: 'chips', key: 'umfang', options: UMFANG_OPTS,
        bot: 'Wie groß soll deine Website ungefähr werden?',
      },
      {
        type: 'text', key: 'kontakt', counts: false,
        bot: 'Fast geschafft! Wohin darf ich dir deine Design-Vorschau schicken? Schreib mir deinen Namen und deine E-Mail.',
        placeholder: 'z. B. Max Mustermann, max@beispiel.de',
        adapt: function (val) {
          if (!/@/.test(val)) {
            return [{
              type: 'text', key: 'kontakt', counts: false,
              bot: 'Fast! Ich brauche noch deine E-Mail, dann sind wir fertig. 📩',
              placeholder: 'name@beispiel.de',
            }];
          }
          return null;
        },
      },
      { type: 'end' },
    ];
  }

  /* ---------- Helpers ---------- */
  function extractDomain(str) {
    const s = (str || '').toLowerCase().trim();
    if (/^(keine|nein|nope|hab(e)? keine|noch keine)/.test(s)) return null;
    const m = s.match(/([a-z0-9-]+\.[a-z]{2,})(\/\S*)?/);
    return m ? m[1] : null;
  }

  function firstName(str) {
    const beforeMail = (str || '').split(/[,\n]/)[0].replace(/\S+@\S+/, '').trim();
    const name = beforeMail || (str || '').trim();
    return name.split(/\s+/)[0] || 'super';
  }

  function scrollDown() { chat.scrollTop = chat.scrollHeight; }

  function addUser(text) {
    const el = document.createElement('div');
    el.className = 'lumi-msg user';
    el.innerHTML = '<div class="bubble"></div>';
    el.querySelector('.bubble').textContent = text;
    chat.appendChild(el);
    scrollDown();
  }

  function addBot(text, cb) {
    // Tipp-Indikator
    const typing = document.createElement('div');
    typing.className = 'lumi-msg bot lumi-typing';
    typing.innerHTML = '<span class="mini-avatar">L</span><div class="bubble"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>';
    chat.appendChild(typing);
    scrollDown();

    const safe = text || '';
    const delay = 550 + Math.min(safe.length * 16, 900);
    setTimeout(function () {
      typing.remove();
      const el = document.createElement('div');
      el.className = 'lumi-msg bot';
      el.innerHTML = '<span class="mini-avatar">L</span><div class="bubble"></div>';
      el.querySelector('.bubble').textContent = safe;
      chat.appendChild(el);
      scrollDown();
      if (cb) cb();
    }, delay);
  }

  function setProgress() {
    const pct = Math.min(100, Math.round((answered / TOTAL) * 100));
    progressFill.style.width = pct + '%';
    if (answered >= TOTAL) {
      progressLabel.textContent = 'Briefing fertig ✓';
    } else {
      progressLabel.textContent = 'Schritt ' + (answered + 1) + ' von ' + TOTAL;
    }
  }

  function clearInput() { inputZone.innerHTML = ''; }

  /* ---------- Engine ---------- */
  function advance() {
    if (!queue.length) return;
    const step = queue.shift();
    runStep(step);
  }

  function runStep(step) {
    clearInput();
    // Abschluss-Schritt hat keinen eigenen Bot-Text — direkt zur Zusammenfassung
    if (step.type === 'end') { renderSummary(); return; }
    const longer = step.longer;
    const botText = typeof step.bot === 'function' ? step.bot(answers) : step.bot;
    const render = function () {
      if (step.type === 'note') { advance(); }
      else { renderInput(step); }
    };
    if (longer) {
      const typing = document.createElement('div');
      typing.className = 'lumi-msg bot lumi-typing';
      typing.innerHTML = '<span class="mini-avatar">L</span><div class="bubble"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>';
      chat.appendChild(typing);
      scrollDown();
      setTimeout(function () {
        typing.remove();
        addBot(botText, render);
      }, 1300);
    } else {
      addBot(botText, render);
    }
  }

  function onAnswer(step, display, value) {
    addUser(display);
    answers[step.key] = value;
    answers[step.key + '_label'] = display;
    if (step.counts !== false) { answered++; setProgress(); }
    clearInput();
    if (step.adapt) {
      const extra = step.adapt(value, answers);
      if (extra && extra.length) queue = extra.concat(queue);
    }
    advance();
  }

  /* ---------- Input-Rendering ---------- */
  function renderInput(step) {
    if (step.type === 'text') return renderText(step);
    if (step.type === 'chips') return renderChips(step);
    if (step.type === 'styles') return renderStyles(step);
    if (step.type === 'swatches') return renderSwatches(step);
  }

  function renderText(step) {
    const form = document.createElement('form');
    form.className = 'lumi-textform';
    form.innerHTML =
      '<input type="text" autocomplete="off" placeholder="' + (step.placeholder || 'Deine Antwort…') + '" />' +
      '<button class="lumi-send" type="submit">Senden <span aria-hidden="true">→</span></button>';
    const field = form.querySelector('input');
    inputZone.appendChild(form);
    field.focus();
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      const v = field.value.trim();
      if (!v) return;
      onAnswer(step, v, v);
    });
  }

  function renderChips(step) {
    const wrap = document.createElement('div');
    wrap.className = 'lumi-chips';
    step.options.forEach(function (opt) {
      const b = document.createElement('button');
      b.className = 'lumi-chip';
      b.type = 'button';
      b.textContent = opt.label;
      b.addEventListener('click', function () { onAnswer(step, opt.label, opt.value); });
      wrap.appendChild(b);
    });
    inputZone.appendChild(wrap);
  }

  function renderStyles(step) {
    const wrap = document.createElement('div');
    wrap.className = 'lumi-styles';
    step.options.forEach(function (opt) {
      const b = document.createElement('button');
      b.className = 'lumi-style';
      b.type = 'button';
      b.innerHTML =
        '<div class="lumi-style-preview ' + opt.flavor + '">' +
          '<span class="bar a"></span><span class="bar b"></span><span class="bar c"></span>' +
        '</div>' +
        '<div class="lumi-style-meta"><strong></strong><span></span></div>';
      b.querySelector('strong').textContent = opt.title;
      b.querySelector('.lumi-style-meta span').textContent = opt.sub;
      b.addEventListener('click', function () { onAnswer(step, opt.title, opt.value); });
      wrap.appendChild(b);
    });
    inputZone.appendChild(wrap);
  }

  function renderSwatches(step) {
    const wrap = document.createElement('div');
    wrap.className = 'lumi-swatches';
    step.options.forEach(function (opt) {
      const b = document.createElement('button');
      b.className = 'lumi-swatch';
      b.type = 'button';
      const dots = opt.dots.map(function (c) { return '<span style="background:' + c + '"></span>'; }).join('');
      b.innerHTML = '<div class="lumi-swatch-dots">' + dots + '</div><small></small>';
      b.querySelector('small').textContent = opt.label;
      b.addEventListener('click', function () { onAnswer(step, opt.label, opt.value); });
      wrap.appendChild(b);
    });
    inputZone.appendChild(wrap);
  }

  /* ---------- Abschluss / Zusammenfassung ---------- */
  function renderSummary() {
    answered = TOTAL;
    setProgress();
    const name = firstName(answers.kontakt || '');
    const paket = PAKET[answers.umfang] || PAKET.unsure;
    const stilOpt = STIL_OPTS.find(function (o) { return o.value === answers.stil; }) || STIL_OPTS[0];

    addBot('Perfekt, ' + name + '! Ich stelle dir dein Briefing zusammen und erzeuge eine erste Vorschau …', function () {
      const card = document.createElement('div');
      card.className = 'lumi-summary-card';

      const rows = [
        ['Tätigkeit', answers.branche_label || '–'],
        ['Ziel', answers.ziel_label || '–'],
        ['Stil', answers.stil_label || '–'],
        ['Farbwelt', answers.farbe_label || '–'],
        ['Umfang', answers.umfang_label || '–'],
        ['Empfohlenes Paket', paket.name + ' · ' + paket.preis],
      ];

      let html = '<h4>Dein Briefing</h4>';
      rows.forEach(function (r) {
        html += '<div class="lumi-summary-row"><span class="k">' + r[0] + '</span><span class="v"></span></div>';
      });

      // Simulierte Sofort-Vorschau (3 Richtungen im gewählten Stil)
      html += '<h4 style="margin-top:22px;">Deine Sofort-Vorschau · 3 Richtungen</h4>';
      html += '<div class="lumi-preview-grid">';
      for (let i = 0; i < 3; i++) {
        html += '<div class="lumi-preview-shot"><div class="lumi-style-preview ' + stilOpt.flavor + '">' +
                '<span class="bar a"></span><span class="bar b"></span><span class="bar c"></span></div></div>';
      }
      html += '</div>';

      html += '<div class="lumi-cta-row">' +
                '<a href="preise.html" class="btn btn-primary">Paket „' + paket.name + '" ansehen <span class="arrow">→</span></a>' +
                '<a href="kontakt.html" class="btn btn-outline">Kostenlosen Check anfordern</a>' +
              '</div>';

      card.innerHTML = html;
      // Werte sicher als Text setzen (kein HTML-Injection)
      const valCells = card.querySelectorAll('.lumi-summary-row .v');
      rows.forEach(function (r, idx) { valCells[idx].textContent = r[1]; });

      chat.appendChild(card);

      const restart = document.createElement('button');
      restart.className = 'lumi-restart';
      restart.type = 'button';
      restart.textContent = 'Briefing neu starten';
      restart.style.marginTop = '16px';
      restart.addEventListener('click', reset);
      const wrapR = document.createElement('div');
      wrapR.style.textAlign = 'center';
      wrapR.appendChild(restart);
      chat.appendChild(wrapR);

      scrollDown();
    });
  }

  function reset() {
    chat.innerHTML = '';
    inputZone.innerHTML = '';
    for (const k in answers) delete answers[k];
    answered = 0;
    setProgress();
    queue = buildFlow();
    advance();
  }

  /* ---------- Start ---------- */
  queue = buildFlow();
  setProgress();
  advance();
})();
