import re
f = 'briefing.js'
s = open(f, encoding='utf-8').read()
def rep(old, new, label):
    global s
    assert s.count(old) == 1, f"{label}: {s.count(old)}x"
    s = s.replace(old, new, 1)

# (1) State: seo_stufe
rep("    features: [], stil: null, hauptfarbe: null, nebenfarbe: null, markenfarben_hex: '',",
    "    features: [], stil: null, hauptfarbe: null, nebenfarbe: null, markenfarben_hex: '',\n    seo_stufe: null,                  // E2: gewählte SEO-Betreuung-Stufe (additiv) | null|'lite'|'pro'|'premium'",
    "state")

# (2) seoProductFor-Helfer vor renderPriceBar
rep("  function renderPriceBar() {",
    "  function seoProductFor(stufe) { return (PRICING.addons || []).filter(function (a) { return a.id === 'seo-' + stufe; })[0] || null; }\n  function renderPriceBar() {",
    "seoProductFor")

# (3) Preisleiste: eigene SEO-Monatszeile
rep(
"""    sums.innerHTML =
      '<div class="lb-sum"><span>Einmalig</span><strong></strong></div>' +
      '<div class="lb-sum lb-sum-mo"><span>Monatlich · Pflicht</span><strong></strong></div>' +
      wishLine;""",
"""    var seoLine = '';
    if (A.seo_stufe) {
      var sp = seoProductFor(A.seo_stufe);
      if (sp) seoLine = '<div class="lb-sum lb-sum-mo"><span>SEO-Betreuung (mtl. nach 3 Mon. kündbar)</span><strong>+' + sp.price.toLocaleString('de-DE') + ' €/Mon.</strong></div>';
    }
    sums.innerHTML =
      '<div class="lb-sum"><span>Einmalig</span><strong></strong></div>' +
      '<div class="lb-sum lb-sum-mo"><span>Monatlich · Pflicht</span><strong></strong></div>' +
      seoLine + wishLine;""",
    "pricebar-seo")

# (4) buildDesignDirection (extrahiert) vor dem SCREENS-Block
DESIGN_FN = """  // E2: Design-Richtung (Stil-Chips + Farben + HEX) — EINE Render-Funktion für
  // den Pfad-B-Schritt 'design' UND die Konfigurator-Sektion (kein Duplikat).
  function buildDesignDirection(host, withMock) {
    var mock = (withMock && window.SARTU_COLOR_MOCKUP) ? window.SARTU_COLOR_MOCKUP.build() : null;
    function hexOf(v) { var o = (OPT.farben || []).filter(function (x) { return x.value === v; })[0]; return o ? o.hex : null; }
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
          A[slot] = (A[slot] === opt.value) ? null : opt.value;
          Array.prototype.forEach.call(tiles.querySelectorAll('.lb-colortile'), function (x) {
            x.classList.remove('is-on'); x.setAttribute('aria-pressed', 'false');
          });
          if (A[slot] === opt.value) { b.classList.add('is-on'); b.setAttribute('aria-pressed', 'true'); }
          refreshMock();
        });
        tiles.appendChild(b);
      });
      wrap.appendChild(tiles);
      return wrap;
    }
    dgrid.appendChild(colorRow('Hauptfarbe', 'hauptfarbe'));
    dgrid.appendChild(colorRow('Nebenfarbe', 'nebenfarbe'));
    if (mock) { dgrid.appendChild(mock); refreshMock(); }
    var lbl = el('label', 'lb-field lb-field-optional');
    lbl.innerHTML = '<span class="lb-field-label">Feste Markenfarbe vorhanden? <em>(HEX-Code, falls bekannt — sonst überspringen)</em></span>';
    var inp = el('input'); inp.type = 'text'; inp.placeholder = 'z. B. #B6FF3B';
    inp.value = A.markenfarben_hex || '';
    inp.addEventListener('input', function (e) { A.markenfarben_hex = e.target.value; });
    lbl.appendChild(inp); dgrid.appendChild(lbl);
    dgrid.appendChild(el('p', 'lb-design-note',
      'Das ist nur eine grobe Richtung zur Veranschaulichung — den Feinschliff und die genauen Farbtöne machen wir gemeinsam nach dem Start. Alles wird handgemacht, kein Baukasten.'));
    host.appendChild(dgrid);
  }

  /* ============================================================
     SCREENS
     ============================================================ */"""
rep("""  /* ============================================================
     SCREENS
     ============================================================ */""", DESIGN_FN, "buildDesignDirection")

# (5) design-Screen nutzt die Funktion
s = re.sub(r"var h = lumiSays\('Welcher Look gefällt dir\?', 'Wähle einen Stil — er bestimmt die Live-Vorschau\.'\);.*?stage\.appendChild\(dgrid\);",
           "var h = lumiSays('Welcher Look gefällt dir?', 'Wähle einen Stil — er bestimmt die Live-Vorschau.');\n      buildDesignDirection(stage, true);",
           s, count=1, flags=re.S)

# (6) "Tipp nach dem Go-live"-Block entfernen
rep(
"""
      // Lokale Branchen / Ziel Neukunden: dezenter Programm-Hinweis (kein Auto-Add)
      if (A.pfad === 'B' && !isEnterprise() &&
          (['gastro', 'handwerk', 'gesundheit', 'dienstleistung', 'immobilien', 'kreativ'].indexOf(A.branche) > -1
           || (A.ziele || []).indexOf('neukunden') > -1)) {
        stage.appendChild(el('p', 'lb-cfg-foot',
          'Tipp nach dem Go-live: Die SEO-Betreuung ab 149 €/Monat — Google-Profil-Pflege inklusive.'));
      }
""", "\n", "tipp-weg")

# (7) var-Deklaration + renderDynamic
rep("      var wartSec, pageSec, addSec, wishSec; // in renderDynamic() befüllt",
    "      var wartSec, pageSec, addSec, designSec, wishSec, seoSec; // in renderDynamic() befüllt",
    "vardecl")
rep(
"""        wartSec = el('div', 'lb-cfg-section'); dynSec.appendChild(wartSec);
        pageSec = el('div', 'lb-cfg-section'); dynSec.appendChild(pageSec);
        addSec = el('div', 'lb-cfg-section'); dynSec.appendChild(addSec);
        wishSec = el('div', 'lb-cfg-section'); dynSec.appendChild(wishSec);
        renderWartung(); renderPages(); renderAddons(); renderWuensche();""",
"""        wartSec = el('div', 'lb-cfg-section'); dynSec.appendChild(wartSec);
        pageSec = el('div', 'lb-cfg-section'); dynSec.appendChild(pageSec);
        addSec = el('div', 'lb-cfg-section'); dynSec.appendChild(addSec);
        designSec = el('div', 'lb-cfg-section'); dynSec.appendChild(designSec);
        wishSec = el('div', 'lb-cfg-section'); dynSec.appendChild(wishSec);
        seoSec = el('div', 'lb-cfg-section'); dynSec.appendChild(seoSec);
        renderWartung(); renderPages(); renderAddons(); renderDesignDir(); renderWuensche(); renderSeo();""",
    "renderDynamic")

# (8) renderDesignDir + renderSeo vor renderPkg
RENDER_NEW = """      function renderDesignDir() {
        designSec.innerHTML = '<h3 class="lb-cfg-h">Design-Richtung <span class="lb-cfg-opt">(optional)</span></h3>';
        buildDesignDirection(designSec, false);
      }
      var SEO_LOCAL = ['gastro', 'handwerk', 'gesundheit', 'dienstleistung', 'immobilien', 'kreativ'];
      function renderSeo() {
        seoSec.innerHTML = '<h3 class="lb-cfg-h">Sichtbarkeit nach dem Start <span class="lb-cfg-opt">(optional)</span></h3>' +
          '<p class="lb-cfg-foot" style="margin-top:-4px;margin-bottom:12px;">SEO-Betreuung — damit du bei Google und in der KI-Suche gefunden wirst. Standard: erstmal ohne, jederzeit später dazubuchbar.</p>';
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

      function renderPkg() {"""
rep("      function renderPkg() {", RENDER_NEW, "renderDesignDir-renderSeo")

# (9) collect: seo_stufe top-level + konfiguration
rep("      produkt_typ: A.produkt_typ, // 'website' | 'redesign' (additiv, bestehende Keys unverändert)",
    "      produkt_typ: A.produkt_typ, // 'website' | 'redesign' (additiv, bestehende Keys unverändert)\n      seo_stufe: A.seo_stufe, // E2: null|'lite'|'pro'|'premium' (additiv)",
    "collect-top")
rep("        summe_einmalig: t.once,\n        summe_monatlich: t.monthly,",
    "        summe_einmalig: t.once,\n        summe_monatlich: t.monthly,\n        seo_stufe: A.seo_stufe,\n        seo_monatlich: A.seo_stufe ? seoProductFor(A.seo_stufe).price : 0,",
    "collect-konfig")

# (10) summaryRows: SEO-Zeile
rep("      rows.push({ k: 'Add-ons', v: selectedAddonsText() || 'keine', screen: 'configurator' });",
    "      rows.push({ k: 'Add-ons', v: selectedAddonsText() || 'keine', screen: 'configurator' });\n      if (A.seo_stufe) { var sp = seoProductFor(A.seo_stufe); rows.push({ k: 'SEO-Betreuung', v: sp.short + ' · ' + priceLabel(sp.price, { period: true }) + ' (optional, mtl. nach 3 Mon. kündbar)', screen: 'configurator' }); }",
    "summary-seo")

# (11) contact recap: SEO anhängen
rep("'<span class=\"lb-recap-sums\">Einmalig <strong>' + fmtEUR(t.once) + '</strong> · Monatlich <strong>' + fmtEUR(t.monthly) + '</strong> (Pflicht)</span>';",
    "'<span class=\"lb-recap-sums\">Einmalig <strong>' + fmtEUR(t.once) + '</strong> · Monatlich <strong>' + fmtEUR(t.monthly) + '</strong> (Pflicht)' + (A.seo_stufe ? ' · + SEO-Betreuung ' + fmtEUR(seoProductFor(A.seo_stufe).price) + '/Mon.' : '') + '</span>';",
    "recap-seo")

# (12) resetAll
rep("    A.wartung = null; A.extraPages = 0; A.addons = {}; A.addonEmpfohlen = []; A.addonGrund = {}; A._prefilled = false; A._recShown = false;",
    "    A.wartung = null; A.extraPages = 0; A.addons = {}; A.addonEmpfohlen = []; A.addonGrund = {}; A.seo_stufe = null; A._prefilled = false; A._recShown = false;",
    "reset")

# Asserts
assert 'Tipp nach dem Go-live' not in s
assert s.count('function buildDesignDirection') == 1
assert s.count('function renderSeo()') == 1 and s.count('function renderDesignDir()') == 1
assert s.count('stage.appendChild(dgrid);') == 0  # design-Screen extrahiert
assert "seo_stufe: A.seo_stufe" in s
open(f, 'w', encoding='utf-8').write(s)
print("briefing.js ✓ alle 12 Edits angewandt")
